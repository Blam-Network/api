import { Injectable, NotFoundException } from "@nestjs/common";
import * as BLF from "@blam-network/blf_lsp";
import { PrismaService } from "src/db/prisma.service";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { SCREENSHOTS_FOLDER, FILESHARE_FOLDER } from "src/constants";
import { parseXuid, xuidToHexString } from "src/xbox/xuid";

/** Serves Ares fileshare / blind screenshot BLF files from disk (uploads/fileshare/ares, uploads/screenshots/ares). */
@Injectable()
export class AresFileShareService {
  constructor(private readonly prisma: PrismaService) {}

  public viewBlindScreenshot = async (id: string): Promise<number[]> => {
    const dbScreenshot = await this.prisma.ares_blind_screenshot.findUnique({
      where: { id },
    });
    if (!dbScreenshot) throw new NotFoundException("screenshot not found");

    const screenshotPath = join(
      process.cwd(),
      SCREENSHOTS_FOLDER,
      "ares",
      xuidToHexString(BigInt(dbScreenshot.author_id.toFixed(0))),
      dbScreenshot.id,
    );

    if (!existsSync(screenshotPath)) throw new NotFoundException("screenshot file not found");

    const screenshot_12070 = BLF.halo3_12070_08_09_05_2031_halo3_ship.read_blind_screenshot(
      readFileSync(screenshotPath),
    );


    if (!screenshot_12070) throw new Error("Bad Screenshot File");

    return screenshot_12070?.scnd.jpeg_data;
  };

  public viewFileshareScreenshot = async (shareId: string, slot: number): Promise<number[]> => {
    const shareIdDecimal = parseXuid(shareId);
    const shareIdHex = xuidToHexString(shareIdDecimal);

    const screenshotPath = join(
      process.cwd(),
      FILESHARE_FOLDER,
      "ares",
      shareIdHex,
      slot.toString(),
    );

    if (!existsSync(screenshotPath)) throw new NotFoundException("fileshare screenshot file not found");

    const screenshot_12070 = BLF.halo3_12070_08_09_05_2031_halo3_ship.read_fileshare_screenshot(
      readFileSync(screenshotPath),
    );

    if (!screenshot_12070) throw new Error("Bad Screenshot File");

    return screenshot_12070?.scnd.jpeg_data;
  };
}
