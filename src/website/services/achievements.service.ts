import { Injectable } from "@nestjs/common";
import { DecimalJsLike } from "@prisma/client/runtime/library";
import axios from "axios";
import { z } from "zod";

const XboxLIVEAchivementsSchema = z.object({
    achivements: z.object({
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
        const parsed = XboxLIVEAchivementsSchema.safeParse(data);

        if (!parsed.success) {
            console.error(Buffer.from(JSON.stringify(data), 'utf-8').toString('base64'));
            throw new Error(`Failed to parse achievements: ${parsed.error.message}`);
        }

        return parsed.data;
    }
}