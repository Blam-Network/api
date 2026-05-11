import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp'
import { PrismaService } from "src/db/prisma.service";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { FILESHARE_FOLDER, SCREENSHOTS_FOLDER } from "src/constants";
import { parseXuid, xuidToHexString } from "src/xbox/xuid";

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
            xuidToHexString(BigInt(dbScreenshot.author_id.toFixed(0))),
            dbScreenshot.id
        );

        if (!existsSync(screenshotPath)) throw new NotFoundException('screenshot file not found');
        let fileData = readFileSync(screenshotPath);

        let scnd: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_screenshot_data | undefined = undefined;

        if (!scnd) {
            const releaseBlfFile = BLF.haloreach_12065_11_08_24_1738_tu1actual.read_blind_screenshot(
                fileData,
            );
            if (releaseBlfFile) {
                scnd = releaseBlfFile.scnd;
            }
        }

        if (!scnd) {
            const betaBlfFile = BLF.haloreach_09730_10_04_09_1309_omaha_delta.read_blind_screenshot(
                fileData,
            );
            if (betaBlfFile) {
                scnd = betaBlfFile._cmp;
            }
        }

        if (!scnd) {
            const privateBetaBlfFile = BLF.haloreach_09449_10_03_25_1545_omaha_beta.read_blind_screenshot(
                fileData,
            );
            if (privateBetaBlfFile) {
                scnd = privateBetaBlfFile._cmp;
            }
        }


        if (!scnd) throw new Error('Bad Screenshot File');

        return scnd.jpeg_data;
    }

    /**
     * Reach fileshare stores one BLF per file under uploads/fileshare/haloreach/{ownerXuidHex}/{fileIdHex16}.
     * `fileId` is the decimal string `reach_file_share_file.id` (same value returned in fileshare listings).
     */
    public viewFileshareScreenshot = async (shareId: string, fileId: string): Promise<number[]> => {
        const shareXuid = parseXuid(shareId);
        const shareIdDecimal = shareXuid.toString();

        const file = await this.prisma.reach_file_share_file.findFirst({
            where: {
                id: fileId,
                share_id: shareIdDecimal,
                is_uploaded: true,
                file_type: 2,
            },
        });
        if (!file) {
            throw new NotFoundException('fileshare screenshot not found');
        }

        const fileIdBn = BigInt(file.id.toString());
        const hexName = fileIdBn.toString(16).toLowerCase().padStart(16, '0');
        const screenshotPath = join(
            process.cwd(),
            FILESHARE_FOLDER,
            'haloreach',
            xuidToHexString(shareXuid),
            hexName,
        );

        if (!existsSync(screenshotPath)) {
            throw new NotFoundException('fileshare screenshot file not found');
        }

        const fileData = readFileSync(screenshotPath);

        let scnd: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_screenshot_data | undefined;

        const releaseBlfFile = BLF.haloreach_12065_11_08_24_1738_tu1actual.read_blind_screenshot(fileData);
        if (releaseBlfFile) {
            scnd = releaseBlfFile.scnd;
        }
        if (!scnd) {
            const betaBlfFile = BLF.haloreach_09730_10_04_09_1309_omaha_delta.read_blind_screenshot(fileData);
            if (betaBlfFile) {
                scnd = betaBlfFile._cmp;
            }
        }
        if (!scnd) {
            const privateBetaBlfFile = BLF.haloreach_09449_10_03_25_1545_omaha_beta.read_blind_screenshot(fileData);
            if (privateBetaBlfFile) {
                scnd = privateBetaBlfFile._cmp;
            }
        }

        if (!scnd) {
            throw new Error('Bad Screenshot File');
        }

        return scnd.jpeg_data;
    };
}

