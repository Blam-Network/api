import { Controller, Get, Header, NotFoundException, Param, ParseIntPipe, Query, StreamableFile } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "src/db/prisma.service";
import {
    HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA,
    HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA,
} from "src/constants";
import { HaloReachFileShareService } from "../services/haloreachfileshare.service";
import { HaloReachPopulationService } from "src/lsp/haloreach/population.service";
import { HaloReachSpartanRenderService } from "src/lsp/haloreach/spartan-render.service";

function mapReachServiceRecord(sr: {
    player_xuid: { toString(): string };
    player_name: string;
    appearance_flags: number;
    primary_color: number;
    secondary_color: number;
    tertiary_color: number;
    is_elite: number;
    foreground_emblem: number;
    background_emblem: number;
    emblem_flags: number;
    emblem_primary_color: number;
    emblem_secondary_color: number;
    emblem_background_color: number;
    model_permutations_1: number;
    model_permutations_2: number;
    model_permutations_3: number;
    model_permutations_4: number;
    model_permutations_5: number;
    model_permutations_6: number;
    model_permutations_7: number;
    model_permutations_8: number;
    non_model_customization_1: number;
    non_model_customization_2: number;
    non_model_customization_3: number;
    non_model_customization_4: number;
    service_tag: string;
    campaign_progress: number;
    supply_depot_pct: number;
    commendation_unlock_pct: number;
    grade: number;
    sub_grade: number;
    cheat_flags: { toString(): string };
    ban_flags: { toString(): string };
    matchmade_games_played: number;
}) {
    return {
        id: sr.player_xuid.toString(),
        playerName: sr.player_name,
        appearanceFlags: sr.appearance_flags,
        primaryColor: sr.primary_color,
        secondaryColor: sr.secondary_color,
        tertiaryColor: sr.tertiary_color,
        model: sr.is_elite,
        foregroundEmblem: sr.foreground_emblem,
        backgroundEmblem: sr.background_emblem,
        emblemFlags: sr.emblem_flags,
        emblemPrimaryColor: sr.emblem_primary_color,
        emblemSecondaryColor: sr.emblem_secondary_color,
        emblemBackgroundColor: sr.emblem_background_color,
        serviceTag: sr.service_tag,
        campaignProgress: sr.campaign_progress,
        supplyDepotPct: sr.supply_depot_pct,
        commendationUnlockPct: sr.commendation_unlock_pct,
        grade: sr.grade,
        subGrade: sr.sub_grade,
        cheatFlags: sr.cheat_flags.toString(),
        banFlags: sr.ban_flags.toString(),
        matchmadeGamesPlayed: sr.matchmade_games_played,
        modelPermutations: [
            sr.model_permutations_1,
            sr.model_permutations_2,
            sr.model_permutations_3,
            sr.model_permutations_4,
            sr.model_permutations_5,
            sr.model_permutations_6,
            sr.model_permutations_7,
            sr.model_permutations_8,
        ],
        nonModelCustomization: [
            sr.non_model_customization_1,
            sr.non_model_customization_2,
            sr.non_model_customization_3,
            sr.non_model_customization_4,
        ],
        highestSkill: 0,
        totalEXP: 0,
        rank: 0,
        unknownInsignia: 0,
        unknownInsignia2: 0,
        firstPlayed: null as Date | null,
        lastPlayed: null as Date | null,
        gamesCompleted: sr.matchmade_games_played,
    };
}

