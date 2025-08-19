import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp'
import { PrismaService } from "src/db/prisma.service";
import { join } from "path";
import { createReadStream, existsSync, readFileSync, readSync } from "fs";
import { SCREENSHOTS_FOLDER } from "src/constants";

@Injectable()
export class Halo3FileShareService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    public viewBlindScreenshot = async (id: string): Promise<number[]> => {
        const dbScreenshot = await this.prisma.halo3_blind_screenshot.findUnique({
            where: {
                id
            }
        });
        if (!dbScreenshot) throw new NotFoundException('screenshot not found');

        const screenshotPath = join(
            process.cwd(),
            SCREENSHOTS_FOLDER,
            'halo3',
            Number(dbScreenshot.author_id).toString(16).toUpperCase().padStart(16, '0'),
            dbScreenshot.id
        );

        console.log({screenshotPath});

        if (!existsSync(screenshotPath)) throw new NotFoundException('screenshot file not found');

        const blfFile = BLF.halo3_12070_08_09_05_2031_halo3_ship.read_blind_screenshot(
            readFileSync(screenshotPath),
        );

        if (!blfFile) throw new Error('Bad Screenshot File');

        return blfFile.scnd.jpeg_data;
    }

    public viewOdstBlindScreenshot = async (id: string): Promise<number[]> => {
        const dbScreenshot = await this.prisma.odst_blind_screenshot.findUnique({
            where: {
                id
            }
        });
        if (!dbScreenshot) throw new NotFoundException('screenshot not found');

        const screenshotPath = join(
            process.cwd(),
            SCREENSHOTS_FOLDER,
            'halo3odst',
            Number(dbScreenshot.author_id).toString(16).toUpperCase().padStart(16, '0'),
            dbScreenshot.id
        );

        console.log({screenshotPath});

        if (!existsSync(screenshotPath)) throw new NotFoundException('screenshot file not found');

        const blfFile = BLF.halo3odst_13895_09_04_27_2201_atlas_release.read_blind_screenshot(
            readFileSync(screenshotPath),
        );

        if (!blfFile) throw new Error('Bad Screenshot File');

        return blfFile.scnd.jpeg_data;
    }
}

