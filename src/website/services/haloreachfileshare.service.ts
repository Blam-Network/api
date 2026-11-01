import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as H3 from '@blamnetwork/blf/halo3/v12070_08_09_05_2031_halo3_ship';
import { PrismaService } from "src/db/prisma.service";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { FILESHARE_FOLDER, SCREENSHOTS_FOLDER } from "src/constants";
import { parseXuid, xuidToHexString } from "src/xbox/xuid";
import { read_reach_09449_blind_screenshot, read_reach_09730_blind_screenshot, read_reach_blind_screenshot } from 'src/utils/blf_files';

@Injectable()
export class HaloReachFileShareService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    public viewBlindScreenshot = async (id: string): Promise<Uint8Array> => {
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

        let scnd: H3.s_blf_chunk_screenshot_data | undefined = undefined;

        if (!scnd) {
            const releaseBlfFile = read_reach_blind_screenshot(
                fileData,
            );
            if (releaseBlfFile) {
                scnd = releaseBlfFile.scnd;
            }
        }

        if (!scnd) {
            const betaBlfFile = read_reach_09730_blind_screenshot(
                fileData,
            );
            if (betaBlfFile) {
                scnd = betaBlfFile._cmp.chunk;
            }
        }

        if (!scnd) {
            const privateBetaBlfFile = read_reach_09449_blind_screenshot(
                fileData,
            );
            if (privateBetaBlfFile) {
                scnd = privateBetaBlfFile._cmp.chunk;
            }
        }


        if (!scnd) throw new Error('Bad Screenshot File');

        return scnd.jpeg_data;
    }

    /**
     * Reach fileshare stores one BLF per file under uploads/fileshare/haloreach/{ownerXuidHex}/{fileIdHex16}.
     * `fileId` is the decimal string `reach_file_share_file.id` (same value returned in fileshare listings).
     */
    public viewFileshareScreenshot = async (shareId: string, fileId: string): Promise<Uint8Array> => {
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

        let scnd: H3.s_blf_chunk_screenshot_data | undefined;

        const releaseBlfFile = read_reach_blind_screenshot(fileData);
        if (releaseBlfFile) {
            scnd = releaseBlfFile.scnd;
        }
        if (!scnd) {
            const betaBlfFile = read_reach_09730_blind_screenshot(fileData);
            if (betaBlfFile) {
                scnd = betaBlfFile._cmp.chunk;
            }
        }
        if (!scnd) {
            const privateBetaBlfFile = read_reach_09449_blind_screenshot(fileData);
            if (privateBetaBlfFile) {
                scnd = privateBetaBlfFile._cmp.chunk;
            }
        }

        if (!scnd) {
            throw new Error('Bad Screenshot File');
        }

        return scnd.jpeg_data;
    };
}

