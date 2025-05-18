import { Injectable } from "@nestjs/common";
import * as BLF from '@blam-network/blf_lsp';

@Injectable()
export class HaloReachUserService {
    // TODO: Implement
    public getUserFile = (_xuid: string) => {
        return BLF.haloreach_12065_11_08_24_1738_tu1actual.build_user_file(
            {
                bungie_user_role: 0,
                hopper_access: 0,
                hopper_directory: 'default_hoppers',
                unknown1: 0,
                unknown2: new Array(0x20).fill(0),
                unknown3: 0,
            },
            undefined
        );
    }

    // TODO: Implement
    public getRecentPlayersFile = (_xuid: string) => {
        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_recent_players_file({
            players: []
        })
    }
}