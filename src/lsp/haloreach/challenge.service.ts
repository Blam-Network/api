import { Inject, Injectable } from "@nestjs/common";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { reach_player_data_nameplate } from "@prisma/client";
import { CAMPAIGN_COMMENDATIONS, COMMENDATIONS_FROM_DB_MAP, FIREFIGHT_COMMENDATIONS, MATCHMAKING_COMMENDATIONS } from "./commendations";

const CHALLENGES_ENABLED = true;

@Injectable()
export class HaloReachChallengeService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    private useNewChallengeSystem = async (xuid: BigInt): Promise<boolean> => {
        const playerData = await this.prisma.reach_player_data.findUnique({ where: { player_xuid: xuid.toString() } });
        return !!playerData?.is_bungie
    }

    private getNextDailyResetDate = (now = new Date()): Date => {
        const next = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            11, 0, 0, 0
        ));

        // If it's already past 11:00 UTC today, move to tomorrow
        if (now.getTime() >= next.getTime()) {
            next.setUTCDate(next.getUTCDate() + 1);
        }

        return next;
    }

    private getNextWeeklyResetDate = (now = new Date()): Date => {
        const next = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            11, 0, 0, 0
        ));

        const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
        const daysUntilNextMonday = (8 - day) % 7 || 7; // ensures 1–7 range

        // If today is Monday but past 11:00, move to next Monday
        if (day === 1 && now.getTime() < next.getTime()) {
            return next;
        }

        next.setUTCDate(next.getUTCDate() + daysUntilNextMonday);
        return next;
    }

    public getActiveChallenges = async (xuid: BigInt): Promise<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_challenge_state> => {
        if (!CHALLENGES_ENABLED || !await this.useNewChallengeSystem(xuid)) {
            return {
                active_challenge_set_1: 0,
                active_challenge_set_2: 0,
                chalenge_set_1: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_challenge_state>(10).fill({
                    category: 0,
                    index: 0,
                    reward_credits: 0,
                    unknown4: new Array<number>(24).fill(0, 0, 24)
                }),
                chalenge_set_2: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_challenge_state>(10).fill({
                    category: 0,
                    index: 0,
                    reward_credits: 0,
                    unknown4: new Array<number>(24).fill(0, 0, 24)
                }),
                chalenge_set_1_count: 0,
                chalenge_set_2_count: 0,
                chalenge_set_1_timestamp: new Date(),
                chalenge_set_2_timestamp: new Date(),
            }
        }

        return {
            active_challenge_set_1: 1,
            active_challenge_set_2: 1,
            chalenge_set_1_count: 5,
            chalenge_set_2_count: 10,
            chalenge_set_1_timestamp: this.getNextDailyResetDate(),
            chalenge_set_2_timestamp: this.getNextWeeklyResetDate(),
            chalenge_set_1: [
            {
                category: 0,
                index: 1,
                reward_credits: 2250,
                unknown4: [
                0, 0, 0, 75, // required points
                0, 0, 0, 15,
                0, 0, 0, 2,
                0, 0, 0, 34, // pretty sure this is skulls
                0, 0, 0, 4,
                0, 0, 0, 5
                ],
            },
            {
                category: 3,
                index: 1,
                reward_credits: 2000,
                unknown4: [
                0, 0, 0, 30, // required points
                0, 0, 0, 3,
                0, 0, 0, 2,
                0, 0, 0, 34, // pretty sure this is skulls
                0, 0, 0, 4,
                0, 0, 0, 5
                ],
            },
            {
                category: 2,
                index: 1,
                reward_credits: 5000,
                unknown4: [
                0, 1, 160, 134, // required points
                0, 0, 0, 3,
                0, 0, 0, 2,
                0, 0, 0, 0, // pretty sure this is skulls
                0, 0, 0, 4,
                0, 0, 0, 5
                ],
            },
            {
                category: 4,
                index: 1,
                reward_credits: 2100,
                unknown4: [
                0, 0, 0, 2, // required points
                0, 0, 0, 3,
                0, 0, 0, 2,
                0, 0, 0, 0, // pretty sure this is skulls
                0, 0, 0, 4,
                0, 0, 0, 5
                ],
            },
            ...new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_challenge_state>(5).fill({
                category: 3,
                index: 1,
                reward_credits: 9999,
                unknown4: [
                0, 0, 0, 7, // required points
                0, 0, 0, 3,
                0, 0, 0, 2,
                0, 0, 0, 34, // pretty sure this is skulls
                0, 0, 0, 4,
                0, 0, 0, 5
                ],
            })
            ],
            chalenge_set_2: [
                {
                    category: 1,
                    index: 1,
                    reward_credits: 14000,
                    unknown4: [
                        0, 0, 0, 1, // required points
                        0, 0, 0, 3,
                        0, 0, 0, 2,
                        0, 0, 0, 34, // pretty sure this is skulls
                        0, 0, 0, 4,
                        0, 0, 0, 5
                    ],
                },
                ...new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_challenge_state>(9).fill({
                    category: 0,
                    index: 0,
                    reward_credits: 0,
                    unknown4: [
                        0, 0, 0, 1,
                        0, 0, 0, 0,
                        0, 0, 0, 2,
                        0, 0, 0, 0,
                        0, 0, 0, 3,
                        0, 0, 0, 0
                    ]
                }),
            ]
        }
    }

    public getChallengeProgress = async (xuid: BigInt): Promise<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_challenge_progress> => {
        return await this.prisma.$transaction(async (tx) => {
            // Delete expired challenge progress...
            await tx.reach_player_challenge_progress.deleteMany({
                where: {
                    player_xuid: xuid.toString(),
                    expiresAt: { lte: new Date() }
                }
            })

            const activeChallenges = await this.getActiveChallenges(xuid);
            const activeChallengeProgress = await tx.reach_player_challenge_progress.findMany({
                where: {
                    player_xuid: xuid.toString(),
                }
            })

            const responseChallengeSet1Progress = Array<number>(10).fill(0, 0, 10);
            const responseChallengeSet2Progress = Array<number>(10).fill(0, 0, 10);

            activeChallengeProgress
                .filter(challengeProgress => challengeProgress.challenge_set === activeChallenges.active_challenge_set_1)
                .forEach(challengeProgress => {
                    responseChallengeSet1Progress[challengeProgress.challenge_index] = challengeProgress.progress
                })

            activeChallengeProgress
                .filter(challengeProgress => challengeProgress.challenge_set === activeChallenges.active_challenge_set_2)
                .forEach(challengeProgress => {
                    responseChallengeSet2Progress[challengeProgress.challenge_index] = challengeProgress.progress
                })

            return {
                active_challenge_set_1: activeChallenges.active_challenge_set_1,
                active_challenge_set_2: activeChallenges.active_challenge_set_2,
                chalenge_set_1_progress: responseChallengeSet1Progress,
                chalenge_set_2_progress: responseChallengeSet2Progress,
            } satisfies BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_challenge_progress
        });
    }

    public updateChallengeProgress = async (
        xuid: bigint,
        chpr: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_challenge_progress
    ) => {
        const activeChallenges = await this.getActiveChallenges(xuid);

        const allProgress = [
            ...chpr.chalenge_set_1_progress.map((progress, index) => ({
                challenge_set: chpr.active_challenge_set_1,
                challenge_index: index,
                progress,
                expiresAt: activeChallenges.chalenge_set_1_timestamp,
            })),
            ...chpr.chalenge_set_2_progress.map((progress, index) => ({
                challenge_set: chpr.active_challenge_set_2,
                challenge_index: index,
                progress,
                expiresAt: activeChallenges.chalenge_set_2_timestamp,
            })),
        ];

        await this.prisma.$transaction(async (tx) => {
            for (const { challenge_set, challenge_index, progress, expiresAt } of allProgress) {
                // Use upsert with raw SQL to ensure progress never decreases
                await tx.$executeRawUnsafe(`
                    INSERT INTO reach_player_challenge_progress (
                    player_xuid, challenge_set, challenge_index, progress, "expiresAt"
                    )
                    VALUES (${xuid.toString()}, ${challenge_set}, ${challenge_index}, ${progress}, TO_TIMESTAMP(${Math.floor(expiresAt.getTime() / 1000)}))
                    ON CONFLICT (player_xuid, challenge_set, challenge_index)
                    DO UPDATE SET
                    progress = GREATEST(reach_player_challenge_progress.progress, EXCLUDED.progress),
                    "expiresAt" = EXCLUDED."expiresAt";
                `);
            }
        });
    };

}