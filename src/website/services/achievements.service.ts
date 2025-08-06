import { Injectable } from "@nestjs/common";
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
        xuid: number,
        titleId: number,
        unlockedOnly: boolean | undefined,
        maxItems: number | undefined,
    ) {
        return XboxLIVEAchivementsSchema.parse(
            (await axios.get(
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
            )).data
        )
    }
}