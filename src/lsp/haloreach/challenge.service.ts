import { Inject, Injectable } from "@nestjs/common";
import {
    e_challenge_category,
    s_blf_chunk_challenge_progress,
    s_blf_chunk_challenge_state,
    s_challenge_state,
} from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import { Prisma } from "@prisma/client";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { AVAILABLE_BOUNTY_CHALLENGES, AVAILABLE_CAMPAIGN_CHALLENGES, AVAILABLE_FIREFIGHT_CHALLENGES, AVAILABLE_MATCHMAKING_CHALLENGES, AVAILABLE_WEEKLY_CHALLENGES } from "./challenges";
import { DeterministicRandomizer } from "src/utils/random";
import { differenceInDays, differenceInWeeks } from "date-fns";

const CHALLENGES_ENABLED = true;
const CHALLENGES_WHITELIST = false;
const DAILY_CHALLENGES_COUNT = 4;
const WEEKLY_CHALLENGES_COUNT = 1;
const MAXIMUM_CHALLENGES_PER_SET = 10;
const JAN_1_2000 = new Date(2000, 1, 1);
const DAILY_CHALLENGE_CREDITS_MULTIPLIER = 1.5;
const WEEKLY_CHALLENGE_CREDITS_MULTIPLIER = 1.5;

