import { Injectable, NotFoundException } from "@nestjs/common";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { find_chunk } from "@blamnetwork/blf";
import { s_blf_chunk_hopper_configuration_table } from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import { TITLE_STORAGE_FOLDER } from "src/constants";

const MATCHMAKING_HOPPER_PATH = join(
    TITLE_STORAGE_FOLDER,
    "4d53085b",
    "tracked",
    "12065",
    "default_hoppers",
    "matchmaking_hopper_027.bin",
);

export type ReachHopperNameMap = Record<string, string>;

@Injectable()
export class HaloReachHoppersService {
    private cachedHoppers: ReachHopperNameMap | null = null;

    resolveHopperName(hopperId: number | null | undefined): string | null {
        if (hopperId == null || hopperId <= 0) {
            return null;
        }
        return this.getHopperNames()[String(hopperId)] ?? null;
    }

    getHopperNames(): ReachHopperNameMap {
        if (this.cachedHoppers) {
            return this.cachedHoppers;
        }

        const filePath = join(process.cwd(), MATCHMAKING_HOPPER_PATH);
        if (!existsSync(filePath)) {
            throw new NotFoundException(
                `Matchmaking hopper configuration not found at ${MATCHMAKING_HOPPER_PATH}`,
            );
        }

        const file = new Uint8Array(readFileSync(filePath));
        const chunk = new s_blf_chunk_hopper_configuration_table();
        if (!find_chunk(file, chunk, "big")) {
            throw new NotFoundException(
                "Matchmaking hopper file does not contain mhcf 27.1",
            );
        }

        const hoppers: ReachHopperNameMap = {};
        for (const configuration of chunk.hopper_configurations) {
            if (!configuration.hopper_name) {
                continue;
            }
            hoppers[String(configuration.identifier)] = configuration.hopper_name;
        }

        this.cachedHoppers = hoppers;
        return hoppers;
    }
}
