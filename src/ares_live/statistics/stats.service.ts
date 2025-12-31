import { Injectable, Inject, StreamableFile } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { 
    SBlfFileStatsQuerySchema,
    SBlfFileStatsQueryResponseSchema,
    s_online_data,
    s_stats_query_response_leaderboard,
    s_stats_query_response_row,
    s_stats_query_response_column,
} from './stats.chunks';
import { ARES_LIVE_AUTHOR, DEFAULT_BLF_CHUNK, DEFAULT_EOF_CHUNK } from '../chunks';

interface StatsCache {
    hopperStats?: {
        leaderboardId: number;
        playerXuid: bigint;
        skill: number;
        gamesCompleted: number;
        gamesPlayed: number;
        gamesWon: number;
        expBase: number;
        expPenalty: number;
    };
    hopperSkillStats?: {
        leaderboardId: number;
        playerXuid: bigint;
        mu: number;
        sigma: number;
    };
    globalStats?: {
        leaderboardId: number;
        playerXuid: bigint;
        customGamesCompleted: number | null;
        customGamesWon: number | null;
        experienceBase: number | null;
        experiencePenalty: number | null;
        highestSkillLevelAttained: number | null;
        matchmadeRankedGamesCompleted: number | null;
        matchmadeRankedGamesPlayed: number | null;
        matchmadeRankedGamesWon: number | null;
        matchmadeUnrankedGamesCompleted: number | null;
        matchmadeUnrankedGamesPlayed: number | null;
        matchmadeUnrankedGamesWon: number | null;
        firstGamePlayedDate: bigint | null;
        lastGamePlayedDate: bigint | null;
    };
}

@Injectable()
export class StatsService {
    private readonly _online_data_integer = 1;
    private readonly _online_data_double = 3;
    private readonly _online_data_null = 255;
    private readonly _online_leaderboard_column_id_skill_mu = 0;
    private readonly _online_leaderboard_column_id_skill_sigma = 1;
    private readonly _online_leaderboard_column_id_global_unarbitrated_custom_games_completed = 2;
    private readonly _online_leaderboard_column_id_global_unarbitrated_custom_games_won = 3;
    private readonly _online_leaderboard_column_id_global_arbitrated_experience_base = 4;
    private readonly _online_leaderboard_column_id_global_arbitrated_experience_penalty = 5;
    private readonly _online_leaderboard_column_id_global_arbitrated_highest_skill_level_attained = 6;
    private readonly _online_leaderboard_column_id_global_arbitrated_matchmade_ranked_games_completed = 7;
    private readonly _online_leaderboard_column_id_global_arbitrated_matchmade_ranked_games_played = 8;
    private readonly _online_leaderboard_column_id_global_arbitrated_matchmade_ranked_games_won = 9;
    private readonly _online_leaderboard_column_id_global_arbitrated_matchmade_unranked_games_completed = 10;
    private readonly _online_leaderboard_column_id_global_arbitrated_matchmade_unranked_games_played = 11;
    private readonly _online_leaderboard_column_id_global_arbitrated_matchmade_unranked_games_won = 12;
    private readonly _online_leaderboard_column_id_global_arbitrated_first_game_played_date = 13;
    private readonly _online_leaderboard_column_id_global_arbitrated_last_game_played_date = 14;
    private readonly _online_leaderboard_column_id_hopper_0_skill = 15;
    private readonly _online_leaderboard_column_id_hopper_31_experience_penalty = 206;

    private readonly _online_leaderboard_id_skill = 0;
    private readonly _online_leaderboard_id_global_arbitrated = 1;
    private readonly _online_leaderboard_id_global_unarbitrated = 2;
    private readonly _online_leaderboard_id_hopper_0 = 3;
    private readonly _online_leaderboard_id_hopper_31 = 96;

