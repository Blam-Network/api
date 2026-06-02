import { Injectable } from '@nestjs/common';
import { reach_player_data_nameplate } from '@prisma/client';
import { PrismaService } from 'src/db/prisma.service';
import { parseXuid } from 'src/xbox/xuid';
import { AchievementsService } from './achievements.service';
import {
    computeReachNameplateUnlocks,
    getReachNameplateDbUnlocks,
    isReachNameplateUnlocked,
    REACH_NAMEPLATE_ID_TO_ENUM,
    REACH_NAMEPLATE_ENUM_TO_ID,
    REACH_NAMEPLATE_XBOX_TITLE_IDS,
    type ReachNameplateAchievementUnlocks,
    type ReachNameplateEquipId,
    type ReachNameplateId,
} from 'src/lsp/haloreach/reach-nameplates';

@Injectable()
export class ReachNameplatesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly achievementsService: AchievementsService,
    ) {}

    private async getAchievementUnlocks(
        authorization: string,
        playerXuid: bigint,
    ): Promise<ReachNameplateAchievementUnlocks> {
        const entries = Object.entries(REACH_NAMEPLATE_XBOX_TITLE_IDS) as [
            keyof ReachNameplateAchievementUnlocks,
            number,
        ][];

        const results = await Promise.all(
            entries.map(([, titleId]) =>
                this.achievementsService
                    .getAchievements(authorization, playerXuid, titleId, true, 1)
                    .then((data) => data.achievements.length > 0)
                    .catch(() => false),
            ),
        );

        return Object.fromEntries(
            entries.map(([key], index) => [key, results[index]]),
        ) as ReachNameplateAchievementUnlocks;
    }

    async getNameplateState(
        playerXuid: bigint,
        options: {
            authorization?: string;
        } = {},
    ) {
        const playerData = await this.prisma.reach_player_data.findUnique({
            where: { player_xuid: playerXuid.toString() },
        });

        const dbUnlocks = getReachNameplateDbUnlocks(playerData);
        const isBungie = playerData?.is_bungie ?? false;

        let achievementUnlocks: ReachNameplateAchievementUnlocks = {
            marathon: false,
            halo1: false,
            halo3: false,
            odst: false,
        };

        if (options.authorization) {
            achievementUnlocks = await this.getAchievementUnlocks(
                options.authorization,
                playerXuid,
            );
        }

        const unlocks = computeReachNameplateUnlocks({
            dbUnlocks,
            isBungie,
            achievementUnlocks,
        });

        const selectedNameplate = playerData
            ? REACH_NAMEPLATE_ENUM_TO_ID[playerData.nameplate]
            : 'none';

        return {
            selectedNameplate,
            unlocks,
            dbUnlocks,
            isBungie,
        };
    }

    async setEquippedNameplate(
        playerXuid: bigint,
        nameplateId: ReachNameplateEquipId,
        options: {
            authorization: string;
        },
    ) {
        if (nameplateId !== 'none') {
            const { unlocks } = await this.getNameplateState(playerXuid, {
                authorization: options.authorization,
            });

            if (!isReachNameplateUnlocked(nameplateId, unlocks)) {
                return { ok: false as const, error: 'Nameplate is locked' };
            }
        }

        const nameplateEnum =
            nameplateId === 'none'
                ? reach_player_data_nameplate.none
                : REACH_NAMEPLATE_ID_TO_ENUM[nameplateId];

        await this.prisma.reach_player_data.upsert({
            where: { player_xuid: playerXuid.toString() },
            create: {
                player_xuid: playerXuid.toString(),
                nameplate: nameplateEnum,
            },
            update: {
                nameplate: nameplateEnum,
            },
        });

        return { ok: true as const, selectedNameplate: nameplateId };
    }

    parseNameplateId(value: string): ReachNameplateEquipId | null {
        if (value === 'none') {
            return 'none';
        }
        if (value in REACH_NAMEPLATE_ID_TO_ENUM) {
            return value as ReachNameplateId;
        }
        return null;
    }
}
