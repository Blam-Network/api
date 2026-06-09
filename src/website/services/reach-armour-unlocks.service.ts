import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { AchievementsService } from './achievements.service';
import {
    buildReachArmourAchievementUnlocks,
    computeReachArmourUnlocks,
    getReachArmourDbUnlocks,
    isReachArmourRowUnlocked,
    REACH_ARMOUR_ACHIEVEMENT_TITLE_IDS,
    REACH_UNLOCKABLE_HELMET_ID_TO_ARMOUR,
    REACH_UNLOCKABLE_HELMET_IDS,
    type ReachUnlockableHelmetId,
} from 'src/lsp/haloreach/reach-armour-unlocks';

@Injectable()
export class ReachArmourUnlocksService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly achievementsService: AchievementsService,
    ) {}

    parseHelmetId(value: string): ReachUnlockableHelmetId | null {
        if (value in REACH_UNLOCKABLE_HELMET_ID_TO_ARMOUR) {
            return value as ReachUnlockableHelmetId;
        }
        return null;
    }

    private async getAchievementUnlocks(
        authorization: string,
        playerXuid: bigint,
    ) {
        const results = await Promise.all(
            REACH_ARMOUR_ACHIEVEMENT_TITLE_IDS.map(async (titleId) => {
                try {
                    const data = await this.achievementsService.getAchievements(
                        authorization,
                        playerXuid,
                        titleId,
                        true,
                        undefined,
                    );
                    return [titleId, data.achievements] as const;
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.error('[ReachArmourUnlocks] achievement fetch failed', {
                        titleId,
                        playerXuid: playerXuid.toString(),
                        message,
                    });
                    return [titleId, []] as const;
                }
            }),
        );

        return buildReachArmourAchievementUnlocks(Object.fromEntries(results));
    }

    private buildUnlockState(input: {
        dbUnlocks: Record<ReachUnlockableHelmetId, boolean>;
        achievementUnlocks: ReturnType<typeof buildReachArmourAchievementUnlocks>;
    }) {
        const eligible = computeReachArmourUnlocks({
            dbUnlocks: input.dbUnlocks,
            achievementUnlocks: input.achievementUnlocks,
        });

        return {
            eligible,
            unlocked: input.dbUnlocks,
        };
    }

    async getArmourUnlockState(
        playerXuid: bigint,
        options: {
            authorization?: string;
        } = {},
    ) {
        const armourEnums = REACH_UNLOCKABLE_HELMET_IDS.map(
            (id) => REACH_UNLOCKABLE_HELMET_ID_TO_ARMOUR[id],
        );

        const existingRows = await this.prisma.reach_player_rewards_armour.findMany({
            where: {
                player_xuid: playerXuid.toString(),
                armour: { in: armourEnums },
            },
        });

        const dbUnlocks = getReachArmourDbUnlocks(existingRows);
        const allPersistedUnlocked = REACH_UNLOCKABLE_HELMET_IDS.every((id) => dbUnlocks[id]);

        let achievementUnlocks = {
            soldierWeNeedYouToBe: false,
            folksNeedHeroes: false,
            odstCampaignCompleteHeroic: false,
            odstPinkAndDeadly: false,
            halo3FearThePinkMist: false,
            halo3CampaignCompleteLegendary: false,
            yesSensei: false,
        };

        if (options.authorization && !allPersistedUnlocked) {
            achievementUnlocks = await this.getAchievementUnlocks(
                options.authorization,
                playerXuid,
            );
        }

        return this.buildUnlockState({ dbUnlocks, achievementUnlocks });
    }

    async unlockHelmet(
        playerXuid: bigint,
        helmetId: ReachUnlockableHelmetId,
        options: {
            authorization: string;
        },
    ) {
        const armour = REACH_UNLOCKABLE_HELMET_ID_TO_ARMOUR[helmetId];
        const armourEnums = REACH_UNLOCKABLE_HELMET_IDS.map(
            (id) => REACH_UNLOCKABLE_HELMET_ID_TO_ARMOUR[id],
        );
        const existingRows = await this.prisma.reach_player_rewards_armour.findMany({
            where: {
                player_xuid: playerXuid.toString(),
                armour: { in: armourEnums },
            },
        });
        const existingRow = existingRows.find((row) => row.armour === armour);

        if (isReachArmourRowUnlocked(existingRow)) {
            const state = await this.getArmourUnlockState(playerXuid, {
                authorization: options.authorization,
            });
            return { ok: true as const, ...state };
        }

        const achievementUnlocks = await this.getAchievementUnlocks(
            options.authorization,
            playerXuid,
        );
        const dbUnlocks = getReachArmourDbUnlocks(existingRows);
        const { eligible } = this.buildUnlockState({ dbUnlocks, achievementUnlocks });

        if (!eligible[helmetId]) {
            throw new UnauthorizedException('Helmet requirements are not met');
        }

        await this.prisma.reach_player_rewards_armour.upsert({
            where: {
                player_xuid_armour: {
                    player_xuid: playerXuid.toString(),
                    armour,
                },
            },
            create: {
                player_xuid: playerXuid.toString(),
                armour,
                forced_visible_and_purchasable: true,
            },
            update: {
                forced_visible_and_purchasable: true,
            },
        });

        const state = await this.getArmourUnlockState(playerXuid, {
            authorization: options.authorization,
        });

        return { ok: true as const, ...state };
    }
}
