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
                bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.is_bnet_user;
                if (playerData.is_pro) bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.is_pro;
                if (playerData.is_bungie) bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.is_bungie;
                if (playerData.is_vip) bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.debug_enabled;

                switch (playerData.nameplate) {
                    case reach_player_data_nameplate.none:
                        break;
                    case reach_player_data_nameplate.seventh_column:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_seventh_column;
                        break;
                    case reach_player_data_nameplate.dmr:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_dmr;
                        break;
                    case reach_player_data_nameplate.bungie:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_bungie;
                        break;
                    case reach_player_data_nameplate.marathon:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_marathon;
                        break;
                    case reach_player_data_nameplate.halo1:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_halo1;
                        break;
                    case reach_player_data_nameplate.halo2:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_halo2;
                        break;
                    case reach_player_data_nameplate.halo3:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_halo3;
                        break;
                    case reach_player_data_nameplate.odst:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_odst;
                        break;
                    case reach_player_data_nameplate.assault_rifle:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_assault_rifle;
                        break;
                    case reach_player_data_nameplate.mk4_helmet:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_mk4_helmet;
                        break;
                    case reach_player_data_nameplate.halo:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_halo;
                        break;
                    case reach_player_data_nameplate.allstar:
                        bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_allstar;
                        break;
                }
                
                fupd = {
                    extras_portal_debug: playerData.extras_portal_debug,
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
                bungie_user_role: BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.nameplate_seventh_column,
                extras_portal_debug: false,
                hopper_access: 0,
                hopper_directory: 'default_hoppers',
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