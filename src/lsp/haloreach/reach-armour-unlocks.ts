import { reach_armour, reach_player_rewards_armour } from '@prisma/client';
import { TitleID } from 'src/xbox/titles';
import type { ParsedXboxAchievement } from 'src/website/services/achievements.service';

/** Xbox Live achievement IDs for waypoint helmet unlocks (360 contract v1). */
export const REACH_ARMOUR_ACHIEVEMENT_IDS = {
    reach: {
        soldierWeNeedYouToBe: 30,
        folksNeedHeroes: 31,
    },
    odst: {
        campaignCompleteHeroic: 17,
        pinkAndDeadly: 37,
    },
    halo3: {
        fearThePinkMist: 46,
        campaignCompleteLegendary: 18,
    },
} as const;

/** Fallback name matching when achievement IDs differ between API surfaces. */
export const REACH_ARMOUR_ACHIEVEMENT_NAMES = {
    soldierWeNeedYouToBe: [
        'The Soldier We Needed You To Be',
        'The Soldier We Need You To Be',
    ],
    folksNeedHeroes: ['Folks Need Heroes...', 'Folks Need Heroes…'],
    odstCampaignCompleteHeroic: ['Campaign Complete: Heroic'],
    odstPinkAndDeadly: ['Pink and Deadly'],
    halo3FearThePinkMist: ['Fear the Pink Mist'],
    halo3CampaignCompleteLegendary: ['Campaign Complete: Legendary'],
} as const;

export type ReachUnlockableHelmetId =
    | 'militarypolice_base'
    | 'militarypolice_cbrnhurs'
    | 'militarypolice_hurscnm'
    | 'cqb_base'
    | 'cqb_hurscnm'
    | 'cqb_uahul';

export const REACH_UNLOCKABLE_HELMET_IDS: ReachUnlockableHelmetId[] = [
    'militarypolice_base',
    'militarypolice_cbrnhurs',
    'militarypolice_hurscnm',
    'cqb_base',
    'cqb_hurscnm',
    'cqb_uahul',
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

    return {
        militarypolice_base,
        militarypolice_cbrnhurs,
        militarypolice_hurscnm,
        cqb_base,
        cqb_hurscnm,
        cqb_uahul,
    };
}

function normalizeAchievementName(name: string): string {
    return name.trim().replace(/\.+$/, '').toLowerCase();
}

export function hasXboxAchievement(
    achievements: ParsedXboxAchievement[],
    options: {
        id?: number;
        names?: readonly string[];
    },
): boolean {
    return achievements.some((achievement) => {
        if (!achievement.unlocked) {
            return false;
        }

        if (options.id !== undefined && achievement.id === options.id) {
            return true;
        }

        if (!options.names?.length || !achievement.name) {
            return false;
        }

        const normalizedAchievementName = normalizeAchievementName(achievement.name);
        return options.names.some((candidate) => {
            const normalizedCandidate = normalizeAchievementName(candidate);
            return (
                normalizedAchievementName === normalizedCandidate ||
                normalizedAchievementName.startsWith(normalizedCandidate)
            );
        });
    });
}

export const REACH_ARMOUR_ACHIEVEMENT_TITLE_FETCH = [
    { titleId: TitleID.HALOREACH, maxItems: 100 },
    { titleId: TitleID.HALO3ODST, maxItems: 100 },
    { titleId: TitleID.HALO3, maxItems: 100 },
] as const;

export function buildReachArmourAchievementUnlocks(
    achievementsByTitle: Partial<Record<number, ParsedXboxAchievement[]>>,
): ReachArmourAchievementUnlocks {
    const reachAchievements = achievementsByTitle[TitleID.HALOREACH] ?? [];
    const odstAchievements = achievementsByTitle[TitleID.HALO3ODST] ?? [];
    const halo3Achievements = achievementsByTitle[TitleID.HALO3] ?? [];

    return {
        soldierWeNeedYouToBe: hasXboxAchievement(reachAchievements, {
            id: REACH_ARMOUR_ACHIEVEMENT_IDS.reach.soldierWeNeedYouToBe,
            names: REACH_ARMOUR_ACHIEVEMENT_NAMES.soldierWeNeedYouToBe,
        }),
        folksNeedHeroes: hasXboxAchievement(reachAchievements, {
            id: REACH_ARMOUR_ACHIEVEMENT_IDS.reach.folksNeedHeroes,
            names: REACH_ARMOUR_ACHIEVEMENT_NAMES.folksNeedHeroes,
        }),
        odstCampaignCompleteHeroic: hasXboxAchievement(odstAchievements, {
            id: REACH_ARMOUR_ACHIEVEMENT_IDS.odst.campaignCompleteHeroic,
            names: REACH_ARMOUR_ACHIEVEMENT_NAMES.odstCampaignCompleteHeroic,
        }),
        odstPinkAndDeadly: hasXboxAchievement(odstAchievements, {
            id: REACH_ARMOUR_ACHIEVEMENT_IDS.odst.pinkAndDeadly,
            names: REACH_ARMOUR_ACHIEVEMENT_NAMES.odstPinkAndDeadly,
        }),
        halo3FearThePinkMist: hasXboxAchievement(halo3Achievements, {
            id: REACH_ARMOUR_ACHIEVEMENT_IDS.halo3.fearThePinkMist,
            names: REACH_ARMOUR_ACHIEVEMENT_NAMES.halo3FearThePinkMist,
        }),
        halo3CampaignCompleteLegendary: hasXboxAchievement(halo3Achievements, {
            id: REACH_ARMOUR_ACHIEVEMENT_IDS.halo3.campaignCompleteLegendary,
            names: REACH_ARMOUR_ACHIEVEMENT_NAMES.halo3CampaignCompleteLegendary,
        }),
    };
}
