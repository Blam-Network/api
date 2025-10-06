import { Inject, Injectable } from "@nestjs/common"
import axios from "axios"
import { formatDuration, interval, intervalToDuration } from "date-fns"
import { existsSync } from "fs"
import { readFile, stat } from "fs/promises"
import { join } from "path"
import { PrismaService } from "src/db/prisma.service"
import ILogger, { ILoggerSymbol } from "src/ILogger"
import { z } from "zod"

const WebhookTypeSchema = z.enum([
    'HALO3_CARNAGE_REPORTS',
    'HALO3_SCREENSHOTS',
    'HALOREACH_SCREENSHOTS',
    'CRASH'
]);

const WebhookType = WebhookTypeSchema.Enum;

const WebhookConfigSchema = z.object({
    name: z.string().optional(),
    types: WebhookTypeSchema.array(),
    url: z.string().url()
}).array()

type WebhookConfig = z.infer<typeof WebhookConfigSchema>;
type WebhookType = z.infer<typeof WebhookTypeSchema>;

type Halo3CarnageReportMessage = {
    carnageReportId: string,
    gametype: string,
    map: string,
    mapId: number,
    hopperName?: string,
    playerCount: number,
    startTime: Date,
    finishTime: Date,
    winningScore: number,
    teamGame: boolean,
    winner?: string,
}

type Halo3ScreenshotMessage = {
    name: string,
    description: string,
    authorXuid: BigInt,
    authorName: string,
    imageUrl: string,
}

type HaloReachScreenshotMessage = {
    name: string,
    description: string,
    authorXuid: BigInt,
    authorName: string,
    imageUrl: string,
}

@Injectable()
export class DiscordWebhookService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) {}

    private configModifiedAt: number | undefined = undefined;
    private config: WebhookConfig | undefined = undefined;

    private loadWebhookConfig = async () => {
        const configPath = join(process.cwd(), 'config', 'webhooks.json');
        if (!existsSync(configPath)) {
            this.logger.warn("[DISCORD] No webhooks config file was found, webhooks will not be sent.")
        }
        const stats = await stat(configPath);
        if (stats.mtimeMs !== this.configModifiedAt) {
            if (this.configModifiedAt !== undefined) {
                this.logger.log(`[DISCORD] Webhook config modified, reloading.`)
            }
            try {
                const configFile = await readFile(configPath, {encoding: 'utf8'});
                this.config = WebhookConfigSchema.parse(JSON.parse(configFile));
                
            } catch (e) {
                this.logger.error(`[DISCORD] Failed to load webhook config.`)
                this.logger.error(e)
                this.config = [];
            }
            this.configModifiedAt = stats.mtimeMs;
        }
    }

    private sendWebhookMessage = async (type: WebhookType, message: Object) => {
        await this.loadWebhookConfig();
        if (!this.config) return;
        return Promise.allSettled(
            this.config
                .filter(wh => wh.types.includes(type))
                .map(({url, name}) => {
                    this.logger.debug(`[DISCORD] Sending webhook to ${name}`)
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

        await this.sendWebhookMessage(WebhookType.HALO3_CARNAGE_REPORTS, message);
    }

    public sendHalo3Screenshot = async (data: Halo3ScreenshotMessage) => {
        const serviceRecord = await this.prisma.halo3_service_record.findUnique({
            where: {
                player_xuid: data.authorXuid.toString()
            }
        })

        let authorName = data.authorName;
        let authorIconUrl: undefined | string = undefined;

        if (serviceRecord) {
            let params = new URLSearchParams({
                primary: serviceRecord.foreground_emblem.toString(),
                secondary: serviceRecord.emblem_flags ? 'true' : 'false',
                background: serviceRecord.background_emblem.toString(),
                primary_color: serviceRecord.emblem_primary_color.toString(),
                secondary_color: serviceRecord.emblem_secondary_color.toString(),
                background_color: serviceRecord.emblem_background_color.toString(),
                size: '100'
            });

            authorName = `${data.authorName} - ${serviceRecord.service_tag}`;
            authorIconUrl = `https://halo3.blam.network/halo3/emblem?` + params.toString() 
        }
        
        let message = {
            embeds: [{
                "title": data.name,
                "description": data.description,
                "url": data.imageUrl,
                "color": 941076,
                "author": {
                    "name": authorName,
                    "icon_url": authorIconUrl
                },
                "footer": {
                    "text": "Halo 3 Screenshots - Blam Network",
                    "icon_url": "https://cdn.discordapp.com/icons/1287731261993127977/be1cefaceefbb03879db1c47ea0cfcb7.webp?size=64"
                },
                "image": {
                    "url": data.imageUrl,
                }
            }]
        }

        await this.sendWebhookMessage(WebhookType.HALO3_SCREENSHOTS, message);
    }

    public sendHalo3ODSTScreenshot = async (data: Halo3ScreenshotMessage) => {
        let message = {
            embeds: [{
                "title": data.name,
                "description": data.description,
                "url": data.imageUrl,
                "color": 941076,
                "author": {
                    "name": data.authorName,
                },
                "footer": {
                    "text": "Halo 3: ODST Screenshots - Blam Network",
                    "icon_url": "https://cdn.discordapp.com/icons/1287731261993127977/be1cefaceefbb03879db1c47ea0cfcb7.webp?size=64"
                },
                "image": {
                    "url": data.imageUrl,
                }
            }]
        }

        await this.sendWebhookMessage(WebhookType.HALO3_SCREENSHOTS, message);
    }

    public sendHaloReachScreenshot = async (data: HaloReachScreenshotMessage) => {
        let message = {
            embeds: [{
                "title": data.name,
                "description": data.description,
                "url": data.imageUrl,
                "color": 941076,
                "author": {
                    "name": data.authorName,
                },
                "footer": {
                    "text": "Halo: Reach Screenshots - Blam Network",
                    "icon_url": "https://cdn.discordapp.com/icons/1287731261993127977/be1cefaceefbb03879db1c47ea0cfcb7.webp?size=64"
                },
                "image": {
                    "url": data.imageUrl,
                }
            }]
        }

        await this.sendWebhookMessage(WebhookType.HALOREACH_SCREENSHOTS, message);
    }
}