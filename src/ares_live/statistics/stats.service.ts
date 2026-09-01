import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
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
     * Parses a stats write BLF uploaded by the game client and persists the results.
     *
     * The game emits up to four s_online_stat_write "views" per player: a skill view
     * (leaderboard 0), a hopper view (leaderboard 3..96) and global arbitrated/unarbitrated
     * views (leaderboard 1/2). Each view is a list of s_online_property values keyed by
     * e_online_property_id. Counters accumulate; skill level / dates are set.
     *
     * The skill leaderboard (0) carries TrueSkill update inputs (draw-probability, beta, tau,
     * relative score, team) rather than the final mu/sigma distribution, so recomputing
     * player_stats_hopper_skill would require a full server-side TrueSkill pass with match
     * correlation. That is intentionally left as a follow-up; those views are skipped here.
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

        this.logger.log(`Processing stats write for session ${sessionId} (xuid=${xuid}, writeCount=${writeCount})`);

        for (let writeIndex = 0; writeIndex < writeCount; writeIndex++) {
            const write = request.writes[writeIndex];
            const leaderboardId = write.leaderboardId;
            const propertyCount = Math.min(write.propertyCount, write.properties.length);
            const properties = write.properties.slice(0, propertyCount);

            if (leaderboardId === this._online_leaderboard_id_skill) {
                // TrueSkill mu/sigma recompute not implemented yet (see method doc comment). The
                // session id is now carried on the write so a future implementation can correlate
                // all of a match's writes and run the update.
                this.logger.log(
                    `Skipping skill-leaderboard stat write for session ${sessionId} xuid=${xuid} (TrueSkill mu/sigma recompute not implemented)`,
                );
                continue;
            }

            if (xuid === BigInt(0)) {
                this.logger.warn(`Skipping stat write with no xuid for session ${sessionId} leaderboard ${leaderboardId}`);
                continue;
            }

            try {
                if (
                    leaderboardId >= this._online_leaderboard_id_hopper_0 &&
                    leaderboardId <= this._online_leaderboard_id_hopper_31
                ) {
                    await this.applyHopperStatWrite(leaderboardId, xuid, properties, sessionId);
                } else if (
                    leaderboardId === this._online_leaderboard_id_global_arbitrated ||
                    leaderboardId === this._online_leaderboard_id_global_unarbitrated
                ) {
                    await this.applyGlobalStatWrite(leaderboardId, xuid, properties, sessionId);
                } else {
                    this.logger.warn(`Unrecognized leaderboard id ${leaderboardId} in stat write for session ${sessionId} xuid=${xuid}`);
                }
            } catch (error) {
                this.logger.error(
                    `Failed to persist stat write for session ${sessionId} leaderboard ${leaderboardId} xuid=${xuid}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
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

    private async applyHopperStatWrite(
        leaderboardId: number,
        xuid: bigint,
        properties: s_online_property[],
        sessionId: string,
    ): Promise<void> {
        const key = {
            leaderboard_id_player_xuid: {
                leaderboard_id: leaderboardId,
                player_xuid: xuid.toString(),
            },
        };

        const existing = await this.prisma.ares_player_stats_hopper.findUnique({ where: key });

        let skill = existing?.skill ?? 0;
        let gamesCompleted = existing?.games_completed ?? 0;
        let gamesPlayed = existing?.games_played ?? 0;
        let gamesWon = existing?.games_won ?? 0;
        let expBase = existing?.exp_base ?? 0;
        let expPenalty = existing?.exp_penalty ?? 0;

        for (const property of properties) {
            const value = this.readOnlineDataAsNumber(property.data);
            if (value === null) {
                continue;
            }
            switch (property.id) {
                case this._online_property_id_hopper_skill:
                    skill = value; // current skill level, set rather than accumulated
                    break;
                case this._online_property_id_hopper_games_played:
                    gamesPlayed += value;
                    break;
                case this._online_property_id_hopper_games_completed:
                    gamesCompleted += value;
                    break;
                case this._online_property_id_hopper_games_won:
                    gamesWon += value;
                    break;
                case this._online_property_id_hopper_experience_base:
                    expBase += value;
                    break;
                case this._online_property_id_hopper_experience_penalty:
                    expPenalty += value;
                    break;
                default:
                    break; // _online_property_unused and unrelated ids are ignored
            }
        }

        const data = {
            skill,
            games_completed: gamesCompleted,
            games_played: gamesPlayed,
            games_won: gamesWon,
            exp_base: expBase,
            exp_penalty: expPenalty,
        };

        await this.prisma.ares_player_stats_hopper.upsert({
            where: key,
            create: {
                leaderboard_id: leaderboardId,
                player_xuid: xuid.toString(),
                ...data,
            },
            update: data,
        });

        this.logger.log(`Persisted hopper stat write for session ${sessionId} leaderboard ${leaderboardId} xuid=${xuid}`);
    }

    private async applyGlobalStatWrite(
        leaderboardId: number,
        xuid: bigint,
        properties: s_online_property[],
        sessionId: string,
    ): Promise<void> {
        const key = {
            leaderboard_id_player_xuid: {
                leaderboard_id: leaderboardId,
                player_xuid: xuid.toString(),
            },
        };

        const existing = await this.prisma.ares_player_stats_global.findUnique({ where: key });

        let customGamesCompleted = existing?.custom_games_completed ?? 0;
        let customGamesWon = existing?.custom_games_won ?? 0;
        let experienceBase = existing?.experience_base ?? 0;
        let experiencePenalty = existing?.experience_penalty ?? 0;
        let highestSkillLevelAttained = existing?.highest_skill_level_attained ?? 0;
        let matchmadeRankedGamesPlayed = existing?.matchmade_ranked_games_played ?? 0;
        let matchmadeRankedGamesCompleted = existing?.matchmade_ranked_games_completed ?? 0;
        let matchmadeRankedGamesWon = existing?.matchmade_ranked_games_won ?? 0;
        let matchmadeUnrankedGamesPlayed = existing?.matchmade_unranked_games_played ?? 0;
        let matchmadeUnrankedGamesCompleted = existing?.matchmade_unranked_games_completed ?? 0;
        let matchmadeUnrankedGamesWon = existing?.matchmade_unranked_games_won ?? 0;
        let firstGamePlayedDate: bigint | null = existing?.first_game_played_date
            ? BigInt(existing.first_game_played_date.toString())
            : null;
        let lastGamePlayedDate: bigint | null = existing?.last_game_played_date
            ? BigInt(existing.last_game_played_date.toString())
            : null;

        for (const property of properties) {
            const value = this.readOnlineDataAsNumber(property.data);
            if (value === null) {
                continue;
            }
            switch (property.id) {
                case this._online_property_id_global_experience_base:
                    experienceBase += value;
                    break;
                case this._online_property_id_global_experience_penalty:
                    experiencePenalty += value;
                    break;
                case this._online_property_id_global_highest_skill_level_attained:
                    highestSkillLevelAttained = Math.max(highestSkillLevelAttained, value);
                    break;
                case this._online_property_id_global_matchmade_ranked_games_played:
                    matchmadeRankedGamesPlayed += value;
                    break;
                case this._online_property_id_global_matchmade_ranked_games_completed:
                    matchmadeRankedGamesCompleted += value;
                    break;
                case this._online_property_id_global_matchmade_ranked_games_won:
                    matchmadeRankedGamesWon += value;
                    break;
                case this._online_property_id_global_matchmade_unranked_games_played:
                    matchmadeUnrankedGamesPlayed += value;
                    break;
                case this._online_property_id_global_matchmade_unranked_games_completed:
                    matchmadeUnrankedGamesCompleted += value;
                    break;
                case this._online_property_id_global_matchmade_unranked_games_won:
                    matchmadeUnrankedGamesWon += value;
                    break;
                case this._online_property_id_global_custom_games_completed:
                    customGamesCompleted += value;
                    break;
                case this._online_property_id_global_custom_games_won:
                    customGamesWon += value;
                    break;
                case this._online_property_id_global_first_game_played_date:
                    // Only record the first time we ever see the player play.
                    if (firstGamePlayedDate === null || firstGamePlayedDate === BigInt(0)) {
                        firstGamePlayedDate = BigInt(value);
                    }
                    break;
                case this._online_property_id_global_last_game_played_date:
                    lastGamePlayedDate = BigInt(value);
                    break;
                default:
                    break; // _online_property_unused and unrelated ids are ignored
            }
        }

        const data = {
            custom_games_completed: customGamesCompleted,
            custom_games_won: customGamesWon,
            experience_base: experienceBase,
            experience_penalty: experiencePenalty,
            highest_skill_level_attained: highestSkillLevelAttained,
            matchmade_ranked_games_played: matchmadeRankedGamesPlayed,
            matchmade_ranked_games_completed: matchmadeRankedGamesCompleted,
            matchmade_ranked_games_won: matchmadeRankedGamesWon,
            matchmade_unranked_games_played: matchmadeUnrankedGamesPlayed,
            matchmade_unranked_games_completed: matchmadeUnrankedGamesCompleted,
            matchmade_unranked_games_won: matchmadeUnrankedGamesWon,
            first_game_played_date: firstGamePlayedDate === null ? null : firstGamePlayedDate.toString(),
            last_game_played_date: lastGamePlayedDate === null ? null : lastGamePlayedDate.toString(),
        };

        await this.prisma.ares_player_stats_global.upsert({
            where: key,
            create: {
                leaderboard_id: leaderboardId,
                player_xuid: xuid.toString(),
                ...data,
            },
            update: data,
        });

        this.logger.log(`Persisted global stat write for session ${sessionId} leaderboard ${leaderboardId} xuid=${xuid}`);
    }
}

