import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import { join } from "path";
import { find_chunk } from "@blamnetwork/blf";
import {
  s_blf_chunk_auth_upload_image,
  s_blf_chunk_compressed_data,
} from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import { auiu_chunk_to_png } from "@blamnetwork/blf/helpers";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { SPARTAN_RENDER_FOLDER } from "../../constants";
import { xuidToHexString } from "src/xbox/xuid";

@Injectable()
export class HaloReachSpartanRenderService {
  constructor(@Inject(ILoggerSymbol) private readonly logger: ILogger) {}

  /**
   * Persist a `UserUpdateImage.ashx` upload: original BLF plus converted PNG.
   * Layout: `uploads/spartan_renders/haloreach/{xuidHex}.png`
   */
  async storeUserSpartanRender(
    userXuid: bigint,
    blfBytes: Buffer
  ): Promise<void> {
    const file = new Uint8Array(blfBytes);
    const cmp = new s_blf_chunk_compressed_data(s_blf_chunk_auth_upload_image);
    if (!find_chunk(file, cmp, "big")) {
      throw new BadRequestException(
        "Upload does not contain _cmp-wrapped auiu 1.2 Spartan render."
      );
    }

    const png = auiu_chunk_to_png(cmp.chunk);

    const folder = join(
      process.cwd(),
      SPARTAN_RENDER_FOLDER,
      "haloreach"
    );
    await mkdir(folder, { recursive: true });

    const baseName = xuidToHexString(userXuid);
    const pngPath = join(folder, `${baseName}.png`);

    // await writeFile(blfPath, blfBytes);
    await writeFile(pngPath, png);

    this.logger.log(
      `[SpartanRender] Stored render for ${xuidToHexString(userXuid)}: ${pngPath}`
    );
  }

  /** Latest stored PNG for a player, or `null` if none exist. */
  async getSpartanRenderPng(userXuid: bigint): Promise<Buffer | null> {
    const folder = join(
      process.cwd(),
      SPARTAN_RENDER_FOLDER,
      "haloreach"
    );

    const pngPath = join(folder, `${xuidToHexString(userXuid)}.png`);
    if (!(await stat(pngPath)).isFile()) {
      return null;
    }
    return await readFile(pngPath);
  }
}
