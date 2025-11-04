import { Inject, Injectable } from "@nestjs/common";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { reach_player_data_nameplate } from "@prisma/client";
import { CAMPAIGN_COMMENDATIONS, COMMENDATIONS_FROM_DB_MAP, FIREFIGHT_COMMENDATIONS, MATCHMAKING_COMMENDATIONS } from "./commendations";
import { HaloReachChallengeService } from "./challenge.service";
import { addYears } from "date-fns";

export const USER_NAG_MESSAGES = {
    sunrise_legacy_credit_reset: 300,
}

@Injectable()
export class HaloReachUserService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly challengeService: HaloReachChallengeService,
    ) { }

    public getUserFile = async (xuid: BigInt) => {
        // If the DB is too slow, or data isn't present, we'll return a file without player data or a service record.
        let fupd: undefined | BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_player_data = undefined;
        let srid: undefined | BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_service_record = undefined;
        let chpr: undefined | BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_challenge_progress = undefined;
        let umsg: undefined | BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_user_messaging_data = undefined;

        const playerDataPromise = this.prisma.$transaction(async (prisma) => {
            const playerData = await prisma.reach_player_data.findUnique({ where: { player_xuid: xuid.toString() } });

            if (playerData) {
                let bungie_user_role = 0;
                bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.registered;
                if (playerData.is_pro) bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.pro_member;
                if (playerData.is_bungie) bungie_user_role |= BLF.haloreach_12065_11_08_24_1738_tu1actual.e_bungienet_user_flags.staff;
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

                if (playerData.nag_message && (playerData.nag_message_expires_at == null || playerData.nag_message_expires_at >= new Date())) {
                    umsg = {
                        unknown0: 0n,
                        message_index: BigInt(playerData.nag_message) || 0n,
                        expires_at: playerData.nag_message_expires_at || addYears(new Date(), 1)
                    }
                }
            }
        })

        const challengesPromise = this.challengeService.getChallengeProgress(xuid)
            .then(_chpr => chpr = _chpr);

        await Promise.allSettled([playerDataPromise, challengesPromise]);

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
            chpr,
            srid,
            umsg,
        );
    }

    public getServiceRecord = async (xuid: BigInt): Promise<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_service_record> => {
        const playerRewards = await this.prisma.reach_player_rewards.findUnique({
            where: {
                player_xuid: xuid.toString(),
            },
            select: {
                credits: true
            }
        })

        const playerCommendations = await this.prisma.reach_player_rewards_commendations.findMany({
            where: {
                player_xuid: xuid.toString(),
            }
        })

        const matchmakingCommendations = playerCommendations
            .filter(commendation => MATCHMAKING_COMMENDATIONS.includes(COMMENDATIONS_FROM_DB_MAP[commendation.commendation]))
            .map(commendation => ({
                commendation: COMMENDATIONS_FROM_DB_MAP[commendation.commendation] as number,
                progress: commendation.progress,
            }))

        const firefightCommendations = playerCommendations
            .filter(commendation => FIREFIGHT_COMMENDATIONS.includes(COMMENDATIONS_FROM_DB_MAP[commendation.commendation]))
            .map(commendation => ({
                commendation: COMMENDATIONS_FROM_DB_MAP[commendation.commendation] as number,
                progress: commendation.progress,
            }))

        const campaignCommendations = playerCommendations
            .filter(commendation => CAMPAIGN_COMMENDATIONS.includes(COMMENDATIONS_FROM_DB_MAP[commendation.commendation]))
            .map(commendation => ({
                commendation: COMMENDATIONS_FROM_DB_MAP[commendation.commendation] as number,
                progress: commendation.progress,
            }))

        const halo3ServiceRecord = await this.prisma.halo3_service_record.findUnique({
            where: {
                player_xuid: xuid.toString(),
            },
            select: {
                first_played: true,
                games_completed: true,
                campaign_progress: true,
            }
        })
        
        const halo3KillsData = await this.prisma.halo3_carnage_report_player_statistics.aggregate({
            _sum: {
                kills: true,
            },
            where: {
                carnage_report_player: {
                    player_xuid: xuid.toString(),
                },
            },
            }
        );

        return {
            player_name: '',
            player_info_available: true,
            player_model_choice: 0,
            armour_primary_color: 0,
            armour_secondary_color: 0,
            armour_tertiary_color: 0,
            emblem_primary: 0,
            emblem_background: 0,
            emblem_secondary: false,
            emblem_primary_color: 0,
            emblem_secondary_color: 0,
            emblem_background_color: 0,
            service_tag: '',
            
            credits_available: true,
            credits: playerRewards?.credits || 0,

            career_overview_stats_available: true,

            campaign_record_available: true,
            campaign_completed_at: new Date(),
            campaign_completion_difficulty: 0,
            campaign_enemies_killed: 0,
            campaign_vehicles_destroyed: 0,
            campaign_seconds_played: 0,
            campaign_difficulty_stats: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_service_record_campaign_difficulty_stats>(3).fill({
                covenant_kills: 0,
                vehicles_destroyed: 0,
                highest_skull_multiplier: 1,
                missions_complete: 0,
                missions_completed_without_dying_or_restarting: 0,
                unknown1: 0,
            }, 0, 3),
            campaign_commendations_count: campaignCommendations.length,
            campaign_commendations: [
                ...campaignCommendations,
                ...new Array(16 - campaignCommendations.length).fill({ commendation: 0, progress: 0 }),
            ],

            firefight_record_available: true,
            firefight_covenant_kills: 0,
            firefight_vehicles_destroyed: 0,
            firefight_highest_set_completed: 0,
            firefight_most_kills_in_game: 0,
            firefight_waves_completed: 0,
            firefight_generators_destroyed: 0,
            firefight_enemy_players_killed: 0,
            firefight_difficulty_stats: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_service_record_firefight_difficulty_stats>(3).fill({
                biggest_kill: 0,
                covenant_kills: 0,
                vehicles_destroyed: 0,
                highest_official_score: 0,
                highest_set_completed: 0,
                times_beat_par: 0,
                most_consecutive_kills_without_dying: 0,
            }, 0, 3),
            firefight_commendations_count: firefightCommendations.length,
            firefight_commendations: [
                ...firefightCommendations,
                ...new Array(16 - firefightCommendations.length).fill({ commendation: 0, progress: 0 }),
            ],

            matchmaking_record_available: true,
            matchmaking_games_won: 0,
            matchmaking_assists: 0,
            matchmaking_kills: 0,
            matchmaking_deaths: 0,
            matchmaking_category_stats: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_service_record_matchmaking_category_stats>(5).fill({
                games_won: 0,
                kills: 0,
                deaths: 0,
                assists: 0,
                percentage_of_matchmaking_games_played_in_category: 0,
            }, 0, 5),
            matchmaking_commendations_count: matchmakingCommendations.length,
            matchmaking_commendations: [
                ...matchmakingCommendations,
                ...new Array(16 - matchmakingCommendations.length).fill({ commendation: 0, progress: 0 }),
            ],

            arena_season_stats_count: 0,
            arena_season_stats: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_service_record_arena_season_stats>(3).fill({
                season_number: 0,
                hopper_stats_count: 0,
                hopper_stats: new Array<BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_service_record_arena_hopper_stats>(8).fill({
                    kills: 0,
                    deaths: 0,
                    assists: 0,
                    days_rated: 0,
                    division: 0,
                    division_standing: 0,
                    last_7_days_kill_and_assist_death_ratio: 0,
                    last_7_days_kill_death_ratio: 0,
                    games_played: 0,
                    games_played_today: 0,
                    games_won: 0,
                    unknown1: 0,
                    unknown2: 0,
                    unknown3: 0,
                    unknown4: 0,
                    unknown5: 0,
                    current_best_set: 0,
                    yesterdays_best_set: 0,
                    hopper_name: ''
                }, 0, 8)
            }, 0, 3),

            custom_games_record_available: false,
            custom_games_firefight_killed: 0,
            custom_games_firefight_played: 0,
            custom_games_multiplayer_kills: 0,
            custom_games_multiplayer_played: 0,

            legacy_record_available: true,
            halo2_first_played_time: new Date(),
            halo2_highest_difficulty: 0,
            halo2_unknown_1: 0,
            halo2_unknown_2: 0,
            halo3_first_played_time: halo3ServiceRecord ? halo3ServiceRecord.first_played : new Date(),
            halo3_games_played: halo3ServiceRecord?.games_completed || 0,
            halo3_highest_difficulty: halo3ServiceRecord?.campaign_progress || 0,
            halo3_multiplayer_kills: halo3KillsData._sum.kills || 0,
            odst_first_played_time: new Date(),
            odst_grunts_killed_in_firefight: 0,
            odst_highest_difficulty: 0,
            
            unknown1: [0, 0, 0, 0],
            unknown2: [0, 0, 0],
            unknown3: new Array(14).fill(0, 0, 14),
            unknown4: [0, 0],
            unknown5: 0,
        }
    }

    // TODO: Implement
    public getRecentPlayersFile = (_xuid: string) => {
        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_recent_players_file({
            players: []
        })
    }
}