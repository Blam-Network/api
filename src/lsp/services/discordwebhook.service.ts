import { Inject, Injectable } from "@nestjs/common"
import axios from "axios"
import { formatDuration, interval, intervalToDuration } from "date-fns"
import * as moment from "moment"
import ILogger, { ILoggerSymbol } from "src/ILogger"

enum WebhookType {
    HALO3_STATS,
    HALO3_SCREENSHOTS
}

type WebhookConfiguration = {
    name: string,
    url: string,
    types: WebhookType[]
}

// TODO: Zodify this
const WEBHOOK_CONFIG: WebhookConfiguration[] = [
    {
        name: 'BlamNetwork Dev',
        url: 'https://discord.com/api/webhooks/1323102144332824586/zIZ-ylj9NAUEo3tn4IjJGELIlnddetFElp0DTAbZ06CMFt2YUi-92B30fjl56sLSiBdV',
        types: [
            WebhookType.HALO3_SCREENSHOTS,
            WebhookType.HALO3_STATS
        ]
    }
]

type Halo3CarnageReportMessage = {
    carnageReportId: string,
    gametype: string,
    map: string,
    mapId: number,
    hopperName: string,
    playerCount: number,
    startTime: Date,
    finishTime: Date,
    winningScore: number,
    teamGame: boolean,
    winner?: string,
}

@Injectable()
export class DiscordWebhookService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {}

    private sendWebhookMessage = (type: WebhookType, message: Object) => {
        Promise.allSettled(
            WEBHOOK_CONFIG
                .filter(wh => wh.types.includes(type))
                .map(({url, name}) => {
                    console.debug(`[DISCORD] Sending webhook to ${name}`)
                    return axios.post(url, message)
                        .catch(e => {
                            this.logger.warn(`[DISCORD] Failed to send webhook to ${name}`)
                        })
                })
        )
    }

    public sendHalo3CarnageReport = async (data: Halo3CarnageReportMessage) => {
        let message = {
            embeds: [{
                title: `${data.gametype} on ${data.map}`,
                description: data.winner
                    ? `${data.winner} wins!`
                    : 'Tie Game',
                fields: [
                    {
                        name: "Score",
                        value: data.winningScore,
                        inline: true
                    },
                    {
                        name: "Duration",
                        value: formatDuration(intervalToDuration(interval(data.startTime, data.finishTime))),
                        inline: true
                    },
                    {
                        name: "Players",
                        value: data.playerCount,
                        inline: true
                    }
                ],
                footer: {
                    "text": "Halo 3 Webstats - Blam Network",
                    "icon_url": "https://cdn.discordapp.com/icons/1287731261993127977/be1cefaceefbb03879db1c47ea0cfcb7.webp?size=64"
                },
                url: `https://blam.network/halo3/carnage-report/${data.carnageReportId}`,
                "thumbnail": {
                    "url": `https://blam.network/img/largemaps/${data.mapId}.jpg` // Adding map image URL here
                }
            }]
        }

        await this.sendWebhookMessage(WebhookType.HALO3_STATS, message);
    }
}