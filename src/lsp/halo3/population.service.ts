import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import { z } from "zod";
import { lookup } from 'geoip-lite'; // Or whatever you use to resolve IPs
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { RESOURCES_FOLDER } from "../../constants";
import * as sharp from "sharp";
import { NotFoundError } from "rxjs";

const HALO3_NIGHTMAP_BACKGROUND_FILE = 'halo3_nightmap_background.jpg';

@Injectable()
export class Halo3PopulationService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    public getHopperStatistics = async () => {
        let hopperStats: BLF.halo3_12070_08_09_05_2031_halo3_ship.s_blf_chunk_matchmaking_hopper_statistics['data'] = [];

        await Promise.allSettled([this.prisma.$transaction(async () => {
            const hopperPopulationResponse = await this.prisma.$queryRaw`
                SELECT COUNT(player_xuid)::int AS player_count, hopper_identifier
                FROM (
                    SELECT DISTINCT ON (crp.player_xuid)
                        crp.player_xuid,
                        crmo.hopper_identifier
                    FROM "halo3"."carnage_report_player" crp
                    INNER JOIN "halo3"."carnage_report" cr ON cr.id = crp.carnage_report_id
                    INNER JOIN "halo3"."carnage_report_matchmaking_options" crmo ON crmo.id = crp.carnage_report_id
                    WHERE cr.finish_time >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 hours'
                    ORDER BY crp.player_xuid, cr.finish_time DESC
                ) AS hopper_players
                GROUP BY hopper_identifier
                ORDER BY COUNT(player_xuid) DESC
                LIMIT 32;
            `;

            hopperStats = z.object({
                player_count: z.number(),
                hopper_identifier: z.number()
            }).array().parse(hopperPopulationResponse);
        }, { timeout: 5000 })]);

        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_hopper_statistics_file({
            data: hopperStats.concat(Array(32 - hopperStats.length).fill({ hopper_identifier: 0, player_count: 0 })),
            player_count: hopperStats.reduce((count, hp) => count + hp.player_count, 0)
        })
    }

    private latLonToPixel = (lat, lon, width, height) => {
        const x = Math.floor(((lon + 180.0) / 360.0) * width);
        const y = Math.floor(((90.0 - lat) / 180.0) * height);
        return [x, y];
    }

    public getNightmap = async () => {
        const nightmapPath = join(process.cwd(), RESOURCES_FOLDER, HALO3_NIGHTMAP_BACKGROUND_FILE);
        if (!existsSync(nightmapPath)) {
            this.logger.error("[TITLE] Unable to render Halo 3 nightmap as the background image doesn't exist!");
            throw new NotFoundException()
        }

        // Get lat,long
        const latLongs: [number, number][] = [];

        const rawIps = await this.prisma.$queryRaw<
            { inaddr_online: string }[]
        >`
            SELECT DISTINCT crm.inaddr_online
            FROM "halo3"."carnage_report_machine" crm
            INNER JOIN "halo3"."carnage_report" cr ON cr.id = crm.carnage_report_id
            WHERE cr.finish_time >= NOW() AT TIME ZONE 'UTC' - INTERVAL '12 hours'
        `;

        for (const { inaddr_online } of rawIps) {
            try {
                // Either use geoip-lite:
                const geo = lookup(inaddr_online);
                if (geo && geo.ll) {
                    const [lat, lon] = geo.ll;
                    latLongs.push([lat, lon]);
                }
            } catch (e) {
                continue; // ignore errors
            }
        }

        // Draw nightmap
        const imageBuffer = await readFile(nightmapPath);

        let img = sharp(imageBuffer);
        const metadata = await img.metadata();
        const width = metadata.width;
        const height = metadata.height;

        if (!width || !height) {
            throw new InternalServerErrorException("Failed to read width and height of nightmap background.")
        }
      
        const points = latLongs
          .map(([lat, lon]) => this.latLonToPixel(lat, lon, width - 50, height + 40))
          .filter(([x, y]) => x < width && y < height)
          .map(([x, y]) => ({
            input: {
              create: {
                width: 1,
                height: 1,
                channels: 4 as const,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
              }
            },
            top: y - 5,
            left: x + 15
          }));

        return img.composite(points).jpeg({ quality: 100 }).toBuffer();
    }

}
