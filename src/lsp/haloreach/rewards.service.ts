import { Inject, Injectable } from "@nestjs/common";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";

@Injectable()
export class HaloReachRewardsService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    private useNewRewardsSystem = async (xuid: BigInt): Promise<boolean> => {
        const playerData = await this.prisma.reach_player_data.findUnique({ where: { player_xuid: xuid.toString() } });
        return !!playerData?.is_bungie
    }

    public updatePlayerRewards = async (xuid: BigInt, rupl: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_reward_persistence_upload_to_lsp): Promise<void> => {
        if (!await this.useNewRewardsSystem(xuid)) return;

        await this.prisma.reach_player_rewards.upsert({
            where: {
                player_xuid: xuid.toString(),
            },
            update: {
                credits: rupl.alltime_cookie_count,
            },
            create: {
                player_xuid: xuid.toString(),
                credits: rupl.alltime_cookie_count,
            },
        });
    }

    public getPlayerRewards = async (xuid: BigInt): Promise<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_rewards_persistance> => {
        if (!await this.useNewRewardsSystem(xuid)) {
            return {
                credits: 200_000_000, // credits?,
                unknown1: 0,
                commendations: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_persistent_per_commendation_state>(128).fill({
                    unknown0: 0, 
                    unknown1: 0
                }),
                purchased_items: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.e_purchase_state>(200).fill({
                    purchased: true,
                    banned: false,
                    bypassed: false,
                    granted_by_lsp: false,
                    forced_visible_and_purchasable: false,
                }),
                unknown2: 0,
                unknown3: 0,
                unknown4: new Date(0),
                unknown5: 0,
                unknown6: 0,
            }
        }

        const playerRewards = await this.prisma.reach_player_rewards.findUnique({where: {player_xuid: xuid.toString() }});
        return {
            credits: playerRewards?.credits || 0,
            unknown1: 0,
            commendations: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_persistent_per_commendation_state>(128).fill({
                unknown0: 1, 
                unknown1: 1
            }),
            purchased_items: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.e_purchase_state>(200).fill({
                purchased: true,
                banned: false,
                bypassed: true,
                granted_by_lsp: true,
                forced_visible_and_purchasable: true,
            }),
            unknown2: 0,
            unknown3: 0,
            unknown4: playerRewards?.updatedAt || new Date(0),
            unknown5: 0,
            unknown6: 0,
        }
    }
}