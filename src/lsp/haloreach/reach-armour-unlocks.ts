import { reach_armour, reach_player_rewards_armour } from '@prisma/client';
import { TitleID } from 'src/xbox/titles';
import type { ParsedXboxAchievement } from 'src/website/services/achievements.service';

/** Xbox Live achievement IDs for waypoint helmet unlocks (360 contract v1). */
export const REACH_ARMOUR_ACHIEVEMENT_IDS = {
    reach: {
        soldierWeNeedYouToBe: 94,
        folksNeedHeroes: 93,
        yesSensei: 98,
    },
    odst: {
        campaignCompleteHeroic: 82,
        pinkAndDeadly: 70,
    },
    halo3: {
        fearThePinkMist: 46,
        campaignCompleteLegendary: 18,
    },
} as const;

export type ReachUnlockableHelmetId =
    | 'militarypolice_base'
    | 'militarypolice_cbrnhurs'
    | 'militarypolice_hurscnm'
    | 'cqb_base'
    | 'cqb_hurscnm'
    | 'cqb_uahul'
    | 'chest_uabasesecurity';

export const REACH_UNLOCKABLE_HELMET_IDS: ReachUnlockableHelmetId[] = [
    'militarypolice_base',
    'militarypolice_cbrnhurs',
    'militarypolice_hurscnm',
    'cqb_base',
    'cqb_hurscnm',
    'cqb_uahul',
    'chest_uabasesecurity',
];

export const REACH_UNLOCKABLE_HELMET_ID_TO_ARMOUR: Record<
    ReachUnlockableHelmetId,
    reach_armour
> = {
    militarypolice_base: reach_armour.helmet_militarypolice_base,
    militarypolice_cbrnhurs: reach_armour.helmet_militarypolice_cbrnhurs,
    militarypolice_hurscnm: reach_armour.helemt_militarypolice_hurscnm,
    cqb_base: reach_armour.helmet_cqb_base,
    cqb_hurscnm: reach_armour.helmet_cqb_hurscnm,
    cqb_uahul: reach_armour.helmet_cqb_uahul,
    chest_uabasesecurity: reach_armour.chest_uabasesecurity,
};

export const REACH_UNLOCKABLE_ARMOUR_TO_HELMET_ID = Object.fromEntries(
    Object.entries(REACH_UNLOCKABLE_HELMET_ID_TO_ARMOUR).map(([id, armour]) => [
        armour,
        id,
    ]),
) as Record<reach_armour, ReachUnlockableHelmetId>;

export type ReachArmourAchievementUnlocks = {
    soldierWeNeedYouToBe: boolean;
    folksNeedHeroes: boolean;
    odstCampaignCompleteHeroic: boolean;
    odstPinkAndDeadly: boolean;
    halo3FearThePinkMist: boolean;
    halo3CampaignCompleteLegendary: boolean;
    yesSensei: boolean;
};

export function isReachArmourRowUnlocked(
    row: reach_player_rewards_armour | undefined,
): boolean {
    if (!row) {
        return false;
    }
    return (
        row.purchased ||
        row.bypassed ||
        row.granted_by_lsp ||
        row.forced_visible_and_purchasable
    );
}

export function getReachArmourDbUnlocks(
    rows: reach_player_rewards_armour[],
): Record<ReachUnlockableHelmetId, boolean> {
    const byArmour = new Map(rows.map((row) => [row.armour, row]));

    return Object.fromEntries(
        REACH_UNLOCKABLE_HELMET_IDS.map((id) => [
            id,
            isReachArmourRowUnlocked(byArmour.get(REACH_UNLOCKABLE_HELMET_ID_TO_ARMOUR[id])),
        ]),
    ) as Record<ReachUnlockableHelmetId, boolean>;
}

export function computeReachArmourUnlocks(input: {
    dbUnlocks: Record<ReachUnlockableHelmetId, boolean>;
    achievementUnlocks: ReachArmourAchievementUnlocks;
}): Record<ReachUnlockableHelmetId, boolean> {
    const { dbUnlocks, achievementUnlocks } = input;

    const militarypolice_base =
        dbUnlocks.militarypolice_base ||
        achievementUnlocks.soldierWeNeedYouToBe;
    const militarypolice_cbrnhurs =
        dbUnlocks.militarypolice_cbrnhurs ||
        (militarypolice_base && achievementUnlocks.odstPinkAndDeadly);
    const militarypolice_hurscnm =
        dbUnlocks.militarypolice_hurscnm ||
        (militarypolice_cbrnhurs && achievementUnlocks.halo3FearThePinkMist);

    const cqb_base =
        dbUnlocks.cqb_base || achievementUnlocks.folksNeedHeroes;
    const cqb_hurscnm =
        dbUnlocks.cqb_hurscnm ||
        (cqb_base && achievementUnlocks.odstCampaignCompleteHeroic);
    const cqb_uahul =
        dbUnlocks.cqb_uahul ||
        (cqb_hurscnm && achievementUnlocks.halo3CampaignCompleteLegendary);

    const chest_uabasesecurity =
        dbUnlocks.chest_uabasesecurity || achievementUnlocks.yesSensei;

    return {
        militarypolice_base,
        militarypolice_cbrnhurs,
        militarypolice_hurscnm,
        cqb_base,
        cqb_hurscnm,
        cqb_uahul,
        chest_uabasesecurity,
    };
}

function hasXboxAchievement(
    achievements: ParsedXboxAchievement[],
    id: number,
): boolean {
    return achievements.some(
        (achievement) => achievement.unlocked && achievement.id === id,
    );
}

export const REACH_ARMOUR_ACHIEVEMENT_TITLE_IDS = [
    TitleID.HALOREACH,
    TitleID.HALO3ODST,
    TitleID.HALO3,
] as const;

export function buildReachArmourAchievementUnlocks(
    achievementsByTitle: Partial<Record<number, ParsedXboxAchievement[]>>,
): ReachArmourAchievementUnlocks {
    const reachAchievements = achievementsByTitle[TitleID.HALOREACH] ?? [];
    const odstAchievements = achievementsByTitle[TitleID.HALO3ODST] ?? [];
    const halo3Achievements = achievementsByTitle[TitleID.HALO3] ?? [];

    return {
        soldierWeNeedYouToBe: hasXboxAchievement(
            reachAchievements,
            REACH_ARMOUR_ACHIEVEMENT_IDS.reach.soldierWeNeedYouToBe,
        ),
        folksNeedHeroes: hasXboxAchievement(
            reachAchievements,
            REACH_ARMOUR_ACHIEVEMENT_IDS.reach.folksNeedHeroes,
        ),
        odstCampaignCompleteHeroic: hasXboxAchievement(
            odstAchievements,
            REACH_ARMOUR_ACHIEVEMENT_IDS.odst.campaignCompleteHeroic,
        ),
        odstPinkAndDeadly: hasXboxAchievement(
            odstAchievements,
            REACH_ARMOUR_ACHIEVEMENT_IDS.odst.pinkAndDeadly,
        ),
        halo3FearThePinkMist: hasXboxAchievement(
            halo3Achievements,
            REACH_ARMOUR_ACHIEVEMENT_IDS.halo3.fearThePinkMist,
        ),
        halo3CampaignCompleteLegendary: hasXboxAchievement(
            halo3Achievements,
            REACH_ARMOUR_ACHIEVEMENT_IDS.halo3.campaignCompleteLegendary,
        ),
        yesSensei: hasXboxAchievement(
            reachAchievements,
            REACH_ARMOUR_ACHIEVEMENT_IDS.reach.yesSensei,
        ),
    };
}
