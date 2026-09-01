import { Injectable, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/db/prisma.service';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { computeTrueSkillRatings, TrueSkillPlayerInput, TrueSkillPlayerResult } from './trueskill';
import { 
    SBlfFileStatsQuerySchema,
    SBlfFileStatsQueryResponseSchema,
    SBlfFileStatsWriteSchema,
    s_stats_query_response_leaderboard,
    s_stats_query_response_row,
    s_stats_query_response_column,
    s_online_property,
} from './stats.chunks';
import { ARES_LIVE_AUTHOR, DEFAULT_BLF_CHUNK, DEFAULT_EOF_CHUNK, s_online_data } from '../chunks';

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

    // e_online_property_id (see online_constants.h). These are the property ids the game
    // client emits on stat writes; the value is stored in each property's s_online_data.
    // Skill-leaderboard (id 0) TrueSkill inputs: the match parameters ride on the xuid=0 write,
    // the per-player placement/team ride on each player's write.
    private readonly _online_property_id_skill_draw_probability = 4;
    private readonly _online_property_id_skill_beta = 5;
    private readonly _online_property_id_skill_tau = 6;
    private readonly _online_property_id_relative_score = 7;
    private readonly _online_property_id_session_team = 8;
    private readonly _online_property_id_hopper_skill = 10;
    private readonly _online_property_id_hopper_games_played = 11;
    private readonly _online_property_id_hopper_games_completed = 12;
    private readonly _online_property_id_hopper_games_won = 13;
    private readonly _online_property_id_hopper_experience_base = 14;
    private readonly _online_property_id_hopper_experience_penalty = 15;
    private readonly _online_property_id_global_experience_base = 16;
    private readonly _online_property_id_global_experience_penalty = 17;
    private readonly _online_property_id_global_highest_skill_level_attained = 18;
    private readonly _online_property_id_global_matchmade_ranked_games_played = 19;
    private readonly _online_property_id_global_matchmade_ranked_games_completed = 20;
    private readonly _online_property_id_global_matchmade_ranked_games_won = 21;
    private readonly _online_property_id_global_matchmade_unranked_games_played = 22;
    private readonly _online_property_id_global_matchmade_unranked_games_completed = 23;
    private readonly _online_property_id_global_matchmade_unranked_games_won = 24;
    private readonly _online_property_id_global_custom_games_completed = 26;
    private readonly _online_property_id_global_custom_games_won = 27;
    private readonly _online_property_id_global_first_game_played_date = 28;
    private readonly _online_property_id_global_last_game_played_date = 29;

    private readonly _stat_write_schema: Record<number, {
        target: 'hopper' | 'global';
        column: string;
        method: 'sum' | 'max' | 'min' | 'set';
        isDate?: boolean;
    }> = {
        [this._online_property_id_hopper_skill]:              { target: 'hopper', column: 'skill', method: 'max' },
        [this._online_property_id_hopper_games_played]:       { target: 'hopper', column: 'games_played', method: 'sum' },
        [this._online_property_id_hopper_games_completed]:    { target: 'hopper', column: 'games_completed', method: 'sum' },
        [this._online_property_id_hopper_games_won]:          { target: 'hopper', column: 'games_won', method: 'sum' },
        [this._online_property_id_hopper_experience_base]:    { target: 'hopper', column: 'exp_base', method: 'sum' },
        [this._online_property_id_hopper_experience_penalty]: { target: 'hopper', column: 'exp_penalty', method: 'max' },

        [this._online_property_id_global_experience_base]:              { target: 'global', column: 'experience_base', method: 'sum' },
        [this._online_property_id_global_experience_penalty]:           { target: 'global', column: 'experience_penalty', method: 'max' },
        [this._online_property_id_global_highest_skill_level_attained]: { target: 'global', column: 'highest_skill_level_attained', method: 'max' },
        [this._online_property_id_global_matchmade_ranked_games_played]:      { target: 'global', column: 'matchmade_ranked_games_played', method: 'sum' },
        [this._online_property_id_global_matchmade_ranked_games_completed]:   { target: 'global', column: 'matchmade_ranked_games_completed', method: 'sum' },
        [this._online_property_id_global_matchmade_ranked_games_won]:         { target: 'global', column: 'matchmade_ranked_games_won', method: 'sum' },
        [this._online_property_id_global_matchmade_unranked_games_played]:    { target: 'global', column: 'matchmade_unranked_games_played', method: 'sum' },
        [this._online_property_id_global_matchmade_unranked_games_completed]: { target: 'global', column: 'matchmade_unranked_games_completed', method: 'sum' },
        [this._online_property_id_global_matchmade_unranked_games_won]:       { target: 'global', column: 'matchmade_unranked_games_won', method: 'sum' },
        [this._online_property_id_global_custom_games_completed]: { target: 'global', column: 'custom_games_completed', method: 'sum' },
        [this._online_property_id_global_custom_games_won]:       { target: 'global', column: 'custom_games_won', method: 'sum' },
        [this._online_property_id_global_first_game_played_date]: { target: 'global', column: 'first_game_played_date', method: 'min', isDate: true },
        [this._online_property_id_global_last_game_played_date]:  { target: 'global', column: 'last_game_played_date', method: 'set', isDate: true },
    };

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
            type: 'null',
            data: {
                data_as_null: {
                    padding: Array(16).fill(0) as any,
                },
            },
        };

        const key = `${leaderboardId}_${playerXuid}`;
        const statsCache = cache.get(key) || {};

        try {
            if (leaderboardId === this._online_leaderboard_id_skill) {
                if (columnId === this._online_leaderboard_column_id_skill_mu) {
                    result.type = 'double';
                    result.data = {
                        data_as_double: {
                            data: statsCache.hopperSkillStats?.mu ?? 25.0,
                        },
                    };
                    return result;
                } else if (columnId === this._online_leaderboard_column_id_skill_sigma) {
                    result.type = 'double';
                    result.data = {
                        data_as_double: {
                            data: statsCache.hopperSkillStats?.sigma ?? 8.333,
                        },
                    };
                    return result;
                }
            } else if (
                leaderboardId === this._online_leaderboard_id_global_arbitrated ||
                leaderboardId === this._online_leaderboard_id_global_unarbitrated
            ) {
                const globalData = statsCache.globalStats;

                switch (columnId) {
                    case this._online_leaderboard_column_id_global_unarbitrated_custom_games_completed:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.customGamesCompleted ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_unarbitrated_custom_games_won:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.customGamesWon ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_experience_base:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.experienceBase ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_experience_penalty:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.experiencePenalty ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_highest_skill_level_attained:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.highestSkillLevelAttained ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_ranked_games_completed:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.matchmadeRankedGamesCompleted ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_ranked_games_played:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.matchmadeRankedGamesPlayed ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_ranked_games_won:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.matchmadeRankedGamesWon ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_unranked_games_completed:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.matchmadeUnrankedGamesCompleted ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_unranked_games_played:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.matchmadeUnrankedGamesPlayed ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_matchmade_unranked_games_won:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: BigInt(globalData?.matchmadeUnrankedGamesWon ?? 0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_first_game_played_date:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: globalData?.firstGamePlayedDate ?? BigInt(0),
                            },
                        };
                        return result;
                    case this._online_leaderboard_column_id_global_arbitrated_last_game_played_date:
                        result.type = 'integer';
                        result.data = {
                            data_as_long: {
                                data: globalData?.lastGamePlayedDate ?? BigInt(0),
                            },
                        };
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

                    result.type = 'integer';
                    let value: bigint;
                    switch (columnType) {
                        case 0:
                            value = BigInt(hopperData?.skill ?? 0);
                            break;
                        case 1:
                            value = BigInt(hopperData?.gamesCompleted ?? 0);
                            break;
                        case 2:
                            value = BigInt(hopperData?.gamesPlayed ?? 0);
                            break;
                        case 3:
                            value = BigInt(hopperData?.gamesWon ?? 0);
                            break;
                        case 4:
                            value = BigInt(hopperData?.expBase ?? 0);
                            break;
                        case 5:
                            value = BigInt(hopperData?.expPenalty ?? 0);
                            break;
                        default:
                            value = BigInt(0);
                            break;
                    }
                    result.data = {
                        data_as_long: {
                            data: value,
                        },
                    };
                    return result;
                }
            }
        } catch (error) {
            this.logger.warn(
                `Error getting stat value for columnId=${columnId}, leaderboardId=${leaderboardId}, playerXuid=${playerXuid}`,
            );
        }

        result.type = 'null';
        result.data = {
            data_as_null: {
                padding: Array(16).fill(0) as any,
            },
        };
        return result;
    }

    async buildStatsQueryResponseBlf(file: Express.Multer.File): Promise<{ buffer: Buffer; size: number }> {
        let fileData;
        try {
            // Read as a full BLF file (matches s_blffile_stats_query structure)
            fileData = SBlfFileStatsQuerySchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse stats query BLF: ${error instanceof Error ? error.message : String(error)}`);
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
                const actualStatCount = Math.min(spec.numColumnIds, 32); // Max 32 stats per row (matches resym: stats[32])

                for (let columnIndex = 0; columnIndex < actualStatCount; columnIndex++) {
                    const columnId = spec.columnIds[columnIndex];
                    const stat: s_stats_query_response_column = {
                        id: columnId,
                        data: this.getStatValue(columnId, spec.viewId, xuids[xuidIndex], statsCache),
                    };
                    stats.push(stat);
                }

                // Pad stats array to required length (32) - matches resym: stats[32]
                while (stats.length < 32) {
                    stats.push({
                        id: 0,
                        data: {
                            type: 'null' as const,
                            data: {
                                data_as_null: {
                                    padding: Array(16).fill(0) as any,
                                },
                            },
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
                    stats: Array(32).fill(null).map(() => ({
                        id: 0,
                        data: {
                            type: 'null' as const,
                            data: {
                                data_as_null: {
                                    padding: Array(16).fill(0) as any,
                                },
                            },
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
                    stats: Array(32).fill(null).map(() => ({
                        id: 0,
                        data: {
                            type: 'null' as const,
                            data: {
                                data_as_null: {
                                    padding: Array(16).fill(0) as any,
                                },
                            },
                        },
                    })) as any,
                })) as any,
            });
        }

        const buffer = SBlfFileStatsQueryResponseSchema.write({
            _blf: DEFAULT_BLF_CHUNK,
            athr: ARES_LIVE_AUTHOR,
            xsqr: {
                leaderboardCount: actualLeaderboardCount,
                leaderboards: leaderboards as any,
            },
            _eof: DEFAULT_EOF_CHUNK,
        });
        return { buffer, size: buffer.length };
    }

    /**
     * Reads a numeric value out of an s_online_data union based on its type tag.
     * The CUnion reader materializes every variant from the same bytes, so we must
     * pick the correct one using the discriminating `type`.
     */
    private readOnlineDataAsNumber(onlineData: s_online_data): number | null {
        try {
            switch (onlineData.type) {
                case 'integer': {
                    // s_online_data::data_as_long is a 32-bit signed `long` in game code.
                    const value = onlineData.data?.data_as_long?.data;
                    return value === undefined ? null : Number(BigInt.asIntN(32, BigInt(value)));
                }
                case 'qword': {
                    const value = onlineData.data?.data_as_qword?.data;
                    return value === undefined ? null : Number(value);
                }
                case 'double': {
                    const value = onlineData.data?.data_as_double?.data;
                    return value === undefined ? null : value;
                }
                case 'float': {
                    const value = onlineData.data?.data_as_float?.data;
                    return value === undefined ? null : value;
                }
                case 'date_time': {
                    const value = onlineData.data?.data_as_date_time?.data;
                    return value === undefined ? null : Number(value);
                }
                default:
                    return null;
            }
        } catch {
            return null;
        }
    }

    /**
     * Parses a stats write BLF uploaded by the game client and stages the results.
     *
     * The game emits up to four s_online_stat_write "views" per player: a skill view
     * (leaderboard 0), a hopper view (leaderboard 3..96) and global arbitrated/unarbitrated
     * views (leaderboard 1/2). Each view is a list of s_online_property values keyed by
     * e_online_property_id.
     *
     * Writes are not applied to the player_stats_* tables immediately. They are staged into
     * ares_sessions_stat_writes keyed by the match's session id and only folded into the player
     * tables (and used for a TrueSkill pass) when the game reports session end, at which point the
     * whole match's writes are correlated. See finalizeSessionStatsAsync. The skill view is staged
     * too because it carries the TrueSkill inputs (draw-probability/beta/tau on the xuid=0 view;
     * relative-score/team on each player's view).
     */
    async processStatsWriteBlf(file: Express.Multer.File): Promise<void> {
        let fileData;
        try {
            fileData = SBlfFileStatsWriteSchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse stats write BLF: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Invalid BLF format: ${error instanceof Error ? error.message : String(error)}`);
        }

        const request = fileData.xswq;
        const xuid = request.xuid;
        const writeCount = Math.min(request.writeCount, request.writes.length);
        const sessionId = this.formatSessionId(request.sessionId.data);

        // Without a resolved session id we cannot correlate this write to a match, and it would
        // never be finalized (session end matches on session id), so drop it rather than orphan it.
        if (sessionId === 'UNKNOWN' || sessionId === 'INVALID') {
            this.logger.warn(`Dropping stats write with unresolved session id (xuid=${xuid}, writeCount=${writeCount})`);
            return;
        }

        const rows: {
            session_id: string;
            player_xuid: string;
            leaderboard_id: number;
            properties: { id: number; value: string }[];
        }[] = [];

        for (let writeIndex = 0; writeIndex < writeCount; writeIndex++) {
            const write = request.writes[writeIndex];
            const leaderboardId = write.leaderboardId;
            const propertyCount = Math.min(write.propertyCount, write.properties.length);

            const properties: { id: number; value: string }[] = [];
            for (let propertyIndex = 0; propertyIndex < propertyCount; propertyIndex++) {
                const property = write.properties[propertyIndex];
                const value = this.stageOnlineDataToString(property.data);
                if (value === null) {
                    continue; // unused terminator / unreadable variant
                }
                properties.push({ id: property.id, value });
            }

            if (properties.length === 0) {
                continue;
            }

            rows.push({
                session_id: sessionId,
                player_xuid: xuid.toString(),
                leaderboard_id: leaderboardId,
                properties,
            });
        }

        if (rows.length === 0) {
            return;
        }

        await this.prisma.ares_sessions_stat_writes.createMany({ data: rows });
        this.logger.log(`Staged ${rows.length} stat write view(s) for session ${sessionId} (xuid=${xuid})`);
    }

    /**
     * Serializes an s_online_data value to a lossless decimal/float string for staging. Integer,
     * qword and date/time variants keep full 64-bit precision via bigint; float/double keep their
     * fractional value. Returns null for variants that carry no usable number (e.g. null).
     */
    private stageOnlineDataToString(onlineData: s_online_data): string | null {
        if (onlineData.type === 'double' || onlineData.type === 'float') {
            const value = this.readOnlineDataAsNumber(onlineData);
            return value === null ? null : value.toString();
        }
        const value = this.readOnlineDataAsBigInt(onlineData);
        return value === null ? null : value.toString();
    }

    /**
     * Formats an 8-byte transport secure identifier as uppercase hex with a colon in the middle
     * (e.g. E0B4722A:24253947), matching the session service representation. An all-zero id means
     * the client could not resolve the session handle.
     */
    private formatSessionId(sessionIdBytes: number[] | Buffer | Uint8Array): string {
        const bytes = Array.from(sessionIdBytes);
        if (bytes.length !== 8) {
            return 'INVALID';
        }
        if (bytes.every((b) => b === 0)) {
            return 'UNKNOWN';
        }
        const firstPart = Buffer.from(bytes.slice(0, 4)).toString('hex').toUpperCase();
        const secondPart = Buffer.from(bytes.slice(4, 8)).toString('hex').toUpperCase();
        return `${firstPart}:${secondPart}`;
    }

    /**
     * Finalizes a match's staged stat writes when the game reports session end. All views staged
     * under this session id are correlated and applied at once: non-skill views are folded into the
     * player_stats_* tables (schema-driven accumulation), and the skill views are run through a
     * TrueSkill update. Everything is applied in a single transaction that also clears the staged
     * rows, so a repeated session-end (or a client retry) is idempotent — the second call finds no
     * staged rows and does nothing.
     */
    async finalizeSessionStatsAsync(sessionId: string): Promise<void> {
        const staged = await this.prisma.ares_sessions_stat_writes.findMany({
            where: { session_id: sessionId },
            orderBy: { id: 'asc' },
        });

        if (staged.length === 0) {
            this.logger.log(`Session ${sessionId} finalize: no staged stat writes`);
            return;
        }

        // Group non-skill views per (target, leaderboard, player) so the whole match's writes for a
        // player fold together, and collect the skill views for the TrueSkill pass.
        const accumGroups = new Map<
            string,
            { target: 'hopper' | 'global'; leaderboardId: number; xuid: bigint; props: { id: number; value: string }[] }
        >();
        const skillParamProps: { id: number; value: string }[] = [];
        const skillPlayerRows: { xuid: bigint; props: { id: number; value: string }[] }[] = [];

        for (const row of staged) {
            const leaderboardId = Number(row.leaderboard_id);
            const xuid = BigInt(row.player_xuid.toString());
            const props = Array.isArray(row.properties)
                ? (row.properties as unknown as { id: number; value: string }[]).map((p) => ({
                      id: Number(p.id),
                      value: String(p.value),
                  }))
                : [];

            if (leaderboardId === this._online_leaderboard_id_skill) {
                // The match parameters ride on the xuid=0 view; each player's placement/team on theirs.
                if (xuid === BigInt(0)) {
                    skillParamProps.push(...props);
                } else {
                    skillPlayerRows.push({ xuid, props });
                }
                continue;
            }

            if (xuid === BigInt(0)) {
                continue; // non-skill view with no player to attribute
            }

            let target: 'hopper' | 'global' | null = null;
            if (
                leaderboardId >= this._online_leaderboard_id_hopper_0 &&
                leaderboardId <= this._online_leaderboard_id_hopper_31
            ) {
                target = 'hopper';
            } else if (
                leaderboardId === this._online_leaderboard_id_global_arbitrated ||
                leaderboardId === this._online_leaderboard_id_global_unarbitrated
            ) {
                target = 'global';
            } else {
                this.logger.warn(`Session ${sessionId} finalize: unrecognized leaderboard id ${leaderboardId} (xuid=${xuid})`);
                continue;
            }

            const key = `${target}:${leaderboardId}:${xuid}`;
            const group = accumGroups.get(key) ?? { target, leaderboardId, xuid, props: [] };
            group.props.push(...props);
            accumGroups.set(key, group);
        }

        // Compute TrueSkill first, in memory, so a failure here never rolls back the accumulation.
        let skillResults: TrueSkillPlayerResult[] | null = null;
        try {
            skillResults = await this.computeSessionTrueSkill(sessionId, skillParamProps, skillPlayerRows);
        } catch (error) {
            this.logger.error(
                `Session ${sessionId} finalize: TrueSkill computation failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            skillResults = null;
        }

        await this.prisma.$transaction(async (tx) => {
            for (const group of accumGroups.values()) {
                await this.applyAccumulatedWrite(tx, group.target, group.leaderboardId, group.xuid, group.props);
            }

            if (skillResults) {
                for (const result of skillResults) {
                    const key = {
                        leaderboard_id_player_xuid: {
                            leaderboard_id: this._online_leaderboard_id_skill,
                            player_xuid: result.xuid,
                        },
                    };
                    await tx.ares_player_stats_hopper_skill.upsert({
                        where: key,
                        create: {
                            leaderboard_id: this._online_leaderboard_id_skill,
                            player_xuid: result.xuid,
                            mu: result.mu,
                            sigma: result.sigma,
                        },
                        update: { mu: result.mu, sigma: result.sigma },
                    });
                }
            }

            await tx.ares_sessions_stat_writes.deleteMany({ where: { session_id: sessionId } });
        });

        this.logger.log(
            `Session ${sessionId} finalize complete: applied ${accumGroups.size} accumulation group(s)` +
                (skillResults ? `, updated TrueSkill for ${skillResults.length} player(s)` : ', no TrueSkill update'),
        );
    }

    /**
     * Reads the current player row and folds all of a match's staged properties for it into the
     * destination table via the declarative _stat_write_schema (counters sum, skill/high scores
     * keep their peak, first-played keeps the earliest, last-played overwrites).
     */
    private async applyAccumulatedWrite(
        tx: Prisma.TransactionClient,
        target: 'hopper' | 'global',
        leaderboardId: number,
        xuid: bigint,
        stagedProps: { id: number; value: string }[],
    ): Promise<void> {
        const key = {
            leaderboard_id_player_xuid: {
                leaderboard_id: leaderboardId,
                player_xuid: xuid.toString(),
            },
        };

        if (target === 'hopper') {
            const existing = await tx.ares_player_stats_hopper.findUnique({ where: key });
            const data = this.buildStatWritePatch(target, existing, stagedProps);
            if (data === null) {
                return;
            }
            await tx.ares_player_stats_hopper.upsert({
                where: key,
                // hopper columns are NOT NULL, so any counter this match did not touch defaults to 0 on insert
                create: {
                    leaderboard_id: leaderboardId,
                    player_xuid: xuid.toString(),
                    skill: 0,
                    games_completed: 0,
                    games_played: 0,
                    games_won: 0,
                    exp_base: 0,
                    exp_penalty: 0,
                    ...data,
                } as any,
                update: data as any,
            });
        } else {
            const existing = await tx.ares_player_stats_global.findUnique({ where: key });
            const data = this.buildStatWritePatch(target, existing, stagedProps);
            if (data === null) {
                return;
            }
            await tx.ares_player_stats_global.upsert({
                where: key,
                create: {
                    leaderboard_id: leaderboardId,
                    player_xuid: xuid.toString(),
                    ...data,
                } as any,
                update: data as any,
            });
        }
    }

    /**
     * Builds the TrueSkill inputs for a session from its staged skill views (match parameters +
     * per-player team/placement) and each player's stored prior rating, then computes the new
     * ratings. Returns null when there is not enough data for a meaningful update (fewer than two
     * teams, or missing match parameters), which is logged and treated as "no TrueSkill this match".
     */
    private async computeSessionTrueSkill(
        sessionId: string,
        skillParamProps: { id: number; value: string }[],
        skillPlayerRows: { xuid: bigint; props: { id: number; value: string }[] }[],
    ): Promise<TrueSkillPlayerResult[] | null> {
        if (skillPlayerRows.length < 2) {
            this.logger.log(`Session ${sessionId} finalize: not enough skill views for TrueSkill (${skillPlayerRows.length})`);
            return null;
        }

        const paramMap = new Map<number, string>();
        for (const prop of skillParamProps) {
            paramMap.set(prop.id, prop.value);
        }
        const betaRaw = paramMap.get(this._online_property_id_skill_beta);
        const tauRaw = paramMap.get(this._online_property_id_skill_tau);
        const drawRaw = paramMap.get(this._online_property_id_skill_draw_probability);
        if (betaRaw === undefined || tauRaw === undefined) {
            this.logger.warn(`Session ${sessionId} finalize: missing TrueSkill match parameters (beta/tau); skipping`);
            return null;
        }

        // Fold each player's skill view to its team and placement score (last value wins).
        const players: { xuid: string; team: number; relativeScore: number }[] = [];
        for (const row of skillPlayerRows) {
            let team: number | null = null;
            let relativeScore = 0;
            for (const prop of row.props) {
                if (prop.id === this._online_property_id_session_team) {
                    team = Number(prop.value);
                } else if (prop.id === this._online_property_id_relative_score) {
                    relativeScore = Number(prop.value);
                }
            }
            if (team === null || Number.isNaN(team)) {
                this.logger.warn(`Session ${sessionId} finalize: skill view for xuid=${row.xuid} missing team; skipping player`);
                continue;
            }
            players.push({ xuid: row.xuid.toString(), team, relativeScore });
        }

        if (players.length < 2) {
            return null;
        }

        const priorRows = await this.prisma.ares_player_stats_hopper_skill.findMany({
            where: {
                leaderboard_id: this._online_leaderboard_id_skill,
                player_xuid: { in: players.map((p) => p.xuid) },
            },
        });
        const priorMap = new Map<string, { mu: number; sigma: number }>();
        for (const prior of priorRows) {
            priorMap.set(prior.player_xuid.toString(), { mu: prior.mu, sigma: prior.sigma });
        }

        const inputs: TrueSkillPlayerInput[] = players.map((player) => {
            const prior = priorMap.get(player.xuid);
            return {
                xuid: player.xuid,
                team: player.team,
                relativeScore: player.relativeScore,
                priorMu: prior?.mu ?? null,
                priorSigma: prior?.sigma ?? null,
            };
        });

        return computeTrueSkillRatings(
            {
                drawProbability: drawRaw === undefined ? null : Number(drawRaw),
                beta: Number(betaRaw),
                tau: Number(tauRaw),
            },
            inputs,
        );
    }

    /**
     * Resolves staged properties against _stat_write_schema and folds each into the stored value
     * using its aggregation method. Returns a Prisma-ready patch (date columns serialized to string
     * for Decimal(20,0)) or null if no property mapped to this target.
     */
    private buildStatWritePatch(
        target: 'hopper' | 'global',
        existing: Record<string, unknown> | null,
        properties: { id: number; value: string }[],
    ): Record<string, number | string> | null {
        const changes = new Map<string, number | bigint>();

        for (const property of properties) {
            const mapping = this._stat_write_schema[property.id];
            if (!mapping || mapping.target !== target) {
                continue; // _online_property_unused, TrueSkill inputs and unrelated ids are ignored
            }

            if (mapping.isDate) {
                let incoming: bigint;
                try {
                    incoming = BigInt(property.value);
                } catch {
                    continue;
                }
                const current = this.currentBigIntValue(changes, existing, mapping.column);
                changes.set(mapping.column, this.aggregateBigInt(mapping.method, current, incoming));
            } else {
                const incoming = Number(property.value);
                if (Number.isNaN(incoming)) {
                    continue;
                }
                const current = this.currentNumberValue(changes, existing, mapping.column);
                changes.set(mapping.column, this.aggregateNumber(mapping.method, current, incoming));
            }
        }

        if (changes.size === 0) {
            return null;
        }

        const data: Record<string, number | string> = {};
        for (const [column, value] of changes) {
            // Decimal(20,0) date columns are written as strings to preserve full 64-bit precision.
            data[column] = typeof value === 'bigint' ? value.toString() : value;
        }
        return data;
    }

    /** The running value for a column: a change already staged this write, else the stored row value. */
    private currentNumberValue(
        changes: Map<string, number | bigint>,
        existing: Record<string, unknown> | null,
        column: string,
    ): number | null {
        if (changes.has(column)) {
            return changes.get(column) as number;
        }
        const stored = existing?.[column];
        return stored === undefined || stored === null ? null : Number(stored);
    }

    private currentBigIntValue(
        changes: Map<string, number | bigint>,
        existing: Record<string, unknown> | null,
        column: string,
    ): bigint | null {
        if (changes.has(column)) {
            return changes.get(column) as bigint;
        }
        const stored = existing?.[column];
        return stored === undefined || stored === null ? null : BigInt(String(stored));
    }

    /** Folds an incoming integer value into the stored value per the aggregation method. */
    private aggregateNumber(method: 'sum' | 'max' | 'min' | 'set', current: number | null, incoming: number): number {
        if (current === null) {
            return incoming;
        }
        switch (method) {
            case 'sum':
                return current + incoming;
            case 'max':
                return Math.max(current, incoming);
            case 'min':
                return Math.min(current, incoming);
            case 'set':
                return incoming;
        }
    }

    /** Folds an incoming 64-bit value (dates) into the stored value per the aggregation method. */
    private aggregateBigInt(method: 'sum' | 'max' | 'min' | 'set', current: bigint | null, incoming: bigint): bigint {
        if (current === null) {
            return incoming;
        }
        switch (method) {
            case 'sum':
                return current + incoming;
            case 'max':
                return current > incoming ? current : incoming;
            case 'min':
                return current < incoming ? current : incoming;
            case 'set':
                return incoming;
        }
    }

    /**
     * Reads an s_online_data union as a 64-bit integer, used for date columns so large FILETIME /
     * millisecond timestamps keep full precision (unlike readOnlineDataAsNumber, which narrows to
     * a JS number). Returns null for non-integer variants.
     */
    private readOnlineDataAsBigInt(onlineData: s_online_data): bigint | null {
        try {
            switch (onlineData.type) {
                case 'integer': {
                    const value = onlineData.data?.data_as_long?.data;
                    return value === undefined ? null : BigInt.asIntN(32, BigInt(value));
                }
                case 'qword': {
                    const value = onlineData.data?.data_as_qword?.data;
                    return value === undefined ? null : BigInt(value);
                }
                case 'date_time': {
                    const value = onlineData.data?.data_as_date_time?.data;
                    return value === undefined ? null : BigInt(value);
                }
                default:
                    return null;
            }
        } catch {
            return null;
        }
    }
}

