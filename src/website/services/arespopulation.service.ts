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

const ARES_NIGHTMAP_BACKGROUND_FILE = 'bnet_ares_nightmap_background.jpg';

@Injectable()
export class AresPopulationService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    private latLonToPixel = (lat, lon, width, height) => {
        const x = Math.floor(((lon + 180.0) / 360.0) * width);
        const y = Math.floor(((90.0 - lat) / 180.0) * height);
        return [x, y];
    }

    public getNightmap = async (hours: number = 6) => {
        const nightmapPath = join(process.cwd(), RESOURCES_FOLDER, ARES_NIGHTMAP_BACKGROUND_FILE);
        if (!existsSync(nightmapPath)) {
            this.logger.error("[TITLE] Unable to render Ares nightmap as the background image doesn't exist!");
            throw new NotFoundException()
        }

        // Get lat,long
        const latLongs: [number, number][] = [];

        const query = `SELECT DISTINCT crm.inaddr_online
            FROM "ares"."carnage_report_machine" crm
            INNER JOIN "ares"."carnage_report" cr ON cr.id = crm.carnage_report_id
            WHERE cr.finish_time >= NOW() AT TIME ZONE 'UTC' - INTERVAL '${hours.toString()} hours'`;
                
        const rawIps = await this.prisma.$queryRawUnsafe<{ inaddr_online: string }[]>(query);
        
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

