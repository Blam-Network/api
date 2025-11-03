import { Inject, Injectable } from "@nestjs/common";
import * as BLF from '@blam-network/blf_lsp';
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { AVAILABLE_BOUNTY_CHALLENGES, AVAILABLE_CAMPAIGN_CHALLENGES, AVAILABLE_FIREFIGHT_CHALLENGES, AVAILABLE_MATCHMAKING_CHALELNGES, AVAILABLE_WEEKLY_CHALLENGES, HaloReachFirefightChallenge, HaloReachWeeklyChallenge } from "./challenges";
import { DeterministicRandomizer } from "src/utils/random";

const CHALLENGES_ENABLED = true;
const CHALLENGES_WHITELIST = false;
const DAILY_CHALLENGES_COUNT = 4;
const WEEKLY_CHALLENGES_COUNT = 1;
const MAXIMUM_CHALLENGES_PER_SET = 10;

enum ChallengeSet {
    Daily = 1,
    Weekly = 2
}

@Injectable()
export class HaloReachChallengeService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    private isWhitelisted = async (xuid: BigInt): Promise<boolean> => {
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

    public getRandomDailyChallenges = (): BLF.haloreach_12065_11_08_24_1738_tu1actual.s_challenge_state[] => {
        const randomizer = new DeterministicRandomizer(this.getNextDailyResetDate().getDate().toString())
        const challenges = Array.from(
            { length: MAXIMUM_CHALLENGES_PER_SET },
            () => ({ category: 0, challenge: 0 })
        );

        // Working copies of challenge arrays which we remove from to prevent duplication in picked challenges.
        const REMAINING_BOUNTY_CHALLENGES = [...AVAILABLE_BOUNTY_CHALLENGES];
        const REMAINING_CAMPAIGN_CHALLENGES = [...AVAILABLE_CAMPAIGN_CHALLENGES];
        const REMAINING_FIREFIGHT_CHALLENGES = [...AVAILABLE_FIREFIGHT_CHALLENGES];
        const REMAINING_MATCHMAKING_CHALLENGES = [...AVAILABLE_MATCHMAKING_CHALELNGES];

        for (let challengeNumber = 0; challengeNumber < DAILY_CHALLENGES_COUNT; challengeNumber++) {
            let challengeCategory = randomizer.pick([
                BLF.haloreach_12065_11_08_24_1738_tu1actual.e_challenge_category.bounty,
                BLF.haloreach_12065_11_08_24_1738_tu1actual.e_challenge_category.campaign,
                BLF.haloreach_12065_11_08_24_1738_tu1actual.e_challenge_category.firefight,
                BLF.haloreach_12065_11_08_24_1738_tu1actual.e_challenge_category.matchmaking,
            ])

            let challenge: number = 0;
            switch (challengeCategory) {
                case BLF.haloreach_12065_11_08_24_1738_tu1actual.e_challenge_category.bounty: {
                    challenge = randomizer.pick_and_remove(REMAINING_BOUNTY_CHALLENGES)
                    break;
                }
                case BLF.haloreach_12065_11_08_24_1738_tu1actual.e_challenge_category.campaign: {
                    challenge = randomizer.pick_and_remove(REMAINING_CAMPAIGN_CHALLENGES)
                    break;
                }
                case BLF.haloreach_12065_11_08_24_1738_tu1actual.e_challenge_category.firefight: {
                    challenge = randomizer.pick_and_remove(REMAINING_FIREFIGHT_CHALLENGES)
                    break;
                }
                case BLF.haloreach_12065_11_08_24_1738_tu1actual.e_challenge_category.matchmaking: {
                    challenge = randomizer.pick_and_remove(REMAINING_MATCHMAKING_CHALLENGES)
                    break;
                }
            }

            challenges[challengeNumber].category = challengeCategory
            challenges[challengeNumber].challenge = challenge;
        }

        return challenges;
    }

    public getRandomWeeklyChallenges = (): BLF.haloreach_12065_11_08_24_1738_tu1actual.s_challenge_state[] => {
        const randomizer = new DeterministicRandomizer(this.getNextDailyResetDate().getDate().toString())
        const challenges = Array.from(
            { length: MAXIMUM_CHALLENGES_PER_SET },
            () => ({ category: 0, challenge: 0 })
        );

        for (let challengeNumber = 0; challengeNumber < WEEKLY_CHALLENGES_COUNT; challengeNumber++) {
            let challengeCategory = BLF.haloreach_12065_11_08_24_1738_tu1actual.e_challenge_category.weekly;
            let challenge: number = randomizer.pick(AVAILABLE_WEEKLY_CHALLENGES);

            challenges[challengeNumber].category = challengeCategory
            challenges[challengeNumber].challenge = challenge;
        }

        return challenges;
    }

    public getActiveChallenges = async (xuid: BigInt): Promise<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_challenge_state> => {        
        if (!CHALLENGES_ENABLED || (CHALLENGES_WHITELIST && !await this.isWhitelisted(xuid))) {
            return {
                active_challenge_set_1: 0,
                active_challenge_set_2: 0,
                chalenge_set_1: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_challenge_state>(MAXIMUM_CHALLENGES_PER_SET)
                    .fill({category: 0, challenge: 0,}),
                chalenge_set_2: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_challenge_state>(MAXIMUM_CHALLENGES_PER_SET)
                    .fill({category: 0, challenge: 0,}),
                chalenge_set_1_count: 0,
                chalenge_set_2_count: 0,
                chalenge_set_1_timestamp: new Date(),
                chalenge_set_2_timestamp: new Date(),
            }
        }

        return {
            active_challenge_set_1: ChallengeSet.Daily,
            active_challenge_set_2: ChallengeSet.Weekly,
            chalenge_set_1_count: DAILY_CHALLENGES_COUNT,
            chalenge_set_2_count: WEEKLY_CHALLENGES_COUNT,
            chalenge_set_1_timestamp: this.getNextDailyResetDate(),
            chalenge_set_2_timestamp: this.getNextWeeklyResetDate(),
            chalenge_set_1: this.getRandomDailyChallenges(),
            chalenge_set_2: this.getRandomWeeklyChallenges(),
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
        xuid: BigInt,
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
                    INSERT INTO reach.player_challenge_progress (
                        player_xuid, challenge_set, challenge_index, progress, "expiresAt"
                    )
                    VALUES (${xuid.toString()}, ${challenge_set}, ${challenge_index}, ${progress}, TO_TIMESTAMP(${Math.floor(expiresAt.getTime() / 1000)}))
                    ON CONFLICT (player_xuid, challenge_set, challenge_index)
                    DO UPDATE SET
                    progress = GREATEST(reach.player_challenge_progress.progress, EXCLUDED.progress),
                    "expiresAt" = EXCLUDED."expiresAt";
                `);
            }
        });
    };

}