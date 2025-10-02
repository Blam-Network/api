import { Inject, Injectable } from "@nestjs/common";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { reach_player_data_nameplate } from "@prisma/client";

@Injectable()
export class HaloReachUserService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    public getUserFile = async (xuid: BigInt) => {
        // If the DB is too slow, or data isn't present, we'll return a file without player data or a service record.
        let fupd: undefined | BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_player_data = undefined;
        let srid: undefined | BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_service_record = undefined;

        const playerDataPromise = this.prisma.$transaction(async (prisma) => {
            const playerData = await prisma.reach_player_data.findUnique({ where: { player_xuid: xuid.toString() } });

            if (playerData) {
                let bungie_user_role = 0;
                bungie_user_role |= (1 << 0); // 7th column
                if (playerData.is_pro) bungie_user_role |= (1 << 1);
                if (playerData.is_bungie) bungie_user_role |= (1 << 2);
                if (playerData.has_blue_flames) bungie_user_role |= (1 << 3);

                let nameplate = BLF.haloreach_12065_11_08_24_1738_tu1actual.e_player_nameplate.none;
                switch (playerData.nameplate) {
                    case reach_player_data_nameplate.none:
                        nameplate = 0;
                        break;
                    case reach_player_data_nameplate.seventh_column:
                        nameplate = 1;
                        break;
                    case reach_player_data_nameplate.dmr:
                        nameplate = 2;
                        break;
                    case reach_player_data_nameplate.bungie:
                        nameplate = 3;
                        break;
                    case reach_player_data_nameplate.marathon:
                        nameplate = 4;
                        break;
                    case reach_player_data_nameplate.halo1:
                        nameplate = 5;
                        break;
                    case reach_player_data_nameplate.halo2:
                        nameplate = 6;
                        break;
                    case reach_player_data_nameplate.halo3:
                        nameplate = 7;
                        break;
                    case reach_player_data_nameplate.odst:
                        nameplate = 8;
                        break;
                    case reach_player_data_nameplate.assault_rifle:
                        nameplate = 9;
                        break;
                    case reach_player_data_nameplate.mk4_helmet:
                        nameplate = 10;
                        break;
                    case reach_player_data_nameplate.halo:
                        nameplate = 11;
                        break;
                    case reach_player_data_nameplate.allstar:
                        nameplate = 12;
                        break;
                }

                fupd = {
                    extras_portal_debug: playerData.extras_portal_debug,
                    nameplate, 
                    unlock_achievements: new Array(32).fill(0, 0, 32),
                    hopper_access: playerData.hopper_access ?? 0,
                    bungie_user_role,
                    hopper_directory: playerData.hopper_directory_override || 'default_hoppers'
                }
            }
        })

        await Promise.allSettled([playerDataPromise]);

        if (!fupd) {
            fupd = {
                bungie_user_role: 1,
                extras_portal_debug: false,
                hopper_access: 0,
                hopper_directory: 'default_hoppers',
                nameplate: BLF.haloreach_12065_11_08_24_1738_tu1actual.e_player_nameplate.seventh_column,
                unlock_achievements: new Array(32).fill(0, 0, 32),
            }
        }

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