function emptyChallengeSlots(): s_challenge_state[] {
    return Array.from({ length: MAXIMUM_CHALLENGES_PER_SET }, () => new s_challenge_state());
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

    // We just need a unique id for the challenge set that's u32 in size.
    // Using the day and week index from Jan 1st 2000 does the trick
    // the only overlap would be day 1 / week 1, which was Jan 1st 2000, which was way before reach came out.
    private getDayIndex = () => differenceInDays(this.getNextDailyResetDate(), JAN_1_2000) - 1;
    private getWeekIndex = () => differenceInWeeks(this.getNextWeeklyResetDate(), JAN_1_2000) - 1;

    public getRandomDailyChallenges = (): s_challenge_state[] => {
        const challenges = emptyChallengeSlots();

        // this should really be based on the challenge difficulty, but for now it's more random.
        const CHALLENGE_CREDITS_RANGE = [
            1500, 2000, 2250, 2500, 2750, 3000,
        ]

        // Working copies of challenge arrays which we remove from to prevent duplication in picked challenges.
        const REMAINING_BOUNTY_CHALLENGES = [...AVAILABLE_BOUNTY_CHALLENGES];
        const REMAINING_CAMPAIGN_CHALLENGES = [...AVAILABLE_CAMPAIGN_CHALLENGES];
        const REMAINING_FIREFIGHT_CHALLENGES = [...AVAILABLE_FIREFIGHT_CHALLENGES];
        const REMAINING_MATCHMAKING_CHALLENGES = [...AVAILABLE_MATCHMAKING_CHALLENGES];

        for (let challengeNumber = 0; challengeNumber < DAILY_CHALLENGES_COUNT; challengeNumber++) {
            const randomizer = new DeterministicRandomizer(`${this.getNextDailyResetDate().getDate().toString()}-${challengeNumber}`)

            let challengeCategory = randomizer.pick([
                e_challenge_category.bounty,
                e_challenge_category.campaign,
                e_challenge_category.firefight,
                e_challenge_category.matchmaking,
            ])

            let challenge: number = 0;
            switch (challengeCategory) {
                case e_challenge_category.bounty: {
                    challenge = randomizer.pick_and_remove(REMAINING_BOUNTY_CHALLENGES)
                    break;
                }
                case e_challenge_category.campaign: {
                    challenge = randomizer.pick_and_remove(REMAINING_CAMPAIGN_CHALLENGES)
                    break;
                }
                case e_challenge_category.firefight: {
                    challenge = randomizer.pick_and_remove(REMAINING_FIREFIGHT_CHALLENGES)
                    break;
                }
                case e_challenge_category.matchmaking: {
                    challenge = randomizer.pick_and_remove(REMAINING_MATCHMAKING_CHALLENGES)
                    break;
                }
            }

            challenges[challengeNumber].category = challengeCategory;
            challenges[challengeNumber].challenge = challenge;
            challenges[challengeNumber].cookie_reward = Math.round(
                randomizer.pick(CHALLENGE_CREDITS_RANGE) * DAILY_CHALLENGE_CREDITS_MULTIPLIER
            );
        }

        return challenges;
    }

    public getRandomWeeklyChallenges = (): s_challenge_state[] => {
        const challenges = emptyChallengeSlots();

        for (let challengeNumber = 0; challengeNumber < WEEKLY_CHALLENGES_COUNT; challengeNumber++) {
            const randomizer = new DeterministicRandomizer(`${this.getNextWeeklyResetDate().getDate().toString()}-${challengeNumber}`)

            let challengeCategory = e_challenge_category.weekly;
            let challenge: number = randomizer.pick(AVAILABLE_WEEKLY_CHALLENGES);

            // this should really be based on the challenge difficulty, but for now it's more random.
            const CHALLENGE_CREDITS_RANGE = [
                15000, 17500, 20000, 22500, 25000, 27500, 30000,
            ]

            challenges[challengeNumber].category = challengeCategory
            challenges[challengeNumber].challenge = challenge;
            // i16 max is 32767; clamp weekly cookie overrides to the wire type.
            challenges[challengeNumber].cookie_reward = Math.min(
                32767,
                Math.round(randomizer.pick(CHALLENGE_CREDITS_RANGE) * WEEKLY_CHALLENGE_CREDITS_MULTIPLIER)
            );
        }

        return challenges;
    }

    public getActiveChallenges = async (xuid: BigInt): Promise<s_blf_chunk_challenge_state> => {
        const dcha = new s_blf_chunk_challenge_state();

        if (!CHALLENGES_ENABLED || (CHALLENGES_WHITELIST && !await this.isWhitelisted(xuid))) {
            dcha.chalenge_set_1 = emptyChallengeSlots();
            dcha.chalenge_set_2 = emptyChallengeSlots();
            dcha.chalenge_set_1_timestamp = new Date();
            dcha.chalenge_set_2_timestamp = new Date();
            return dcha;
        }

        dcha.active_challenge_set_1 = this.getDayIndex();
        dcha.active_challenge_set_2 = this.getWeekIndex();
        dcha.chalenge_set_1_count = DAILY_CHALLENGES_COUNT;
        dcha.chalenge_set_2_count = WEEKLY_CHALLENGES_COUNT;
        dcha.chalenge_set_1_timestamp = this.getNextDailyResetDate();
        dcha.chalenge_set_2_timestamp = this.getNextWeeklyResetDate();
        dcha.chalenge_set_1 = this.getRandomDailyChallenges();
        dcha.chalenge_set_2 = this.getRandomWeeklyChallenges();
        return dcha;
    }

    public getChallengeProgress = async (xuid: BigInt): Promise<s_blf_chunk_challenge_progress> => {
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

            const chpr = new s_blf_chunk_challenge_progress();
            chpr.active_challenge_set_1 = activeChallenges.active_challenge_set_1;
            chpr.active_challenge_set_2 = activeChallenges.active_challenge_set_2;

            activeChallengeProgress
                .filter(challengeProgress => challengeProgress.challenge_set === activeChallenges.active_challenge_set_1)
                .forEach(challengeProgress => {
                    chpr.chalenge_set_1_progress[challengeProgress.challenge_index] = challengeProgress.progress
                })

            activeChallengeProgress
                .filter(challengeProgress => challengeProgress.challenge_set === activeChallenges.active_challenge_set_2)
                .forEach(challengeProgress => {
                    chpr.chalenge_set_2_progress[challengeProgress.challenge_index] = challengeProgress.progress
                })

            return chpr;
        });
    }

    public updateChallengeProgress = async (
        xuid: BigInt,
        chpr: s_blf_chunk_challenge_progress
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

        if (allProgress.length === 0) {
            return;
        }

        const valueRows = allProgress.map(
            ({ challenge_set, challenge_index, progress, expiresAt }) =>
                Prisma.sql`(${xuid.toString()}::numeric, ${challenge_set}, ${challenge_index}, ${progress}, ${expiresAt})`,
        );

        await this.prisma.$executeRaw`
            INSERT INTO reach.player_challenge_progress (
                player_xuid, challenge_set, challenge_index, progress, "expiresAt"
            )
            VALUES ${Prisma.join(valueRows)}
            ON CONFLICT (player_xuid, challenge_set, challenge_index)
            DO UPDATE SET
                progress = GREATEST(reach.player_challenge_progress.progress, EXCLUDED.progress),
                "expiresAt" = EXCLUDED."expiresAt";
        `;
    };

}