@ApiTags('Halo: Reach')
@Controller('/haloreach')
export class HaloReachController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly fileshareService: HaloReachFileShareService,
        private readonly populationService: HaloReachPopulationService,
        private readonly spartanRenderService: HaloReachSpartanRenderService,
    ) { }

    @Get('/online-players')
    @ApiOperation({
        summary: 'Get live online players count',
        description:
            'Returns the number of players seen in LSP presence heartbeats within the last minute.',
    })
    async getOnlinePlayersCount() {
        return {
            count: await this.populationService.getTotalActivePlayers(),
        };
    }

    @Get('/lobbies')
    @ApiOperation({
        summary: 'List active Reach lobbies',
        description:
            'Returns players currently online from LSP presence heartbeats, grouped by session id and enriched with service record appearance when available.',
    })
    async getActiveLobbies() {
        const lobbies = await this.populationService.getActiveLobbies();
        const xuids = lobbies.flatMap((lobby) =>
            lobby.players.map((player) => player.playerXuid),
        );

        const serviceRecords =
            xuids.length > 0
                ? await this.prisma.reach_service_record.findMany({
                      where: { player_xuid: { in: xuids as any } },
                  })
                : [];

        const serviceRecordByXuid = new Map(
            serviceRecords.map((sr) => [
                sr.player_xuid.toString(),
                mapReachServiceRecord(sr),
            ]),
        );

        return {
            totalPlayers: xuids.length,
            lobbies: lobbies.map((lobby) => ({
                sessionId: lobby.sessionId,
                guiGameMode: lobby.guiGameMode,
                sessionGameMode: lobby.sessionGameMode,
                hopperId: lobby.hopperId,
                sessionPrivacy: lobby.sessionPrivacy,
                sessionClosed: lobby.sessionClosed,
                players: lobby.players.map((player) => {
                    const sr = serviceRecordByXuid.get(player.playerXuid);
                    if (!sr?.playerName) {
                        return {
                            xuid: player.playerXuid,
                            team: player.team,
                            playerName: null,
                            appearance: null,
                        };
                    }

                    return {
                        xuid: player.playerXuid,
                        team: player.team,
                        playerName: sr.playerName,
                        appearance: {
                            primaryColor: sr.primaryColor,
                            foregroundEmblem: sr.foregroundEmblem,
                            backgroundEmblem: sr.backgroundEmblem,
                            emblemFlags: sr.emblemFlags,
                            emblemPrimaryColor: sr.emblemPrimaryColor,
                            emblemSecondaryColor: sr.emblemSecondaryColor,
                            emblemBackgroundColor: sr.emblemBackgroundColor,
                            model: sr.model,
                            serviceTag: sr.serviceTag,
                        },
                    };
                }),
            })),
        };
    }

    @Get('/players/:xuid/servicerecord')
    @ApiParam({ name: 'xuid' })
    async getServiceRecordByXuid(
        @Param('xuid') xuid: string,
    ) {
        const sr = await this.prisma.reach_service_record.findUnique({
            where: { player_xuid: xuid as any },
        });
        if (!sr) {
            return {};
        }
        return mapReachServiceRecord(sr);
    }

    @Get('/players/by-gamertag/:gamertag/servicerecord')
    @ApiParam({ name: 'gamertag' })
    async getServiceRecordByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const decodedGamertag = decodeURIComponent(gamertag);
        const sr = await this.prisma.reach_service_record.findFirst({
            where: { player_name: decodedGamertag },
        });
        if (!sr) {
            return {};
        }
        return mapReachServiceRecord(sr);
    }

    @Get('/players/:xuid/screenshots')
    @ApiParam({ name: 'xuid' })
    async listPlayerScreenshotsByXuid(
        @Param('xuid') xuid: string,
    ) {
        const screenshots = await this.prisma.reach_blind_screenshot.findMany({
            where: {
                author_id: xuid as any,
            },
            orderBy: {
                date: 'desc',
            },
            take: 48,
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            },
        });
        return screenshots.map(sc => ({
            id: sc.id,
            header: {
                filename: sc.name,
                description: sc.description,
            },
            author: sc.author,
            date: sc.date,
        }));
    }

    @Get('/players/by-gamertag/:gamertag/screenshots')
    @ApiParam({ name: 'gamertag' })
    async listPlayerScreenshotsByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const decodedGamertag = decodeURIComponent(gamertag);
        const screenshots = await this.prisma.reach_blind_screenshot.findMany({
            where: {
                author: decodedGamertag,
            },
            orderBy: {
                date: 'desc',
            },
            take: 48,
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            },
        });
        return screenshots.map(sc => ({
            id: sc.id,
            header: {
                filename: sc.name,
                description: sc.description,
            },
            author: sc.author,
            date: sc.date,
        }));
    }

    @Get('/players/by-gamertag/:gamertag/fileshare')
    @ApiParam({ name: 'gamertag' })
    async listPlayerFileShareByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const decodedGamertag = decodeURIComponent(gamertag);
        const sr = await this.prisma.reach_service_record.findFirst({
            where: { player_name: decodedGamertag },
            select: { player_xuid: true },
        });
        if (!sr?.player_xuid) {
            return {
                id: '',
                ownerId: '',
                visibleSlots: 0,
                quotaBytes: HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA,
                quotaSlots: HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA,
                subscriptionHash: 0,
                slots: [],
            };
        }

        const shareId = sr.player_xuid.toString();
        const share = await this.prisma.reach_file_share.findUnique({
            where: { share_id: shareId as any },
            select: {
                share_id: true,
                quota_slots: true,
                quota_bytes: true,
                lastHash: true,
            },
        });

        const files = await this.prisma.reach_file_share_file.findMany({
            where: { share_id: shareId as any, is_uploaded: true },
            orderBy: { modified_at: 'desc' },
            select: {
                id: true,
                unique_id: true,
                name: true,
                description: true,
                creator_name: true,
                file_type: true,
                creator_is_xuid_online: true,
                creator_xuid: true,
                size_in_bytes: true,
                modified_at: true,
                created_at: true,
                length_seconds: true,
                campaign_id: true,
                map_id: true,
                game_engine_type: true,
                icon_index: true,
                campaign_difficulty: true,
                hopper_identifier: true,
                campaign_insertion_point: true,
            },
        });

        return {
            id: share?.share_id?.toString() ?? shareId,
            ownerId: share?.share_id?.toString() ?? shareId,
            visibleSlots: files.length,
            quotaBytes: share?.quota_bytes ?? HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA,
            quotaSlots: share?.quota_slots ?? HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA,
            subscriptionHash: share?.lastHash ?? 0,
            slots: files.map((f, index) => ({
                id: f.id.toString(),
                uniqueId: f.unique_id != null ? f.unique_id.toString() : '',
                slotNumber: index,
                header: {
                    buildNumber: 0,
                    mapVersion: 0,
                    uniqueId: f.unique_id != null ? f.unique_id.toString() : '',
                    filename: f.name ?? '',
                    description: f.description ?? '',
                    author: f.creator_name ?? '',
                    filetype: f.file_type ?? 0,
                    authorXuidIsOnline: !!f.creator_is_xuid_online,
                    authorXuid: f.creator_xuid != null ? f.creator_xuid.toString() : '',
                    size: Number(f.size_in_bytes?.toString() ?? 0),
                    date: (f.modified_at ?? f.created_at)?.toISOString() ?? '',
                    lengthSeconds: f.length_seconds ?? 0,
                    campaignId: f.campaign_id ?? 0,
                    mapId: f.map_id ?? 0,
                    gameEngineType: f.game_engine_type ?? 0,
                    iconIndex: f.icon_index ?? null,
                    campaignDifficulty: f.campaign_difficulty ?? 0,
                    hopperId: f.hopper_identifier ?? 0,
                    gameId: 0,
                    campaignInsertionPoint: f.campaign_insertion_point ?? 0,
                    campaignSurvivalEnabled: false,
                },
            })),
        };
    }

    @Get('/spartan/:gamertag.png')
    @ApiOperation({
        summary: 'View Spartan render',
        description:
            'Returns the most recent Halo: Reach Spartan render PNG uploaded for the player (by gamertag).',
    })
    @ApiParam({ name: 'gamertag' })
    @Header('Content-Type', 'image/png')
    async viewSpartanRender(
        @Param('gamertag') gamertag: string,
    ) {
        const decodedGamertag = decodeURIComponent(gamertag);
        const sr = await this.prisma.reach_service_record.findFirst({
            where: { player_name: decodedGamertag },
            select: { player_xuid: true },
        });
        if (!sr?.player_xuid) {
            throw new NotFoundException('Player not found');
        }

        const png = await this.spartanRenderService.getLatestSpartanRenderPng(
            BigInt(sr.player_xuid.toString()),
        );
        if (!png) {
            throw new NotFoundException('Spartan render not found');
        }

        return new StreamableFile(Uint8Array.from(png));
    }

    @Get('/screenshots')
    @ApiOperation({
        summary: 'List Screenshots',
        description: 'Returns paginated blind screenshots across all users, optionally filtered by gamertag.',
    })
    async listScreenshots(
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 48,
        @Query('gamertag') gamertag?: string,
    ) {
        const skip = (page - 1) * pageSize;

        const where = gamertag ? { author: gamertag } : {};

        const [screenshots, total] = await Promise.all([
            this.prisma.reach_blind_screenshot.findMany({
                where,
                orderBy: {
                    date: 'desc',
                },
                skip,
                take: pageSize,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    author: true,
                    date: true,
                },
            }),
            this.prisma.reach_blind_screenshot.count({ where }),
        ]);

        return {
            data: screenshots.map(sc => ({
                id: sc.id,
                header: {
                    filename: sc.name,
                    description: sc.description,
                },
                author: sc.author,
                date: sc.date,
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    @Get('/screenshots/:id/view')
    @ApiOperation({
        summary: 'View Screenshot',
        description: 'Returns an uploaded Halo: Reach JPEG screenshot.',
    })
    @Header('Content-Type', 'image/jpeg')
    async viewScreenshot(
        @Param('id') id: string,
    ) {
        return new StreamableFile(
            Uint8Array.from(await this.fileshareService.viewBlindScreenshot(id)),
        );
    }

    @Get('/screenshots/:id')
    @ApiOperation({
        summary: 'Get Screenshot',
        description: 'Returns metadata for a single blind screenshot by ID.',
    })
    async getScreenshot(
        @Param('id') id: string,
    ) {
        const screenshot = await this.prisma.reach_blind_screenshot.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            },
        });

        if (!screenshot) {
            throw new NotFoundException('Screenshot not found');
        }

        return {
            id: screenshot.id,
            header: {
                filename: screenshot.name,
                description: screenshot.description,
            },
            author: screenshot.author,
            date: screenshot.date,
        };
    }
}
