import { Inject, Injectable } from "@nestjs/common";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { Prisma, reach_armour } from "@prisma/client";

// This is configured in the network configuration file. Please update both together.
const DAILY_COOKIE_LIMIT_ONLINE = 200_000;
const REWARDS_UPDATE_COOKIE_LIMIT = 25_000; // https://www.bungie.net/en/Forums/Post/14406965?sort=0&page=0&path=1
// Halo: Reach armour constants at EOF.

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
        await this.prisma.reach_player_rewards_armour.deleteMany({
            where: {
                player_xuid: xuid.toString(),
            }
        })

        // Create default
        await this.prisma.reach_player_rewards.create({
            data: {
                player_xuid: xuid.toString(),
                credits: 5000,
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

        // If the player lost cookies... give them back.
        if (currentData.credits > rupl.alltime_cookie_count) {
            this.logger.debug(`${rupl.player_name} lost cookies! Ignoring update.`)
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
        
        // loop through purchased armour and check how much we can afford.
        let purchasedArmour: HaloReachArmour[] = [];
        let creditsAvailableForArmour = rupl.alltime_cookie_count;
        for (let index = 0; index < rupl.unknown_51b_purchases_count; index++) {
            let armour = toHaloReachArmour(rupl.unknown_520_purchases[index]);
            if (armour === undefined) {
                this.logger.warn(`The player has purchased an unknown armour piece (${rupl.unknown_520_purchases[index]}), skipping.`);
                continue;
            }
            let armourCost = armourCosts[armour];
            if (armourCost > creditsAvailableForArmour) {
                this.logger.warn(`The player has purchased more armour than they can afford skipping ${rupl.unknown_51b_purchases_count - (index + 1)} remaining armours.`);
                break;
            }
            console.log({armour, creditsAvailableForArmour, armourCost})
            purchasedArmour.push(armour);
            creditsAvailableForArmour -= armourCost;
        }

        await this.prisma.reach_player_rewards.update({
            where: {
                player_xuid: xuid.toString(),
            },
            data: {
                credits: rupl.alltime_cookie_count,
            },
        });

        await this.prisma.$transaction(
            purchasedArmour.map((armour) => {
                const purchase_state = rupl.alltime_purchased_items[armour as number];

                // If the user purchases a DLC item, we assume they have the DLC...
                // so we unlock that item permanantly for the user in case they switch console.
                const hasPurchasedSpecialItem = DLC_AND_SPECIAL_ARMOURS.includes(armour);

                return this.prisma.reach_player_rewards_armour.upsert({
                    where: {
                        player_xuid_armour: {
                            player_xuid: xuid.toString(),
                            armour: ARMOURS_TO_DB_MAP[armour as number],
                        },
                    },
                    create: {
                        armour: ARMOURS_TO_DB_MAP[armour as number],
                        player_xuid: xuid.toString(),
                        purchased: purchase_state.purchased,
                        forced_visible_and_purchasable: hasPurchasedSpecialItem,
                    },
                    update: {
                        purchased: purchase_state.purchased,
                        forced_visible_and_purchasable: hasPurchasedSpecialItem ? true : undefined,
                    }
                });
            })
        );
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
        const playerData = await this.prisma.reach_player_data.findUnique({ where: { player_xuid: xuid.toString() } });
        const isPlayerBungie = !!playerData?.is_bungie;

        // If we've award the player credits, we can clear the pending award now.
        if (playerRewards?.credits_award) {
            await this.prisma.reach_player_rewards.update({
                where: {
                    player_xuid: xuid.toString(),
                },
                data: {
                    credits_award: 0,
                    credits: playerRewards.credits + playerRewards.credits_award,
                }
            })
        }

        const responsePurchasedArmours = new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.e_purchase_state>(256).fill({
            purchased: false,
            banned: false,
            bypassed: false,
            granted_by_lsp: false,
            forced_visible_and_purchasable: false,
        }, 0, 256);

        const purchasedArmours = await this.prisma.reach_player_rewards_armour.findMany({
            where: {
                player_xuid: xuid.toString()
            }
        })

        purchasedArmours.forEach(purchasedArmour => {
            const armour = ARMOURS_FROM_DB_MAP[purchasedArmour.armour];
            if (armour == undefined || (armour as number) > 255) {
                this.logger.error(`User ${xuid.toString()} has an armour (${armour}) we can't map from DB to game, this should never happen!`)
                return;
            }
            responsePurchasedArmours[armour] = {
                purchased: purchasedArmour.purchased,
                banned: purchasedArmour.banned,
                bypassed: purchasedArmour.bypassed,
                granted_by_lsp: purchasedArmour.granted_by_lsp,
                forced_visible_and_purchasable: purchasedArmour.forced_visible_and_purchasable,
            }
        });
        
        if (isPlayerBungie) {
            DLC_AND_SPECIAL_ARMOURS.forEach(armour => {
                responsePurchasedArmours[armour].forced_visible_and_purchasable = true;
            });
        }

        return {
            credits: (playerRewards?.credits || 0) + (playerRewards?.credits_award || 0),
            unknown1: 0,
            commendations: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_persistent_per_commendation_state>(128).fill({
                unknown0: 1, 
                unknown1: 1
            }),
            purchased_items: responsePurchasedArmours,
            unknown2: 0,
            unknown3: 0,
            unknown4: playerRewards?.updatedAt || new Date(0),
            awarded_credits: playerRewards?.credits_award || 0,
            unknown6: 0,
        }
    }
}

function isValidHaloReachArmour(value: number): value is HaloReachArmour {
  return Object.values(HaloReachArmour)
    .filter((v) => typeof v === "number")
    .includes(value);
}

function toHaloReachArmour(value: number): HaloReachArmour | undefined {
  return isValidHaloReachArmour(value) ? (value as HaloReachArmour) : undefined;
}

enum HaloReachArmour {
    helmet_mk5b_base = 0,
    helmet_mk5b_ua = 1,
    helmet_mk5b_uahul = 2,
    helmet_cqc_base = 3,
    helmet_cqc_cbrn = 4,
    helmet_cqc_uahul = 5,
    helmet_odst_base = 6,
    helmet_odst_uacnm = 7,
    helmet_odst_cbrnhul = 8,
    helmet_hazop_base = 9,
    helmet_hazop_cbrnhul = 10,
    helmet_hazop_cnmi = 11,
    helmet_eod_base = 12,
    helmet_eod_cnm = 13,
    helmet_eod_uahul = 14,
    helmet_operator_base = 15,
    helmet_operator_uahul = 16,
    helmet_operator_cnm = 17,
    helmet_grenadier_base = 18,
    helmet_grenadier_ua = 19,
    helmet_grenadier_uafc = 20,
    helmet_airassault_base = 21,
    helmet_airassault_uacnm = 22,
    helmet_airassault_fci = 23,
    helmet_scout_base = 24,
    helmet_scout_hurs = 25,
    helmet_scout_cbrncnm = 26,
    helmet_eva_base = 27,
    helmet_eva_cnm = 28,
    helmet_eva_uahul3 = 29,
    helmet_jfo_base = 30,
    helmet_jfo_huli = 31,
    helmet_jfo_ua = 32,
    helmet_commando_base = 33,
    helmet_commando_cbrncnm = 34,
    helmet_commando_uafci2 = 35,
    helmet_mk5_base = 36,
    helmet_mk5_cnm = 37,
    helmet_mk5_ua = 38,
    helmet_pilot_base = 39,
    helmet_pilot_hul3 = 40,
    helmet_pilot_uahul3 = 41,
    helmet_pilot_haunted = 42,
    helmet_security_base = 43,
    helmet_uahul = 44,
    helmet_cbrncnm = 45,
    helmet_mk6_base = 46,
    helmet_mk6_fci2 = 47,
    helmet_mk6_uahuli = 48,
    helmet_militarypolice_base = 49,
    helmet_militarypolice_cbrnhurs = 50,
    helemt_militarypolice_hurscnm = 51,
    helmet_cqb_base = 52,
    helmet_cqb_hurscnm = 53,
    helmet_cqb_uahul = 54,
    helmet_gungir_base = 55,
    helmet_gungir_hurs = 56,
    helmet_gungir_cbrn = 57,
    helmet_recon_base = 58,
    helmet_recon_hul = 59,
    helmet_recon_uahul3 = 60,
    helmet_evac_base = 61,
    helmet_evac_cnm = 62,
    helmet_evac_uahul3 = 63,

    leftshoulder_default = 64,
    leftshoulder_fjpara = 65,
    leftshoulder_hazop = 66,
    leftshoulder_jfo = 67,
    leftshoulder_recon = 68,
    leftshoulder_uamultithreat = 69,
    leftshoulder_jumpjet = 70,
    leftshoulder_eva = 71,
    leftshoulder_gungir = 72,
    leftshoulder_uabasesecurity = 73,
    leftshoulder_cqc = 74,
    leftshoulder_operator = 75,
    leftshoulder_commando = 76,
    leftshoulder_grenadier = 77,
    leftshoulder_sniper = 78,
    leftshoulder_mk5 = 79,
    leftshoulder_security = 80,
    leftshoulder_odst = 81,

    rightshoulder_default = 82,
    rightshoulder_fjpara = 83,
    rightshoulder_hazop = 84,
    rightshoulder_jfo = 85,
    rightshoulder_recon = 86,
    rightshoulder_uamultithreat = 87,
    rightshoulder_jumpjet = 88,
    rightshoulder_eva = 89,
    rightshoulder_gungir = 90,
    rightshoulder_uabasesecurity = 91,
    rightshoulder_cqc = 92,
    rightshoulder_operator = 93,
    rightshoulder_commando = 94,
    rightshoulder_grenadier = 95,
    rightshoulder_sniper = 96,
    rightshoulder_mk5 = 97,
    rightshoulder_security = 98,
    rightshoulder_odst = 99,

    chest_default = 100, // guessed
    // ?
    // ?
    chest_hphalo = 103,    
    chest_uacounterassault = 104,
    chest_tacticallrp = 105,
    chest_tacticalrecon = 106,
    chest_collargrenadier = 107,
    chest_tacticalpatrol = 108,
    chest_collarbreacher = 109,
    chest_assaultsapper = 110,
    chest_assaultcommando = 111,
    chest_hpparafoil = 112,
    chest_collargrenadierua = 113,
    chest_uamultithreatw = 114,
    chest_uabasesecurity = 115,
    chest_collarbreacherr = 116,
    chest_hpparafoilr = 117,
    chest_assaultsapperr = 118,
    chest_uaodst = 119,
    
    wrist_default = 120,
    wrist_uabuckler = 121,
    wrist_uabracer = 122,
    wrist_tacticaltacpad = 123,
    wrist_assaultbreacher = 124,
    wrist_tacticalugps = 125,

    utility_default = 126,
    utility_softcase = 127,
    utility_uachobham = 128,
    utility_uanxraa = 129,
    utility_tacticaltraumakit = 130,
    utility_tacticalhardcase = 131,

    knees_default = 132,
    knees_fjpara = 133,
    knees_gungir = 134,
    knees_grenadier = 135,

    armoureffect_default = 136,
    armoureffect_legendary = 137,
    armoureffect_eternal = 138, // probably
    armoureffect_hearts = 139,
    armoureffect_inclementweather = 140,
    armoureffect_pestilence = 141,
    armoureffect_gruntbirthdayparty = 142,
    
    // ?
    // ?
    // ?
    // ?
    // ?
    // ?
    // ?
    // ?

    visor_default = 151,
    visor_silver = 152,
    visor_blue = 153,
    visor_black = 154,
    visor_gold = 155,

    firefightvoice_noblesix = 156, // probs
    firefightvoice_auntiedotai = 157,
    firefightvoice_cortanaai = 158,
    firefightvoice_johns117 = 159,
    firefightvoice_gysgtbuck = 160,
    firefightvoice_sgtmjrjohnson = 161,
    firefightvoice_gysgtstacker = 162,
    firefightvoice_carters259 = 163,
    firefightvoice_kats320 = 164,
    firefightvoice_juns266 = 165,
    firefightvoice_emiles239 = 166,
    firefightvoice_jorges052 = 167,
}

const DLC_AND_SPECIAL_ARMOURS = [
    HaloReachArmour.armoureffect_legendary,         // Limited Edition Bonus
    HaloReachArmour.helmet_recon_uahul3,            // Pre-Order bonus
    HaloReachArmour.chest_uamultithreatw,           // Pre-Order bonus
    HaloReachArmour.helmet_cqb_base,                // Waypoint Unlockable - Halo: Reach Heroic Complete
    HaloReachArmour.helmet_cqb_hurscnm,             // Waypoint Unlockable - Halo 3: ODST Heroic Complete
    HaloReachArmour.helmet_cqb_uahul,               // Waypoint Unlockable - Halo 3 Legendary Complete
    HaloReachArmour.helmet_militarypolice_base,     // Waypoint Unlockable - Reach Campaign complete on Normal or higher.
    HaloReachArmour.helemt_militarypolice_hurscnm,  // Waypoint Unlockable - ODST Pink & Deadly Cheevo
    HaloReachArmour.helmet_militarypolice_cbrnhurs, // Waypoint Unlockable - Halo 3 Fear The Pink Mist & Reach Spoon Full Of Blamite Cheevos
]

const armourCosts: Record<HaloReachArmour, number> = {
	[HaloReachArmour.helmet_mk5b_base]: 0,
	[HaloReachArmour.helmet_mk5b_ua]: 750,
	[HaloReachArmour.helmet_mk5b_uahul]: 1500,
	[HaloReachArmour.helmet_cqc_base]: 0,
	[HaloReachArmour.helmet_cqc_cbrn]: 750,
	[HaloReachArmour.helmet_cqc_uahul]: 1500,
	[HaloReachArmour.helmet_odst_base]: 2000,
	[HaloReachArmour.helmet_odst_uacnm]: 1000,
	[HaloReachArmour.helmet_odst_cbrnhul]: 500,
	[HaloReachArmour.helmet_hazop_base]: 7000,
	[HaloReachArmour.helmet_hazop_cbrnhul]: 2000,
	[HaloReachArmour.helmet_hazop_cnmi]: 1000,
	[HaloReachArmour.helmet_eod_base]: 15000,
	[HaloReachArmour.helmet_eod_cnm]: 5000,
	[HaloReachArmour.helmet_eod_uahul]: 3000,
	[HaloReachArmour.helmet_operator_base]: 7000,
	[HaloReachArmour.helmet_operator_uahul]: 2000,
	[HaloReachArmour.helmet_operator_cnm]: 1000,
	[HaloReachArmour.helmet_grenadier_base]: 25000,
	[HaloReachArmour.helmet_grenadier_ua]: 5000,
	[HaloReachArmour.helmet_grenadier_uafc]: 2000,
	[HaloReachArmour.helmet_airassault_base]: 15000,
	[HaloReachArmour.helmet_airassault_uacnm]: 7500,
	[HaloReachArmour.helmet_airassault_fci]: 5000,
	[HaloReachArmour.helmet_scout_base]: 40000,
	[HaloReachArmour.helmet_scout_hurs]: 5000,
	[HaloReachArmour.helmet_scout_cbrncnm]: 5000,
	[HaloReachArmour.helmet_eva_base]: 30000,
	[HaloReachArmour.helmet_eva_cnm]: 7000,
	[HaloReachArmour.helmet_eva_uahul3]: 15000,
	[HaloReachArmour.helmet_jfo_base]: 60000,
	[HaloReachArmour.helmet_jfo_huli]: 20000,
	[HaloReachArmour.helmet_jfo_ua]: 10000,
	[HaloReachArmour.helmet_commando_base]: 85000,
	[HaloReachArmour.helmet_commando_cbrncnm]: 40000,
	[HaloReachArmour.helmet_commando_uafci2]: 40000,
	[HaloReachArmour.helmet_mk5_base]: 130000,
	[HaloReachArmour.helmet_mk5_cnm]: 10000,
	[HaloReachArmour.helmet_mk5_ua]: 15000,
	[HaloReachArmour.helmet_pilot_base]: 90000,
	[HaloReachArmour.helmet_pilot_hul3]: 25000,
	[HaloReachArmour.helmet_pilot_uahul3]: 55000,
	[HaloReachArmour.helmet_pilot_haunted]: 0,
	[HaloReachArmour.helmet_security_base]: 250000,
	[HaloReachArmour.helmet_uahul]: 200000,
	[HaloReachArmour.helmet_cbrncnm]: 200000,
	[HaloReachArmour.helmet_mk6_base]: 300000,
	[HaloReachArmour.helmet_mk6_fci2]: 75000,
	[HaloReachArmour.helmet_mk6_uahuli]: 75000,
	[HaloReachArmour.helmet_militarypolice_base]: 0,
	[HaloReachArmour.helmet_militarypolice_cbrnhurs]: 0,
	[HaloReachArmour.helemt_militarypolice_hurscnm]: 0,
	[HaloReachArmour.helmet_cqb_base]: 0,
	[HaloReachArmour.helmet_cqb_hurscnm]: 0,
	[HaloReachArmour.helmet_cqb_uahul]: 0,
	[HaloReachArmour.helmet_gungir_base]: 250000,
	[HaloReachArmour.helmet_gungir_hurs]: 125000,
	[HaloReachArmour.helmet_gungir_cbrn]: 400000,
	[HaloReachArmour.helmet_recon_base]: 100000,
	[HaloReachArmour.helmet_recon_hul]: 75000,
	[HaloReachArmour.helmet_recon_uahul3]: 0,
	[HaloReachArmour.helmet_evac_base]: 120000,
	[HaloReachArmour.helmet_evac_cnm]: 25000,
	[HaloReachArmour.helmet_evac_uahul3]: 140000,

	[HaloReachArmour.leftshoulder_default]: 0,
	[HaloReachArmour.leftshoulder_fjpara]: 250,
	[HaloReachArmour.leftshoulder_hazop]: 500,
	[HaloReachArmour.leftshoulder_jfo]: 1000,
	[HaloReachArmour.leftshoulder_recon]: 1500,
	[HaloReachArmour.leftshoulder_uamultithreat]: 2000,
	[HaloReachArmour.leftshoulder_jumpjet]: 5000,
	[HaloReachArmour.leftshoulder_eva]: 3000,
	[HaloReachArmour.leftshoulder_gungir]: 8000,
	[HaloReachArmour.leftshoulder_uabasesecurity]: 12000,
	[HaloReachArmour.leftshoulder_cqc]: 20000,
	[HaloReachArmour.leftshoulder_operator]: 28000,
	[HaloReachArmour.leftshoulder_commando]: 40000,
	[HaloReachArmour.leftshoulder_grenadier]: 65000,
	[HaloReachArmour.leftshoulder_sniper]: 80000,
	[HaloReachArmour.leftshoulder_mk5]: 100000,
	[HaloReachArmour.leftshoulder_security]: 70000,
	[HaloReachArmour.leftshoulder_odst]: 25000,

	[HaloReachArmour.rightshoulder_default]: 0,
	[HaloReachArmour.rightshoulder_fjpara]: 250,
	[HaloReachArmour.rightshoulder_hazop]: 500,
	[HaloReachArmour.rightshoulder_jfo]: 1000,
	[HaloReachArmour.rightshoulder_recon]: 1500,
	[HaloReachArmour.rightshoulder_uamultithreat]: 2000,
	[HaloReachArmour.rightshoulder_jumpjet]: 5000,
	[HaloReachArmour.rightshoulder_eva]: 3000,
	[HaloReachArmour.rightshoulder_gungir]: 8000,
	[HaloReachArmour.rightshoulder_uabasesecurity]: 12000,
	[HaloReachArmour.rightshoulder_cqc]: 20000,
	[HaloReachArmour.rightshoulder_operator]: 28000,
	[HaloReachArmour.rightshoulder_commando]: 40000,
	[HaloReachArmour.rightshoulder_grenadier]: 65000,
	[HaloReachArmour.rightshoulder_sniper]: 75000,
	[HaloReachArmour.rightshoulder_mk5]: 80000,
	[HaloReachArmour.rightshoulder_security]: 275000,
	[HaloReachArmour.rightshoulder_odst]: 25000,

	[HaloReachArmour.chest_default]: 0,
	[HaloReachArmour.chest_hphalo]: 600,
	[HaloReachArmour.chest_uacounterassault]: 600,
	[HaloReachArmour.chest_tacticallrp]: 1000,
	[HaloReachArmour.chest_tacticalrecon]: 1500,
	[HaloReachArmour.chest_collargrenadier]: 4000,
	[HaloReachArmour.chest_tacticalpatrol]: 4000,
	[HaloReachArmour.chest_collarbreacher]: 8000,
	[HaloReachArmour.chest_assaultsapper]: 14000,
	[HaloReachArmour.chest_assaultcommando]: 12000,
	[HaloReachArmour.chest_hpparafoil]: 8000,
	[HaloReachArmour.chest_collargrenadierua]: 40000,
	[HaloReachArmour.chest_uamultithreatw]: 0,
	[HaloReachArmour.chest_uabasesecurity]: 0,
	[HaloReachArmour.chest_collarbreacherr]: 75000,
	[HaloReachArmour.chest_hpparafoilr]: 175000,
	[HaloReachArmour.chest_assaultsapperr]: 250000,
	[HaloReachArmour.chest_uaodst]: 750,

	[HaloReachArmour.wrist_default]: 0,
	[HaloReachArmour.wrist_uabuckler]: 5000,
	[HaloReachArmour.wrist_uabracer]: 10000,
	[HaloReachArmour.wrist_tacticaltacpad]: 50000,
	[HaloReachArmour.wrist_assaultbreacher]: 200000,
	[HaloReachArmour.wrist_tacticalugps]: 80000,

	[HaloReachArmour.utility_default]: 0,
	[HaloReachArmour.utility_softcase]: 100000,
	[HaloReachArmour.utility_uachobham]: 30000,
	[HaloReachArmour.utility_uanxraa]: 40000,
	[HaloReachArmour.utility_tacticaltraumakit]: 60000,
	[HaloReachArmour.utility_tacticalhardcase]: 40000,

	[HaloReachArmour.knees_default]: 0,
	[HaloReachArmour.knees_fjpara]: 10000,
	[HaloReachArmour.knees_gungir]: 25000,
	[HaloReachArmour.knees_grenadier]: 45000,

	[HaloReachArmour.armoureffect_default]: 0,
	[HaloReachArmour.armoureffect_legendary]: 0,
	[HaloReachArmour.armoureffect_eternal]: 0,
	[HaloReachArmour.armoureffect_hearts]: 300000,
	[HaloReachArmour.armoureffect_inclementweather]: 2000000,
	[HaloReachArmour.armoureffect_pestilence]: 1000000,
	[HaloReachArmour.armoureffect_gruntbirthdayparty]: 200000,

	[HaloReachArmour.visor_default]: 0,
	[HaloReachArmour.visor_silver]: 35000,
	[HaloReachArmour.visor_blue]: 50000,
	[HaloReachArmour.visor_black]: 100000,
	[HaloReachArmour.visor_gold]: 250000,
	
	[HaloReachArmour.firefightvoice_noblesix]: 0,
	[HaloReachArmour.firefightvoice_auntiedotai]: 15000,
	[HaloReachArmour.firefightvoice_cortanaai]: 100000,
	[HaloReachArmour.firefightvoice_johns117]: 150000,
	[HaloReachArmour.firefightvoice_gysgtbuck]: 15000,
	[HaloReachArmour.firefightvoice_sgtmjrjohnson]: 100000,
	[HaloReachArmour.firefightvoice_gysgtstacker]: 5000,
	[HaloReachArmour.firefightvoice_carters259]: 100000,
	[HaloReachArmour.firefightvoice_kats320]: 10000,
	[HaloReachArmour.firefightvoice_juns266]: 10000,
	[HaloReachArmour.firefightvoice_emiles239]: 10000,
	[HaloReachArmour.firefightvoice_jorges052]: 10000
};

const ARMOURS_TO_DB_MAP = {
	[HaloReachArmour.helmet_mk5b_base]: reach_armour.helmet_mk5b_base,
	[HaloReachArmour.helmet_mk5b_ua]: reach_armour.helmet_mk5b_ua,
	[HaloReachArmour.helmet_mk5b_uahul]: reach_armour.helmet_mk5b_uahul,
	[HaloReachArmour.helmet_cqc_base]: reach_armour.helmet_cqc_base,
	[HaloReachArmour.helmet_cqc_cbrn]: reach_armour.helmet_cqc_cbrn,
	[HaloReachArmour.helmet_cqc_uahul]: reach_armour.helmet_cqc_uahul,
	[HaloReachArmour.helmet_odst_base]: reach_armour.helmet_odst_base,
	[HaloReachArmour.helmet_odst_uacnm]: reach_armour.helmet_odst_uacnm,
	[HaloReachArmour.helmet_odst_cbrnhul]: reach_armour.helmet_odst_cbrnhul,
	[HaloReachArmour.helmet_hazop_base]: reach_armour.helmet_hazop_base,
	[HaloReachArmour.helmet_hazop_cbrnhul]: reach_armour.helmet_hazop_cbrnhul,
	[HaloReachArmour.helmet_hazop_cnmi]: reach_armour.helmet_hazop_cnmi,
	[HaloReachArmour.helmet_eod_base]: reach_armour.helmet_eod_base,
	[HaloReachArmour.helmet_eod_cnm]: reach_armour.helmet_eod_cnm,
	[HaloReachArmour.helmet_eod_uahul]: reach_armour.helmet_eod_uahul,
	[HaloReachArmour.helmet_operator_base]: reach_armour.helmet_operator_base,
	[HaloReachArmour.helmet_operator_uahul]: reach_armour.helmet_operator_uahul,
	[HaloReachArmour.helmet_operator_cnm]: reach_armour.helmet_operator_cnm,
	[HaloReachArmour.helmet_grenadier_base]: reach_armour.helmet_grenadier_base,
	[HaloReachArmour.helmet_grenadier_ua]: reach_armour.helmet_grenadier_ua,
	[HaloReachArmour.helmet_grenadier_uafc]: reach_armour.helmet_grenadier_uafc,
	[HaloReachArmour.helmet_airassault_base]: reach_armour.helmet_airassault_base,
	[HaloReachArmour.helmet_airassault_uacnm]: reach_armour.helmet_airassault_uacnm,
	[HaloReachArmour.helmet_airassault_fci]: reach_armour.helmet_airassault_fci,
	[HaloReachArmour.helmet_scout_base]: reach_armour.helmet_scout_base,
	[HaloReachArmour.helmet_scout_hurs]: reach_armour.helmet_scout_hurs,
	[HaloReachArmour.helmet_scout_cbrncnm]: reach_armour.helmet_scout_cbrncnm,
	[HaloReachArmour.helmet_eva_base]: reach_armour.helmet_eva_base,
	[HaloReachArmour.helmet_eva_cnm]: reach_armour.helmet_eva_cnm,
	[HaloReachArmour.helmet_eva_uahul3]: reach_armour.helmet_eva_uahul3,
	[HaloReachArmour.helmet_jfo_base]: reach_armour.helmet_jfo_base,
	[HaloReachArmour.helmet_jfo_huli]: reach_armour.helmet_jfo_huli,
	[HaloReachArmour.helmet_jfo_ua]: reach_armour.helmet_jfo_ua,
	[HaloReachArmour.helmet_commando_base]: reach_armour.helmet_commando_base,
	[HaloReachArmour.helmet_commando_cbrncnm]: reach_armour.helmet_commando_cbrncnm,
	[HaloReachArmour.helmet_commando_uafci2]: reach_armour.helmet_commando_uafci2,
	[HaloReachArmour.helmet_mk5_base]: reach_armour.helmet_mk5_base,
	[HaloReachArmour.helmet_mk5_cnm]: reach_armour.helmet_mk5_cnm,
	[HaloReachArmour.helmet_mk5_ua]: reach_armour.helmet_mk5_ua,
	[HaloReachArmour.helmet_pilot_base]: reach_armour.helmet_pilot_base,
	[HaloReachArmour.helmet_pilot_hul3]: reach_armour.helmet_pilot_hul3,
	[HaloReachArmour.helmet_pilot_uahul3]: reach_armour.helmet_pilot_uahul3,
	[HaloReachArmour.helmet_pilot_haunted]: reach_armour.helmet_pilot_haunted,
	[HaloReachArmour.helmet_security_base]: reach_armour.helmet_security_base,
	[HaloReachArmour.helmet_uahul]: reach_armour.helmet_uahul,
	[HaloReachArmour.helmet_cbrncnm]: reach_armour.helmet_cbrncnm,
	[HaloReachArmour.helmet_mk6_base]: reach_armour.helmet_mk6_base,
	[HaloReachArmour.helmet_mk6_fci2]: reach_armour.helmet_mk6_fci2,
	[HaloReachArmour.helmet_mk6_uahuli]: reach_armour.helmet_mk6_uahuli,
	[HaloReachArmour.helmet_militarypolice_base]: reach_armour.helmet_militarypolice_base,
	[HaloReachArmour.helmet_militarypolice_cbrnhurs]: reach_armour.helmet_militarypolice_cbrnhurs,
	[HaloReachArmour.helemt_militarypolice_hurscnm]: reach_armour.helemt_militarypolice_hurscnm,
	[HaloReachArmour.helmet_cqb_base]: reach_armour.helmet_cqb_base,
	[HaloReachArmour.helmet_cqb_hurscnm]: reach_armour.helmet_cqb_hurscnm,
	[HaloReachArmour.helmet_cqb_uahul]: reach_armour.helmet_cqb_uahul,
	[HaloReachArmour.helmet_gungir_base]: reach_armour.helmet_gungir_base,
	[HaloReachArmour.helmet_gungir_hurs]: reach_armour.helmet_gungir_hurs,
	[HaloReachArmour.helmet_gungir_cbrn]: reach_armour.helmet_gungir_cbrn,
	[HaloReachArmour.helmet_recon_base]: reach_armour.helmet_recon_base,
	[HaloReachArmour.helmet_recon_hul]: reach_armour.helmet_recon_hul,
	[HaloReachArmour.helmet_recon_uahul3]: reach_armour.helmet_recon_uahul3,
	[HaloReachArmour.helmet_evac_base]: reach_armour.helmet_evac_base,
	[HaloReachArmour.helmet_evac_cnm]: reach_armour.helmet_evac_cnm,
	[HaloReachArmour.helmet_evac_uahul3]: reach_armour.helmet_evac_uahul3,

	[HaloReachArmour.leftshoulder_default]: reach_armour.leftshoulder_default,
	[HaloReachArmour.leftshoulder_fjpara]: reach_armour.leftshoulder_fjpara,
	[HaloReachArmour.leftshoulder_hazop]: reach_armour.leftshoulder_hazop,
	[HaloReachArmour.leftshoulder_jfo]: reach_armour.leftshoulder_jfo,
	[HaloReachArmour.leftshoulder_recon]: reach_armour.leftshoulder_recon,
	[HaloReachArmour.leftshoulder_uamultithreat]: reach_armour.leftshoulder_uamultithreat,
	[HaloReachArmour.leftshoulder_jumpjet]: reach_armour.leftshoulder_jumpjet,
	[HaloReachArmour.leftshoulder_eva]: reach_armour.leftshoulder_eva,
	[HaloReachArmour.leftshoulder_gungir]: reach_armour.leftshoulder_gungir,
	[HaloReachArmour.leftshoulder_uabasesecurity]: reach_armour.leftshoulder_uabasesecurity,
	[HaloReachArmour.leftshoulder_cqc]: reach_armour.leftshoulder_cqc,
	[HaloReachArmour.leftshoulder_operator]: reach_armour.leftshoulder_operator,
	[HaloReachArmour.leftshoulder_commando]: reach_armour.leftshoulder_commando,
	[HaloReachArmour.leftshoulder_grenadier]: reach_armour.leftshoulder_grenadier,
	[HaloReachArmour.leftshoulder_sniper]: reach_armour.leftshoulder_sniper,
	[HaloReachArmour.leftshoulder_mk5]: reach_armour.leftshoulder_mk5,
	[HaloReachArmour.leftshoulder_security]: reach_armour.leftshoulder_security,
	[HaloReachArmour.leftshoulder_odst]: reach_armour.leftshoulder_odst,

	[HaloReachArmour.rightshoulder_default]: reach_armour.rightshoulder_default,
	[HaloReachArmour.rightshoulder_fjpara]: reach_armour.rightshoulder_fjpara,
	[HaloReachArmour.rightshoulder_hazop]: reach_armour.rightshoulder_hazop,
	[HaloReachArmour.rightshoulder_jfo]: reach_armour.rightshoulder_jfo,
	[HaloReachArmour.rightshoulder_recon]: reach_armour.rightshoulder_recon,
	[HaloReachArmour.rightshoulder_uamultithreat]: reach_armour.rightshoulder_uamultithreat,
	[HaloReachArmour.rightshoulder_jumpjet]: reach_armour.rightshoulder_jumpjet,
	[HaloReachArmour.rightshoulder_eva]: reach_armour.rightshoulder_eva,
	[HaloReachArmour.rightshoulder_gungir]: reach_armour.rightshoulder_gungir,
	[HaloReachArmour.rightshoulder_uabasesecurity]: reach_armour.rightshoulder_uabasesecurity,
	[HaloReachArmour.rightshoulder_cqc]: reach_armour.rightshoulder_cqc,
	[HaloReachArmour.rightshoulder_operator]: reach_armour.rightshoulder_operator,
	[HaloReachArmour.rightshoulder_commando]: reach_armour.rightshoulder_commando,
	[HaloReachArmour.rightshoulder_grenadier]: reach_armour.rightshoulder_grenadier,
	[HaloReachArmour.rightshoulder_sniper]: reach_armour.rightshoulder_sniper,
	[HaloReachArmour.rightshoulder_mk5]: reach_armour.rightshoulder_mk5,
	[HaloReachArmour.rightshoulder_security]: reach_armour.rightshoulder_security,
	[HaloReachArmour.rightshoulder_odst]: reach_armour.rightshoulder_odst,

	[HaloReachArmour.chest_default]: reach_armour.chest_default,
	[HaloReachArmour.chest_hphalo]: reach_armour.chest_hphalo,
	[HaloReachArmour.chest_uacounterassault]: reach_armour.chest_uacounterassault,
	[HaloReachArmour.chest_tacticallrp]: reach_armour.chest_tacticallrp,
	[HaloReachArmour.chest_tacticalrecon]: reach_armour.chest_tacticalrecon,
	[HaloReachArmour.chest_collargrenadier]: reach_armour.chest_collargrenadier,
	[HaloReachArmour.chest_tacticalpatrol]: reach_armour.chest_tacticalpatrol,
	[HaloReachArmour.chest_collarbreacher]: reach_armour.chest_collarbreacher,
	[HaloReachArmour.chest_assaultsapper]: reach_armour.chest_assaultsapper,
	[HaloReachArmour.chest_assaultcommando]: reach_armour.chest_assaultcommando,
	[HaloReachArmour.chest_hpparafoil]: reach_armour.chest_hpparafoil,
	[HaloReachArmour.chest_collargrenadierua]: reach_armour.chest_collargrenadierua,
	[HaloReachArmour.chest_uamultithreatw]: reach_armour.chest_uamultithreatw,
	[HaloReachArmour.chest_uabasesecurity]: reach_armour.chest_uabasesecurity,
	[HaloReachArmour.chest_collarbreacherr]: reach_armour.chest_collarbreacherr,
	[HaloReachArmour.chest_hpparafoilr]: reach_armour.chest_hpparafoilr,
	[HaloReachArmour.chest_assaultsapperr]: reach_armour.chest_assaultsapperr,
	[HaloReachArmour.chest_uaodst]: reach_armour.chest_uaodst,

	[HaloReachArmour.wrist_default]: reach_armour.wrist_default,
	[HaloReachArmour.wrist_uabuckler]: reach_armour.wrist_uabuckler,
	[HaloReachArmour.wrist_uabracer]: reach_armour.wrist_uabracer,
	[HaloReachArmour.wrist_tacticaltacpad]: reach_armour.wrist_tacticaltacpad,
	[HaloReachArmour.wrist_assaultbreacher]: reach_armour.wrist_assaultbreacher,
	[HaloReachArmour.wrist_tacticalugps]: reach_armour.wrist_tacticalugps,

	[HaloReachArmour.utility_default]: reach_armour.utility_default,
	[HaloReachArmour.utility_softcase]: reach_armour.utility_softcase,
	[HaloReachArmour.utility_uachobham]: reach_armour.utility_uachobham,
	[HaloReachArmour.utility_uanxraa]: reach_armour.utility_uanxraa,
	[HaloReachArmour.utility_tacticaltraumakit]: reach_armour.utility_tacticaltraumakit,
	[HaloReachArmour.utility_tacticalhardcase]: reach_armour.utility_tacticalhardcase,

	[HaloReachArmour.knees_default]: reach_armour.knees_default,
	[HaloReachArmour.knees_fjpara]: reach_armour.knees_fjpara,
	[HaloReachArmour.knees_gungir]: reach_armour.knees_gungir,
	[HaloReachArmour.knees_grenadier]: reach_armour.knees_grenadier,

	[HaloReachArmour.armoureffect_default]: reach_armour.armoureffect_default,
	[HaloReachArmour.armoureffect_legendary]: reach_armour.armoureffect_legendary,
	[HaloReachArmour.armoureffect_eternal]: reach_armour.armoureffect_eternal,
	[HaloReachArmour.armoureffect_hearts]: reach_armour.armoureffect_hearts,
	[HaloReachArmour.armoureffect_inclementweather]: reach_armour.armoureffect_inclementweather,
	[HaloReachArmour.armoureffect_pestilence]: reach_armour.armoureffect_pestilence,
	[HaloReachArmour.armoureffect_gruntbirthdayparty]: reach_armour.armoureffect_gruntbirthdayparty,

	[HaloReachArmour.visor_default]: reach_armour.visor_default,
	[HaloReachArmour.visor_silver]: reach_armour.visor_silver,
	[HaloReachArmour.visor_blue]: reach_armour.visor_blue,
	[HaloReachArmour.visor_black]: reach_armour.visor_black,
	[HaloReachArmour.visor_gold]: reach_armour.visor_gold,

	[HaloReachArmour.firefightvoice_noblesix]: reach_armour.firefightvoice_noblesix,
	[HaloReachArmour.firefightvoice_auntiedotai]: reach_armour.firefightvoice_auntiedotai,
	[HaloReachArmour.firefightvoice_cortanaai]: reach_armour.firefightvoice_cortanaai,
	[HaloReachArmour.firefightvoice_johns117]: reach_armour.firefightvoice_johns117,
	[HaloReachArmour.firefightvoice_gysgtbuck]: reach_armour.firefightvoice_gysgtbuck,
	[HaloReachArmour.firefightvoice_sgtmjrjohnson]: reach_armour.firefightvoice_sgtmjrjohnson,
	[HaloReachArmour.firefightvoice_gysgtstacker]: reach_armour.firefightvoice_gysgtstacker,
	[HaloReachArmour.firefightvoice_carters259]: reach_armour.firefightvoice_carters259,
	[HaloReachArmour.firefightvoice_kats320]: reach_armour.firefightvoice_kats320,
	[HaloReachArmour.firefightvoice_juns266]: reach_armour.firefightvoice_juns266,
	[HaloReachArmour.firefightvoice_emiles239]: reach_armour.firefightvoice_emiles239,
	[HaloReachArmour.firefightvoice_jorges052]: reach_armour.firefightvoice_jorges052,
}

const ARMOURS_FROM_DB_MAP = Object.fromEntries(
  Object.entries(ARMOURS_TO_DB_MAP).map(([key, value]) => [value, Number(key)])
) as Record<(typeof reach_armour)[keyof typeof reach_armour], HaloReachArmour>;