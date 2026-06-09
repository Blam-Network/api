import { Injectable } from "@nestjs/common";
import axios from "axios";
import { z } from "zod";

const Xbox360AchievementSchema = z.object({
    id: z.coerce.number(),
    name: z.string().optional(),
    unlockedOnline: z.coerce.boolean().optional(),
    unlocked: z.coerce.boolean().optional(),
});

const XboxV2AchievementSchema = z.object({
    id: z.coerce.number(),
    name: z.string().optional(),
    progressState: z.string().optional(),
});

const XboxLiveAchievementsResponseSchema = z.object({
    achievements: z.array(z.unknown()),
    pagingInfo: z
        .object({
            continuationToken: z.string().nullable().optional(),
        })
        .optional(),
});

export type ParsedXboxAchievement = {
    id: number;
    name?: string;
    unlocked: boolean;
    unlockedOnline?: boolean;
};

function parseAchievementEntry(entry: unknown): ParsedXboxAchievement | null {
    const x360 = Xbox360AchievementSchema.safeParse(entry);
    if (x360.success) {
        const { id, name, unlockedOnline, unlocked } = x360.data;
        return {
            id,
            name,
            unlocked: unlocked ?? unlockedOnline ?? false,
            unlockedOnline,
        };
    }

    const v2 = XboxV2AchievementSchema.safeParse(entry);
    if (v2.success) {
        return {
            id: v2.data.id,
            name: v2.data.name,
            unlocked: v2.data.progressState === "Achieved",
        };
    }

    console.warn("[AchievementsService] skipped unparseable achievement entry", entry);
    return null;
}

function parseAchievementsResponse(data: unknown): {
    achievements: ParsedXboxAchievement[];
    continuationToken?: string;
} {
    const parsed = XboxLiveAchievementsResponseSchema.safeParse(data);
    if (!parsed.success) {
        console.error(
            "[AchievementsService] failed to parse achievements response",
            parsed.error.message,
            JSON.stringify(data).slice(0, 1000),
        );
        throw new Error(`Failed to parse achievements: ${parsed.error.message}`);
    }

    const achievements = parsed.data.achievements
        .map(parseAchievementEntry)
        .filter((achievement): achievement is ParsedXboxAchievement => achievement !== null);

    const continuationToken = parsed.data.pagingInfo?.continuationToken ?? undefined;

    return {
        achievements,
        continuationToken: continuationToken || undefined,
    };
}

@Injectable()
export class AchievementsService {
    public async getAchievements(
        authorization: string,
        xuid: BigInt,
        titleId: number,
        unlockedOnly: boolean | undefined,
        maxItems: number | undefined,
    ) {
        const achievements: ParsedXboxAchievement[] = [];
        let continuationToken: string | undefined;
        const xuidDecimal = xuid.toString();

        do {
            const url = `https://achievements.xboxlive.com/users/xuid(${xuidDecimal})/achievements`;
            const params = {
                titleId,
                unlockedOnly,
                maxItems,
                continuationToken,
            };

            let data: unknown;
            try {
                const response = await axios.get(url, {
                    params,
                    headers: {
                        Authorization: authorization,
                        "x-xbl-contract-version": "1",
                        "Accept-Language": "en-US, en",
                    },
                });
                data = response.data;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const status = axios.isAxiosError(error) ? error.response?.status : undefined;
                const body = axios.isAxiosError(error)
                    ? JSON.stringify(error.response?.data).slice(0, 1000)
                    : undefined;
                console.error("[AchievementsService] request failed", {
                    titleId,
                    status,
                    message,
                    body,
                });
                throw error;
            }

            const page = parseAchievementsResponse(data);

            achievements.push(...page.achievements);
            continuationToken = page.continuationToken;
        } while (continuationToken);

        return { achievements };
    }
}
