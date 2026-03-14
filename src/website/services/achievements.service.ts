import { Injectable } from "@nestjs/common";
import { DecimalJsLike } from "@prisma/client/runtime/library";
import axios from "axios";
import { z } from "zod";

const XboxLiveAchievementsSchema = z.object({
    achievements: z.object({
        id: z.coerce.number(),
        unlockedOnline: z.coerce.boolean(),
    }).array()
})

@Injectable()
export class AchievementsService {
    public async getAchievements(
        authorization: string,
        xuid: BigInt,
        titleId: number,
        unlockedOnly: boolean | undefined,
        maxItems: number | undefined,
    ) {
        const data = (await axios.get(
            `https://achievements.xboxlive.com/users/xuid(${xuid})/achievements`,
            {
                params: {
                    titleId,
                    unlockedOnly,
                    maxItems
                },
                headers: {
                    'Authorization': authorization,
                }
            }
        )).data;
        const parsed = XboxLiveAchievementsSchema.safeParse(data);

        if (!parsed.success) {
            throw new Error(`Failed to parse achievements: ${parsed.error.message}`);
        }

        return parsed.data;
    }
}