    constructor(
        private readonly prisma: PrismaService,
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {}

    async fetchAllStatsAsync(
        leaderboardIds: number[],
        xuids: bigint[],
    ): Promise<Map<string, StatsCache>> {
        const cache = new Map<string, StatsCache>();

        try {
            const hopperStats = await this.prisma.ares_player_stats_hopper.findMany({
                where: {
                    leaderboard_id: { in: leaderboardIds.map((id) => id) },
                    player_xuid: { in: xuids.map((x) => x.toString()) },
                },
            });

            const hopperSkillStats = await this.prisma.ares_player_stats_hopper_skill.findMany({
                where: {
                    leaderboard_id: { in: leaderboardIds.map((id) => id) },
                    player_xuid: { in: xuids.map((x) => x.toString()) },
                },
            });

            const globalStats = await this.prisma.ares_player_stats_global.findMany({
                where: {
                    leaderboard_id: { in: leaderboardIds.map((id) => id) },
                    player_xuid: { in: xuids.map((x) => x.toString()) },
                },
            });

            for (const xuid of xuids) {
                for (const leaderboardId of leaderboardIds) {
                    const key = `${leaderboardId}_${xuid}`;
                    const hopperStat = hopperStats.find(
                        (s) => Number(s.leaderboard_id) === leaderboardId && s.player_xuid.toString() === xuid.toString(),
                    );
                    const hopperSkillStat = hopperSkillStats.find(
                        (s) => Number(s.leaderboard_id) === leaderboardId && s.player_xuid.toString() === xuid.toString(),
                    );
                    const globalStat = globalStats.find(
                        (s) => Number(s.leaderboard_id) === leaderboardId && s.player_xuid.toString() === xuid.toString(),
                    );

                    cache.set(key, {
                        hopperStats: hopperStat ? {
                            leaderboardId: Number(hopperStat.leaderboard_id),
                            playerXuid: BigInt(hopperStat.player_xuid.toString()),
                            skill: hopperStat.skill,
                            gamesCompleted: hopperStat.games_completed,
                            gamesPlayed: hopperStat.games_played,
                            gamesWon: hopperStat.games_won,
                            expBase: hopperStat.exp_base,
                            expPenalty: hopperStat.exp_penalty,
                        } : undefined,
                        hopperSkillStats: hopperSkillStat ? {
                            leaderboardId: Number(hopperSkillStat.leaderboard_id),
                            playerXuid: BigInt(hopperSkillStat.player_xuid.toString()),
                            mu: hopperSkillStat.mu,
                            sigma: hopperSkillStat.sigma,
                        } : undefined,
                        globalStats: globalStat ? {
                            leaderboardId: Number(globalStat.leaderboard_id),
                            playerXuid: BigInt(globalStat.player_xuid.toString()),
                            customGamesCompleted: globalStat.custom_games_completed,
                            customGamesWon: globalStat.custom_games_won,
                            experienceBase: globalStat.experience_base,
                            experiencePenalty: globalStat.experience_penalty,
                            highestSkillLevelAttained: globalStat.highest_skill_level_attained,
                            matchmadeRankedGamesCompleted: globalStat.matchmade_ranked_games_completed,
                            matchmadeRankedGamesPlayed: globalStat.matchmade_ranked_games_played,
                            matchmadeRankedGamesWon: globalStat.matchmade_ranked_games_won,
                            matchmadeUnrankedGamesCompleted: globalStat.matchmade_unranked_games_completed,
                            matchmadeUnrankedGamesPlayed: globalStat.matchmade_unranked_games_played,
                            matchmadeUnrankedGamesWon: globalStat.matchmade_unranked_games_won,
                            firstGamePlayedDate: globalStat.first_game_played_date ? BigInt(globalStat.first_game_played_date.toString()) : null,
                            lastGamePlayedDate: globalStat.last_game_played_date ? BigInt(globalStat.last_game_played_date.toString()) : null,
                        } : undefined,
                    });
                }
            }
        } catch (error) {
            // Database is down or unavailable - behave as if no rows were found
            this.logger.warn(`Database unavailable when fetching stats. Returning empty cache (default values will be used). Error: ${error}`);
            
            // Initialize cache with empty StatsCache entries for all requested combinations
            for (const xuid of xuids) {
                for (const leaderboardId of leaderboardIds) {
                    const key = `${leaderboardId}_${xuid}`;
                    cache.set(key, {});
                }
            }
        }

        return cache;
    }

    getStatValue(
        columnId: number,
        leaderboardId: number,
        playerXuid: bigint,
        cache: Map<string, StatsCache>,
    ): s_online_data {
        const result: s_online_data = {
            type: this._online_data_null,
            dataAsLong: BigInt(0),
            dataAsDouble: 0,
            extension: BigInt(0),
        };

        const key = `${leaderboardId}_${playerXuid}`;
        const statsCache = cache.get(key) || {};

        try {
            if (leaderboardId === this._online_leaderboard_id_skill) {
                if (columnId === this._online_leaderboard_column_id_skill_mu) {
                    result.type = this._online_data_double;
                    result.dataAsDouble = statsCache.hopperSkillStats?.mu ?? 25.0;
                    return result;
                } else if (columnId === this._online_leaderboard_column_id_skill_sigma) {
                    result.type = this._online_data_double;
                    result.dataAsDouble = statsCache.hopperSkillStats?.sigma ?? 8.333;
                    return result;
                }
            } else if (
                leaderboardId === this._online_leaderboard_id_global_arbitrated ||
                leaderboardId === this._online_leaderboard_id_global_unarbitrated
            ) {
                const globalData = statsCache.globalStats;

                switch (columnId) {
                    case this._online_leaderboard_column_id_global_unarbitrated_custom_games_completed:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.customGamesCompleted ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_unarbitrated_custom_games_won:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.customGamesWon ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_experience_base:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.experienceBase ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_experience_penalty:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.experiencePenalty ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_highest_skill_level_attained:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.highestSkillLevelAttained ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_ranked_games_completed:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.matchmadeRankedGamesCompleted ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_ranked_games_played:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.matchmadeRankedGamesPlayed ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_ranked_games_won:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.matchmadeRankedGamesWon ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_unranked_games_completed:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.matchmadeUnrankedGamesCompleted ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_unranked_games_played:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.matchmadeUnrankedGamesPlayed ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_unranked_games_won:
                        result.type = this._online_data_integer;
                        result.dataAsLong = BigInt(globalData?.matchmadeUnrankedGamesWon ?? 0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_first_game_played_date:
                        result.type = this._online_data_integer;
                        result.dataAsLong = globalData?.firstGamePlayedDate ?? BigInt(0);
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_last_game_played_date:
                        result.type = this._online_data_integer;
                        result.dataAsLong = globalData?.lastGamePlayedDate ?? BigInt(0);
                        return result;
                }
            } else if (
                leaderboardId >= this._online_leaderboard_id_hopper_0 &&
                leaderboardId <= this._online_leaderboard_id_hopper_31
            ) {
                if (
                    columnId >= this._online_leaderboard_column_id_hopper_0_skill &&
                    columnId <= this._online_leaderboard_column_id_hopper_31_experience_penalty
                ) {
                    const columnOffset = columnId - this._online_leaderboard_column_id_hopper_0_skill;
                    const columnType = columnOffset % 6;

                    const hopperData = statsCache.hopperStats;

                    result.type = this._online_data_integer;
                    switch (columnType) {
                        case 0:
                            result.dataAsLong = BigInt(hopperData?.skill ?? 0);
                            break;
                        case 1:
                            result.dataAsLong = BigInt(hopperData?.gamesCompleted ?? 0);
                            break;
                        case 2:
                            result.dataAsLong = BigInt(hopperData?.gamesPlayed ?? 0);
                            break;
                        case 3:
                            result.dataAsLong = BigInt(hopperData?.gamesWon ?? 0);
                            break;
                        case 4:
                            result.dataAsLong = BigInt(hopperData?.expBase ?? 0);
                            break;
                        case 5:
                            result.dataAsLong = BigInt(hopperData?.expPenalty ?? 0);
                            break;
                        default:
                            result.dataAsLong = BigInt(0);
                            break;
                    }
                    return result;
                }
            }
        } catch (error) {
            this.logger.warn(
                `Error getting stat value for columnId=${columnId}, leaderboardId=${leaderboardId}, playerXuid=${playerXuid}`,
            );
        }

        result.type = this._online_data_null;
        result.dataAsLong = BigInt(0);
        return result;
    }

    async buildStatsQueryResponseBlf(file: Express.Multer.File): Promise<StreamableFile> {
        this.logger.log(`Building stats query response - file size: ${file.buffer.length}, buffer preview: ${file.buffer.slice(0, 16).toString('hex')}`);
        
        let fileData;
        try {
            // Read as a full BLF file (matches s_blffile_stats_query structure)
            fileData = SBlfFileStatsQuerySchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse stats query BLF: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Buffer length: ${file.buffer.length}, first 64 bytes: ${file.buffer.slice(0, 64).toString('hex')}`);
            throw new Error(`Invalid BLF format: ${error instanceof Error ? error.message : String(error)}`);
        }
        const request = fileData.xsqq;
        const { xuidCount, xuids, specCount, specs } = request;

        const actualLeaderboardCount = Math.min(specCount, 4);
        const leaderboardIds = new Set<number>();
        const xuidsSet = new Set<bigint>();
        const actualRowCount = Math.min(xuidCount, 16);

        for (let specIndex = 0; specIndex < actualLeaderboardCount; specIndex++) {
            leaderboardIds.add(specs[specIndex].viewId);
        }

        for (let xuidIndex = 0; xuidIndex < actualRowCount; xuidIndex++) {
            xuidsSet.add(xuids[xuidIndex]);
        }

        const statsCache = await this.fetchAllStatsAsync(Array.from(leaderboardIds), Array.from(xuidsSet));

        const leaderboards: s_stats_query_response_leaderboard[] = [];

        for (let specIndex = 0; specIndex < actualLeaderboardCount; specIndex++) {
            const spec = specs[specIndex];
            const rows: s_stats_query_response_row[] = [];

            for (let xuidIndex = 0; xuidIndex < actualRowCount; xuidIndex++) {
                const stats: s_stats_query_response_column[] = [];
                const actualStatCount = Math.min(spec.numColumnIds, 64);

                for (let columnIndex = 0; columnIndex < actualStatCount; columnIndex++) {
                    const columnId = spec.columnIds[columnIndex];
                    const stat: s_stats_query_response_column = {
                        id: columnId,
                        data: this.getStatValue(columnId, spec.viewId, xuids[xuidIndex], statsCache),
                    };
                    stats.push(stat);
                }

                // Pad stats array to required length (64)
                while (stats.length < 64) {
                    stats.push({
                        id: 0,
                        data: {
                            type: this._online_data_null,
                            dataAsLong: BigInt(0),
                            dataAsDouble: 0,
                            extension: BigInt(0),
                        },
                    });
                }

                const row: s_stats_query_response_row = {
                    xuid: xuids[xuidIndex],
                    gamertag: '',
                    statCount: actualStatCount,
                    stats: stats as any,
                };
                rows.push(row);
            }

            // Pad rows array to required length (16)
            while (rows.length < 16) {
                rows.push({
                    xuid: BigInt(0),
                    gamertag: '',
                    statCount: 0,
                    stats: Array(64).fill(null).map(() => ({
                        id: 0,
                        data: {
                            type: this._online_data_null,
                            dataAsLong: BigInt(0),
                            dataAsDouble: 0,
                            extension: BigInt(0),
                        },
                    })) as any,
                });
            }

            const leaderboard: s_stats_query_response_leaderboard = {
                leaderboardId: spec.viewId,
                rowCount: actualRowCount,
                rows: rows as any,
            };
            leaderboards.push(leaderboard);
        }

        // Pad leaderboards array to required length (4)
        while (leaderboards.length < 4) {
            leaderboards.push({
                leaderboardId: 0,
                rowCount: 0,
                rows: Array(16).fill(null).map(() => ({
                    xuid: BigInt(0),
                    gamertag: '',
                    statCount: 0,
                    stats: Array(64).fill(null).map(() => ({
                        id: 0,
                        data: {
                            type: this._online_data_null,
                            dataAsLong: BigInt(0),
                            dataAsDouble: 0,
                            extension: BigInt(0),
                        },
                    })) as any,
                })) as any,
            });
        }

        return new StreamableFile(SBlfFileStatsQueryResponseSchema.write({
            _blf: DEFAULT_BLF_CHUNK,
            athr: ARES_LIVE_AUTHOR,
            xsqr: {
                leaderboardCount: actualLeaderboardCount,
                leaderboards: leaderboards as any,
            },
            _eof: DEFAULT_EOF_CHUNK,
        }));
    }
}

