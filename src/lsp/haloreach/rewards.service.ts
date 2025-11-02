import { Inject, Injectable } from "@nestjs/common";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";

// This is configured in the network configuration file. Please update both together.
const DAILY_COOKIE_LIMIT_ONLINE = 200_000;
const REWARDS_UPDATE_COOKIE_LIMIT = 25_000; // https://www.bungie.net/en/Forums/Post/14406965?sort=0&page=0&path=1

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

    private playerHasLegacySunriseUnlocks = (rupl: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_reward_persistence_upload_to_lsp) => {
        const LEGACY_SUNRISE_CREDITS = 200_000_000;

        const withinLegacySunriseCookieRange = rupl.alltime_cookie_count >= LEGACY_SUNRISE_CREDITS && rupl.alltime_cookie_count <= LEGACY_SUNRISE_CREDITS + DAILY_COOKIE_LIMIT_ONLINE;
        const hasLegacySunriseArmorUnlocks = rupl.alltime_purchased_items.slice(0, 200).every(armor => {
            return armor.purchased && !armor.bypassed && !armor.forced_visible_and_purchasable && !armor.granted_by_lsp && !armor.banned
        })

        return withinLegacySunriseCookieRange && hasLegacySunriseArmorUnlocks;
    }

    public resetPlayerRewards = async (xuid: BigInt) => {
        // Drop data if it exists
        await this.prisma.reach_player_data.deleteMany({ where: { player_xuid: xuid.toString() }});

        // Create default
        await this.prisma.reach_player_rewards.create({
            data: {
                player_xuid: xuid.toString(),
                credits: 0,
                credits_award: 5000,
            }
        })
    }

    public updatePlayerRewards = async (xuid: BigInt, rupl: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_reward_persistence_upload_to_lsp): Promise<void> => {
        if (!await this.useNewRewardsSystem(xuid)) return;

        const currentData = (await this.prisma.reach_player_rewards.findUnique({ where: { player_xuid: xuid.toString() }}));
        const isNewPlayer = currentData == null;
        // If the player is new, if they have stats from Bungie we want to save them, if they have all unlocks from Sunrise we want to reset them.
        if (isNewPlayer) {
            this.logger.log(`New player ${rupl.player_name} submitting rewards.`)
            const playerHasLegacySunriseUnlocks = this.playerHasLegacySunriseUnlocks(rupl);
            if (playerHasLegacySunriseUnlocks) {
                this.logger.log(`${rupl.player_name} has Sunrise unlocks. Resetting`)
                await this.resetPlayerRewards(xuid);
            } 
            else {
                this.logger.log(`${rupl.player_name} has Bungie stats, storing`)
                await this.prisma.reach_player_rewards.create({
                    data: {
                        player_xuid: xuid.toString(),
                        credits: rupl.alltime_cookie_count
                    }
                })
            }

            return;
        }

        if (currentData.reset_rewards) {
            this.logger.log(`Resetting rewards for ${rupl.player_name}`)
            await this.resetPlayerRewards(xuid);
            return;
        }

        const hasTooManyCredits = rupl.alltime_cookie_count - currentData.credits > REWARDS_UPDATE_COOKIE_LIMIT;

        if (hasTooManyCredits) {
            this.logger.log(`${rupl.player_name} has too many credits. Skipping update`)
            // clamp down credits AND unlocked items.
            return;
        }
        
        this.logger.log(`${rupl.player_name} earned credits.`)
        await this.prisma.reach_player_rewards.update({
            where: {
                player_xuid: xuid.toString(),
            },
            data: {
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
                awarded_credits: 0,
                unknown6: 0,
            }
        }

        const playerRewards = await this.prisma.reach_player_rewards.findUnique({ where: { player_xuid: xuid.toString() } });

        // If we've award the player credits, we can clear the pending award now.
        if (playerRewards?.credits_award) {
            await this.prisma.reach_player_rewards.update({
                where: {
                    player_xuid: xuid.toString(),
                },
                data: {
                    credits_award: 0,
                }
            })
        }
        
        return {
            credits: playerRewards?.credits || 0,
            unknown1: 0,
            commendations: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_persistent_per_commendation_state>(128).fill({
                unknown0: 1, 
                unknown1: 1
            }),
            purchased_items: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.e_purchase_state>(200).fill({
                purchased: false,
                banned: false,
                bypassed: false,
                granted_by_lsp: false,
                forced_visible_and_purchasable: true,
            }),
            unknown2: 0,
            unknown3: 0,
            unknown4: playerRewards?.updatedAt || new Date(0),
            awarded_credits: playerRewards?.credits_award || 0,
            unknown6: 0,
        }
    }
}