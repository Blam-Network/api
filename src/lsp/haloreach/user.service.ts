import { Inject, Injectable } from "@nestjs/common";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";

@Injectable()
export class HaloReachUserService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    public getUserFile = async (xuid: string) => {
        const player_xuid = parseXuid(xuid);
        // If the DB is too slow, or data isn't present, we'll return a file without player data or a service record.
        let fupd: undefined | BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_player_data = undefined;
        let srid: undefined | BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_service_record = undefined;

        
        const playerDataPromise = this.prisma.$transaction(async (prisma) => {
            const playerData = await prisma.player_data_reach.findUnique({ where: { player_xuid } });

            if (playerData) {
                fupd = {
                    unknown1: 0,
                    unknown2: new Array(0x20).fill(0, 0, 0x20),
                    unknown3: 0,
                    hopper_access: playerData.hopper_access ?? 0,
                    bungie_user_role: 0,
                    hopper_directory: playerData.hopper_directory_override || 'default_hoppers'
                }
            }
        })

        await Promise.allSettled([playerDataPromise]);

        // Typescript is dumb
        // @ts-ignore
        let name = srid ? srid.player_name : '<unknown>';
        this.logger.log(`[USER] user file requested for user ${xuid} / ${name}`)

        return BLF.haloreach_12065_11_08_24_1738_tu1actual.build_user_file(
            fupd,
            srid,
        );
    }

    // TODO: Implement
    public getRecentPlayersFile = (_xuid: string) => {
        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_recent_players_file({
            players: []
        })
    }
}