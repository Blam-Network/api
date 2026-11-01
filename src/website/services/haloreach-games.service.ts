import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/db/prisma.service";

export const REACH_GAME_MODE_FILTERS = {
    campaign: 1,
    matchmaking: 2,
    custom: 3,
    forge: 4,
    firefight: 6,
} as const;

export type ReachGameModeFilter = keyof typeof REACH_GAME_MODE_FILTERS;

const nonZeroCounts = (counts: number[]) =>
    counts
        .map((count, index) => ({ index, count }))
        .filter(({ count }) => count > 0);

@Injectable()
export class HaloReachGamesService {
    constructor(private readonly prisma: PrismaService) {}

    async listGames(options: {
        page: number;
        pageSize: number;
        gamertag?: string;
        mode?: ReachGameModeFilter;
    }) {
        const { page, pageSize, gamertag, mode } = options;
        const where: Prisma.reach_gameWhereInput = {
            ...(gamertag ? { players: { some: { player_name: { equals: gamertag, mode: "insensitive" } } } } : {}),
            ...(mode ? { gui_game_mode: REACH_GAME_MODE_FILTERS[mode] } : {}),
        };

        const [total, games] = await Promise.all([
            this.prisma.reach_game.count({ where }),
            this.prisma.reach_game.findMany({
                where,
                orderBy: { finish_time: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    gui_game_mode: true,
                    game_engine: true,
                    team_game: true,
                    map_id: true,
                    map_variant_name: true,
                    game_variant_name: true,
                    game_variant_icon_index: true,
                    campaign_difficulty: true,
                    hopper_name: true,
                    start_time: true,
                    finish_time: true,
                    _count: { select: { players: true } },
                    players: gamertag
                        ? {
                            where: { player_name: { equals: gamertag, mode: "insensitive" } },
                            select: {
                                player_name: true,
                                team: true,
                                standing: true,
                                score: true,
                                kills: true,
                                deaths: true,
                                assists: true,
                            },
                            take: 1,
                        }
                        : false,
                },
            }),
        ]);

        return {
            data: games.map(({ _count, players, ...game }) => ({
                ...game,
                player_count: _count.players,
                player: players?.[0] ?? null,
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    async getGame(id: string) {
        const game = await this.prisma.reach_game.findUnique({
            where: { id },
            include: {
                teams: { orderBy: { standing: "asc" } },
                players: {
                    orderBy: [{ standing: "asc" }, { score: "desc" }],
                    include: {
                        weapons: true,
                        versus: true,
                        ai_kills: true,
                    },
                },
            },
        });

        if (!game) {
            throw new NotFoundException();
        }

        return {
            ...game,
            game_instance: game.game_instance.toString(),
            map_variant_unique_id: game.map_variant_unique_id.toString(),
            game_variant_unique_id: game.game_variant_unique_id.toString(),
            initial_skulls: Number(game.initial_skulls),
            players: game.players.map(({ medals, reward_statistics, weapons, versus, ai_kills, game_id, ...player }) => ({
                ...player,
                player_xuid: player.player_xuid.toString(),
                medals: nonZeroCounts(medals).map(({ index, count }) => ({ medal: index, count })),
                reward_statistics,
                weapons: weapons.map(({ game_id: _, player_index: __, ...weapon }) => weapon),
                versus: versus.map(({ game_id: _, player_index: __, ...opponent }) => opponent),
                ai_kills: ai_kills.map(({ game_id: _, player_index: __, ...bucket }) => bucket),
            })),
            teams: game.teams.map(({ game_id, ...team }) => team),
        };
    }
}
