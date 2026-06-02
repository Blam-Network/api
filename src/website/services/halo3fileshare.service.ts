import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { find_chunk } from "@blamnetwork/blf";
import {
    s_blf_chunk_compressed_data,
    s_blf_chunk_screenshot_data,
} from "@blamnetwork/blf/halo3odst/v13895_09_04_27_2201_atlas_release";
import * as BLF from '@blam-network/blf_lsp'
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { join } from "path";
import { createReadStream, existsSync, readFileSync, readSync } from "fs";
import { SCREENSHOTS_FOLDER, FILESHARE_FOLDER } from "src/constants";
import { xuidToHexString, parseXuid } from "src/xbox/xuid";

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
            xuidToHexString(BigInt(dbScreenshot.author_id.toFixed(0))),
            dbScreenshot.id
        );

        if (!existsSync(screenshotPath)) throw new NotFoundException('screenshot file not found');

        const screenshot_12070 = BLF.halo3_12070_08_09_05_2031_halo3_ship.read_blind_screenshot(
            readFileSync(screenshotPath),
        );

        const screenshot_11637 = BLF.halo3_11637_07_08_02_2348_release.read_blind_screenshot(
            readFileSync(screenshotPath),
        );

        if (!screenshot_12070 && !screenshot_11637) throw new Error('Bad Screenshot File');

        return screenshot_12070?.scnd.jpeg_data || screenshot_11637?.scnd.jpeg_data;
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
            xuidToHexString(BigInt(dbScreenshot.author_id.toFixed(0))),
            dbScreenshot.id
        );

        if (!existsSync(screenshotPath)) throw new NotFoundException('screenshot file not found');

        const blfFile = BLF.halo3odst_13895_09_04_27_2201_atlas_release.read_blind_screenshot(
            readFileSync(screenshotPath),
        );

        if (!blfFile) throw new Error('Bad Screenshot File');

        return blfFile.scnd.jpeg_data;
    }

    public viewFileshareScreenshot = async (shareId: string, slot: number): Promise<number[]> => {
        const shareIdDecimal = parseXuid(shareId);
        const shareIdHex = xuidToHexString(shareIdDecimal);

        const screenshotPath = join(
            process.cwd(),
            FILESHARE_FOLDER,
            'halo3',
            shareIdHex,
            slot.toString()
        );

        if (!existsSync(screenshotPath)) throw new NotFoundException('fileshare screenshot file not found');

        const screenshot_12070 = BLF.halo3_12070_08_09_05_2031_halo3_ship.read_fileshare_screenshot(
            readFileSync(screenshotPath),
        );

        if (!screenshot_12070) throw new Error('Bad Screenshot File');

        return screenshot_12070?.scnd.jpeg_data;
    }

    public viewOdstFileshareScreenshot = async (shareId: string, slot: number): Promise<number[]> => {
        const shareIdDecimal = parseXuid(shareId);
        const shareIdHex = xuidToHexString(shareIdDecimal);

        const screenshotPath = join(
            process.cwd(),
            FILESHARE_FOLDER,
            'halo3',
            shareIdHex,
            slot.toString()
        );

        if (!existsSync(screenshotPath)) throw new NotFoundException('fileshare screenshot file not found');

        const cmp = new s_blf_chunk_compressed_data(s_blf_chunk_screenshot_data);
        if (!find_chunk(readFileSync(screenshotPath), cmp, "big")) {
            throw new InternalServerErrorException("Bad Screenshot File");
        }

        return Array.from(cmp.chunk.jpeg_data);
    }
}

