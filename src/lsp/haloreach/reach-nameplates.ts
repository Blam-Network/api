import { reach_player_data, reach_player_data_nameplate } from '@prisma/client';

/** Xbox title IDs (decimal) for achievement-based nameplate unlocks. */
export const REACH_NAMEPLATE_XBOX_TITLE_IDS = {
    marathon: parseInt('5841085E', 16),
    halo1: parseInt('4D5309B1', 16),
    halo2: parseInt('4D53080F', 16),
    halo3: parseInt('4D5307E6', 16),
    odst: parseInt('4D530877', 16),
} as const;

export type ReachNameplateEquipId = ReachNameplateId | 'none';

export type ReachNameplateId =
    | 'ar'
    | 'bungie'
    | 'column'
    | 'dmr'
    | 'marathon'
    | 'halo1'
    | 'halo2'
    | 'halo3'
    | 'odst'
    | 'helmet'
    | 'halo'
    | 'star';

export const REACH_NAMEPLATE_ID_TO_ENUM: Record<ReachNameplateId, reach_player_data_nameplate> = {
    ar: reach_player_data_nameplate.assault_rifle,
    bungie: reach_player_data_nameplate.bungie,
    column: reach_player_data_nameplate.seventh_column,
    dmr: reach_player_data_nameplate.dmr,
    marathon: reach_player_data_nameplate.marathon,
    halo1: reach_player_data_nameplate.halo1,
    halo2: reach_player_data_nameplate.halo2,
    halo3: reach_player_data_nameplate.halo3,
    odst: reach_player_data_nameplate.odst,
    helmet: reach_player_data_nameplate.mk4_helmet,
    halo: reach_player_data_nameplate.halo,
    star: reach_player_data_nameplate.allstar,
};

export const REACH_NAMEPLATE_ENUM_TO_ID = {
    ...Object.fromEntries(
        Object.entries(REACH_NAMEPLATE_ID_TO_ENUM).map(([id, value]) => [value, id]),
    ),
    [reach_player_data_nameplate.none]: 'none',
} as Record<reach_player_data_nameplate, ReachNameplateEquipId>;

export type ReachNameplateDbUnlocks = Record<ReachNameplateId, boolean>;

function getDbUnlockForNameplateEnum(
    playerData: reach_player_data | null,
    nameplate: reach_player_data_nameplate,
): boolean {
    if (!playerData) {
        return false;
    }
    switch (nameplate) {
        case reach_player_data_nameplate.dmr:
            return playerData.nameplate_dmr_unlocked;
        case reach_player_data_nameplate.bungie:
            return playerData.nameplate_bungie_unlocked;
        case reach_player_data_nameplate.marathon:
            return playerData.nameplate_marathon_unlocked;
        case reach_player_data_nameplate.halo1:
            return playerData.nameplate_halo1_unlocked;
        case reach_player_data_nameplate.halo2:
            return playerData.nameplate_halo2_unlocked;
        case reach_player_data_nameplate.halo3:
            return playerData.nameplate_halo3_unlocked;
        case reach_player_data_nameplate.odst:
            return playerData.nameplate_odst_unlocked;
        case reach_player_data_nameplate.assault_rifle:
            return playerData.nameplate_assault_rifle_unlocked;
        case reach_player_data_nameplate.mk4_helmet:
            return playerData.nameplate_mk4_helmet_unlocked;
        case reach_player_data_nameplate.halo:
            return playerData.nameplate_halo_unlocked;
        case reach_player_data_nameplate.allstar:
            return playerData.nameplate_allstar_unlocked;
        default:
            return false;
    }
}

export function getReachNameplateDbUnlocks(
    playerData: reach_player_data | null,
): ReachNameplateDbUnlocks {
    return Object.fromEntries(
        (Object.entries(REACH_NAMEPLATE_ID_TO_ENUM) as [ReachNameplateId, reach_player_data_nameplate][]).map(
            ([id, nameplateEnum]) => [
                id,
                getDbUnlockForNameplateEnum(playerData, nameplateEnum),
            ],
        ),
    ) as ReachNameplateDbUnlocks;
}

export type ReachNameplateAchievementUnlocks = {
    marathon: boolean;
    halo1: boolean;
    halo2: boolean;
    halo3: boolean;
    odst: boolean;
};

export function computeReachNameplateUnlocks(input: {
    dbUnlocks: ReachNameplateDbUnlocks;
    isBungie: boolean;
    achievementUnlocks: ReachNameplateAchievementUnlocks;
}): Record<ReachNameplateId, boolean> {
    const { dbUnlocks, isBungie, achievementUnlocks } = input;

    const halo1 =
        dbUnlocks.halo1 || achievementUnlocks.halo1;
    const halo2 =
        dbUnlocks.halo2 || achievementUnlocks.halo2;
    const halo3 =
        dbUnlocks.halo3 || achievementUnlocks.halo3;
    const odst =
        dbUnlocks.odst || achievementUnlocks.odst;
    const marathon =
        dbUnlocks.marathon || achievementUnlocks.marathon;
    const halo =
        dbUnlocks.halo || (halo1 && halo2 && halo3 && odst);

    return {
        ar: dbUnlocks.ar,
        bungie: isBungie || dbUnlocks.bungie,
        column: true,
        dmr: dbUnlocks.dmr,
        marathon,
        halo1,
        halo2,
        halo3,
        odst,
        helmet: dbUnlocks.helmet || (marathon && halo),
        halo,
        star: dbUnlocks.star,
    };
}

export function isReachNameplateUnlocked(
    nameplateId: ReachNameplateId,
    unlocks: Record<ReachNameplateId, boolean>,
): boolean {
    return unlocks[nameplateId] ?? false;
}
