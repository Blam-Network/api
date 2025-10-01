import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp'
import { PrismaService } from "src/db/prisma.service";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { SCREENSHOTS_FOLDER } from "src/constants";

@Injectable()
export class HaloReachFileShareService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    public viewBlindScreenshot = async (id: string): Promise<number[]> => {
        const dbScreenshot = await this.prisma.reach_blind_screenshot.findUnique({
            where: {
                id
            }
        });
        if (!dbScreenshot) throw new NotFoundException('screenshot not found');

        const screenshotPath = join(
            process.cwd(),
            SCREENSHOTS_FOLDER,
            'haloreach',
            BigInt(dbScreenshot.author_id.toFixed(0)).toString(16).toUpperCase().padStart(16, '0'),
            dbScreenshot.id
        );

        console.log({screenshotPath});

        if (!existsSync(screenshotPath)) throw new NotFoundException('screenshot file not found');

        const blfFile = BLF.haloreach_12065_11_08_24_1738_tu1actual.read_blind_screenshot(
            readFileSync(screenshotPath),
        );

        if (!blfFile) throw new Error('Bad Screenshot File');

        return blfFile._cmp.jpeg_data;
    }
}

