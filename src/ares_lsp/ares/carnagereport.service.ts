import { Inject } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp';
import { CompressionService } from "../services/compression.service";
import { isGuestXuid } from "src/xbox/xuid";
import { DiscordWebhookService } from "src/lsp/services/discordwebhook.service";

// We turn this on for debugging but turn it off for security in prod.
const ALLOW_UNCOMPRESSED_CARNAGE_REPORTS = true;
// Debug - allows resubmitting the same file
const ALWAYS_REINSERT_REPORTS = false;

const VALID_GAMERTAG_REGEX = /[a-zA-Z0-9 ,\(\)]{1,15}/;

const TEAM_NAMES = [
    'Red',
    'Blue',
    'Green',
    'Orange',
    'Purple',
    'Gold',
    'Brown',
    'Pink',
    'Unknown'
]

export class AresCarnageReportService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly compressionService: CompressionService,
        private readonly discordWebhookService: DiscordWebhookService,
    ) {}

    private isValidCarnageReport = (multi: BLF.ares_untracked.multi) => {
        if (!multi.mppl.players
            .filter(player => player.player_exists)
            .every(player => VALID_GAMERTAG_REGEX.test(player.player_configuration_from_client.player_name))
        ) {
            this.logger.warn(`[UPLOAD] Received carnage report with an invalid gamertag, skipping.`)
            return false;
        }

        return true;
    }

    public handleAresMultiUpload = async (upload: Express.Multer.File) => {
        const buffer = ALLOW_UNCOMPRESSED_CARNAGE_REPORTS 
            ? this.compressionService.inflateIfCompressed(upload)
            : this.compressionService.inflate(upload);

        const multi = BLF.ares_untracked.read_webstats(buffer);

        if (!multi) {
            return;
        }
        if (!this.isValidCarnageReport(multi)) {
            return;
        }

        const playerCount = multi.mppl.players.filter(p => p.player_exists).length;
        const teamCount = multi.mptm.teams.filter(t => t.exists).length;

        await this.prisma.$transaction(async (tx) => {
            // If we have a carnage report submission with an earlier finish time, the host probs dropped.
            // Delete & reinsert with newer data.
            // Use a 1-day tolerance on start_time
            // game_id is sent to us from the game, I'm not sure how prone to duplicates it is,
            // so we add a few more filters to help narrow down the results.
            const startTime = multi.mpgd.start_time;
            const oneDayInMs = 24 * 60 * 60 * 1000;
            const startTimeMin = new Date(startTime.getTime() - oneDayInMs);
            const startTimeMax = new Date(startTime.getTime() + oneDayInMs);
            
            const existingReport = await tx.ares_carnage_report.findFirst({
                where: {
                    game_id: multi.mpgd.game_id.toString(),
                    map_id: multi.mpgd.map_id,
                    start_time: {
                        gte: startTimeMin,
                        lte: startTimeMax,
                    },
                },
                select: {
                    id: true
                }
            })

            let existingCarnageReportId = existingReport
                ? existingReport.id
                : undefined;

            if (existingCarnageReportId) {
                await tx.ares_carnage_report.delete({
                    where: {
                        id: existingCarnageReportId
                    }
                })
            }

            const { id: carnageReportId } = await tx.ares_carnage_report.create({
                data: {
                    id: existingCarnageReportId,
                    finish_time: multi.mpgd.finish_time,
                    finished: multi.mpgd.finished,
                    game_id: multi.mpgd.game_id.toString(),
                    game_variant_unique_id: multi.mpgd.game_variant_unique_id.toString(),
                    in_group_session: multi.mpma.in_group_session,
                    in_squad_session: multi.mpma.in_squad_session,
                    map_id: multi.mpgd.map_id,
                    map_variant_name: multi.mpgd.map_variant_name,
                    map_variant_unique_id: multi.mpgd.map_variant_unique_id.toString(),
                    migrated_solo: multi.mpgd.migrated_solo,
                    migrated_to_group: multi.mpgd.migrated_to_group,
                    scenario_path: multi.mpgd.scenario_path.path,
                    simulation_aborted: multi.mpgd.simulation_aborted,
                    start_time: multi.mpgd.start_time,
                    started: multi.mpgd.started,
                    team_game: multi.mpgd.team_game,
                    carnage_report_game_variant: { 
                        create: {
                            game_engine: multi.mpvr.game_variant.m_game_engine,
                            author: multi.mpvr.game_variant.m_base_variant.m_metadata.author,
                            author_id: multi.mpvr.game_variant.m_base_variant.m_metadata.author_id.toString(),
                            author_is_xuid_online: multi.mpvr.game_variant.m_base_variant.m_metadata.author_is_xuid_online,
                            date: multi.mpvr.game_variant.m_base_variant.m_metadata.date,
                            description: multi.mpvr.game_variant.m_base_variant.m_metadata.description,
                            file_type: multi.mpvr.game_variant.m_base_variant.m_metadata.file_type,
                            name: multi.mpvr.game_variant.m_base_variant.m_metadata.name,
                            size_in_bytes: multi.mpvr.game_variant.m_base_variant.m_metadata.size_in_bytes.toString(),
                            unique_id: multi.mpvr.game_variant.m_base_variant.m_metadata.unique_id.toString(),
                        }
                    },
                    carnage_report_team: {
                        createMany: {
                            data: multi.mptm.teams
                                .filter(t => t.exists)
                                .map((t, i) => ({
                                    team_index: i,
                                    score: t.score,
                                    standing: t.standing
                                }))
                        }
                    },
                    carnage_report_machine: {
                        createMany: {
                            data: multi.mpma.machines
                                .filter(m => m.machine_data.exists || m.session_info.exists)
                                .map((m, i) => ({
                                    machine_index: i,
                                    machine_identifier: Uint8Array.from(m.machine_data.identifier.identifier),
                                    machine_exists: m.machine_data.exists,
                                    machine_connected_to_host: m.machine_data.connected_to_host,
                                    machine_host: m.machine_data.host,
                                    machine_initial_host: m.machine_data.initial_host,
                                    machine_voluntary_quit: m.machine_data.voluntary_quit,
                                    machine_bandwidth_events_0: m.machine_data.bandwidth_events[0],
                                    machine_bandwidth_events_1: m.machine_data.bandwidth_events[1],
                                    machine_bandwidth_events_2: m.machine_data.bandwidth_events[2],
                                    machine_bandwidth_events_3: m.machine_data.bandwidth_events[3],
                                    machine_bandwidth_events_4: m.machine_data.bandwidth_events[4],
                                    session_exists: m.session_info.exists,
                                    session_has_hard_drive: m.session_info.has_hard_drive,
                                    session_party_nonce: m.session_info.party_nonce.toString(),
                                    session_secure_address: Uint8Array.from(m.session_info.secure_address.data),
                                    session_network_version_number: m.session_info.network_version_number,
                                    session_peer_estimated_downstream_bandwidth_bps: m.session_info.peer_estimated_downstream_bandwidth_bps,
                                    session_peer_estimated_upstream_bandwidth_bps: m.session_info.peer_estimated_upstream_bandwidth_bps,
                                    session_peer_nat_type: m.session_info.peer_nat_type,
                                    session_peer_to_peer_connectivity_mask: m.session_info.peer_to_peer_connectivity_mask,
                                    session_peer_to_peer_probed_mask: m.session_info.peer_to_peer_probed_mask
                                }
                            ))
                        }
                    },
                    carnage_report_matchmaking_options: {
                        create: multi.mpmo.hopper_identifier >= 0 
                            ? multi.mpmo
                            : undefined
                    },
                },
                select: {
                    id: true,
                }
            });
            await tx.ares_carnage_report.update({
                where: {
                    id: carnageReportId
                },
                data: {
                    carnage_report_player: {
                        createMany: {
                            data: multi.mppl.players
                                .filter(p => p.player_exists)
                                .map((p, i) => ({
                                        player_index: i,
                                        machine_index: p.machine_index >= 0 
                                            ? p.machine_index 
                                            : undefined,
                                        player_identifier: p.player_identifier.toString(),
                                        player_name: p.player_configuration_from_host.player_name,
                                        appearance_flags: p.player_configuration_from_client.appearance.appearance_flags,
                                        primary_color: p.player_configuration_from_client.appearance.primary_color,
                                        secondary_color: p.player_configuration_from_client.appearance.secondary_color,
                                        tertiary_color: p.player_configuration_from_client.appearance.tertiary_color,
                                        player_model_choice: p.player_configuration_from_client.appearance.player_model_choice,
                                        foreground_emblem: p.player_configuration_from_client.appearance.foreground_emblem,
                                        background_emblem: p.player_configuration_from_client.appearance.background_emblem,
                                        emblem_flags: p.player_configuration_from_client.appearance.emblem_flags,
                                        emblem_primary_color: p.player_configuration_from_client.appearance.emblem_primary_color,
                                        emblem_secondary_color: p.player_configuration_from_client.appearance.emblem_secondary_color,
                                        emblem_background_color: p.player_configuration_from_client.appearance.emblem_background_color,
                                        spartan_model_area_0: p.player_configuration_from_client.appearance.spartan_model_area_0,
                                        spartan_model_area_1: p.player_configuration_from_client.appearance.spartan_model_area_1,
                                        spartan_model_area_2: p.player_configuration_from_client.appearance.spartan_model_area_2,
                                        spartan_model_area_3: p.player_configuration_from_client.appearance.spartan_model_area_3,
                                        elite_model_area_0: p.player_configuration_from_client.appearance.elite_model_area_0,
                                        elite_model_area_1: p.player_configuration_from_client.appearance.elite_model_area_1,
                                        elite_model_area_2: p.player_configuration_from_client.appearance.elite_model_area_2,
                                        elite_model_area_3: p.player_configuration_from_client.appearance.elite_model_area_3,
                                        service_tag: p.player_configuration_from_client.appearance.service_tag,
                                        player_xuid: p.player_configuration_from_client.player_xuid.toString(),
                                        is_guest: isGuestXuid(p.player_configuration_from_client.player_xuid),
                                        is_silver_or_gold_live: p.player_configuration_from_client.is_silver_or_gold_live,
                                        is_online_enabled: p.player_configuration_from_client.is_online_enabled,
                                        is_controller_attached: p.player_configuration_from_client.is_controller_attached,
                                        user_selected_team_index: p.player_configuration_from_client.user_selected_team_index,
                                        desires_veto: p.player_configuration_from_client.desires_veto,
                                        desires_rematch: p.player_configuration_from_client.desires_rematch,
                                        hopper_access_flags: p.player_configuration_from_client.hopper_access_flags,
                                        is_free_live_gold_account: p.player_configuration_from_client.is_free_live_gold_account,
                                        is_user_created_content_allowed: p.player_configuration_from_client.is_user_created_content_allowed,
                                        is_friend_created_content_allowed: p.player_configuration_from_client.is_friend_created_content_allowed,
                                        is_griefer: p.player_configuration_from_client.is_griefer,
                                        campaign_difficulty_completed: p.player_configuration_from_client.campaign_difficulty_completed,
                                        bungienet_user_flags: p.player_configuration_from_client.bungienet_user_flags,
                                        gamer_region: p.player_configuration_from_client.gamer_region,
                                        gamer_zone: p.player_configuration_from_client.gamer_zone,
                                        cheat_flags: p.player_configuration_from_client.cheat_flags,
                                        ban_flags: p.player_configuration_from_client.ban_flags,
                                        repeated_play_coefficient: p.player_configuration_from_client.repeated_play_coefficient,
                                        experience_growth_banned: p.player_configuration_from_client.experience_growth_banned,
                                        matchmade_ranked_games_played: p.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.matchmade_ranked_games_played,
                                        matchmade_ranked_games_completed: p.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.matchmade_ranked_games_completed,
                                        matchmade_ranked_games_won: p.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.matchmade_ranked_games_won,
                                        matchmade_unranked_games_played: p.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.matchmade_unranked_games_played,
                                        matchmade_unranked_games_completed: p.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.matchmade_unranked_games_completed,
                                        hopper_experience_base: p.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.hopper_experience_base,
                                        custom_games_completed: p.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.custom_games_completed,
                                        hopper_experience_penalty: p.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.hopper_experience_penalty,
                                        first_played: p.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.first_played,
                                        last_played: p.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.last_played,
                                        global_statistics_valid: p.player_configuration_from_client.queried_player_statistics.queried_player_global_statistics.valid,
                                        global_statistics_highest_skill: p.player_configuration_from_client.queried_player_statistics.queried_player_global_statistics.highest_skill,
                                        global_statistics_experience_base: p.player_configuration_from_client.queried_player_statistics.queried_player_global_statistics.experience_base,
                                        global_statistics_experience_penalty: p.player_configuration_from_client.queried_player_statistics.queried_player_global_statistics.experience_penalty,
                                        hopper_statistics_valid: p.player_configuration_from_client.queried_player_statistics.queried_player_hopper_statistics.stats_valid,
                                        hopper_statistics_identifier: p.player_configuration_from_client.queried_player_statistics.queried_player_hopper_statistics.identifier,
                                        hopper_statistics_hopper_skill: p.player_configuration_from_client.queried_player_statistics.queried_player_hopper_statistics.hopper_skill,
                                        hopper_statistics_games_won: p.player_configuration_from_client.queried_player_statistics.queried_player_hopper_statistics.games_won,
                                        hopper_statistics_games_played: p.player_configuration_from_client.queried_player_statistics.queried_player_hopper_statistics.games_played,
                                        hopper_statistics_games_completed: p.player_configuration_from_client.queried_player_statistics.queried_player_hopper_statistics.games_completed,
                                        hopper_statistics_mu: p.player_configuration_from_client.queried_player_statistics.queried_player_hopper_statistics.mu,
                                        hopper_statistics_sigma: p.player_configuration_from_client.queried_player_statistics.queried_player_hopper_statistics.sigma,
                                        player_team: p.player_configuration_from_host.player_team,
                                        player_assigned_team: p.player_configuration_from_host.player_assigned_team,
                                        host_stats_global_valid: p.player_configuration_from_host.stats_global_valid,
                                        host_stats_global_experience: p.player_configuration_from_host.stats_global_experience,
                                        host_stats_global_rank: p.player_configuration_from_host.stats_global_rank,
                                        host_stats_global_grade: p.player_configuration_from_host.stats_global_grade,
                                        host_stats_hopper_valid: p.player_configuration_from_host.stats_hopper_valid,
                                        host_stats_hopper_skill: p.player_configuration_from_host.stats_hopper_skill,
                                        host_stats_hopper_skill_display: p.player_configuration_from_host.stats_hopper_skill_display,
                                        host_stats_hopper_skill_update_weight: p.player_configuration_from_host.stats_hopper_skill_update_weight,
                                        standing: p.standing,
                                        result: p.result,
                                        score: p.score,
                                    }
                                ))
                        }
                    },
                    carnage_report_event_carry: {
                        createMany: {
                            data: multi.mpev.events
                                .filter(e => e.type_ === BLF.ares_untracked.e_game_results_data_type._carry)
                                .map(e => ({
                                    time: e.time,
                                    carry_type: e.carry_data!.carry_type,
                                    position: [e.carry_data!.position.x, e.carry_data!.position.y, e.carry_data!.position.z],
                                    carry_player_index: e.player_references[0],
                                    weapon_index: e.carry_data!.weapon_index,
                                }))
                        }
                    },
                    carnage_report_event_kill: {
                        createMany: {
                            data: multi.mpev.events
                                .filter(e => e.type_ === BLF.ares_untracked.e_game_results_data_type._kill)
                                .map(e => ({
                                    time: e.time,
                                    killer_position: [
                                        e.kill_data!.killer_position.x, 
                                        e.kill_data!.killer_position.y, 
                                        e.kill_data!.killer_position.z
                                    ],
                                    dead_position: [
                                        e.kill_data!.dead_position.x, 
                                        e.kill_data!.dead_position.y, 
                                        e.kill_data!.dead_position.z
                                    ],
                                    killer_player_index: e.player_references[0],
                                    dead_player_index: e.player_references[1],
                                    kill_type: e.kill_data!.kill_type,
                                }))
                        }
                    },
                    carnage_report_event_score: {
                        createMany: {
                            data: multi.mpev.events
                                .filter(e => e.type_ === BLF.ares_untracked.e_game_results_data_type._score)
                                .map(e => ({
                                    time: e.time,
                                    score_player_index: e.player_references[0],
                                    weapon_index: e.score_data!.weapon_index,
                                    score_type: e.score_data!.score_type,
                                    position: [
                                        e.score_data!.position.x,
                                        e.score_data!.position.y,
                                        e.score_data!.position.z,
                                    ]
                                }))
                        }
                    },
                }
            });
            await tx.ares_carnage_report_player_achievements.createMany({
                data: multi._par.mps1.players
                    .filter((p, i) => i < playerCount)
                    .map((stats, i) => ({
                        carnage_report_id: carnageReportId,
                        player_index: i,
                        askar: stats.achievements.askar,
                        assault: stats.achievements.assault,
                        black_eye: stats.achievements.black_eye,
                        campaign_complete_normal: stats.achievements.campaign_complete_normal,
                        campaign_complete_heroic: stats.achievements.campaign_complete_heroic,
                        campaign_complete_legendary: stats.achievements.campaign_complete_legendary,
                        catch: stats.achievements.catch,
                        cavalier: stats.achievements.cavalier,
                        cleansing: stats.achievements.cleansing,
                        demon: stats.achievements.demon,
                        exterminator: stats.achievements.exterminator,
                        famine: stats.achievements.famine,
                        fear_the_pink_mist: stats.achievements.fear_the_pink_mist,
                        fog: stats.achievements.fog,
                        graduate: stats.achievements.graduate,
                        guerilla: stats.achievements.graduate,
                        headshot_honcho: stats.achievements.headshot_honcho,
                        holdout: stats.achievements.headshot_honcho,
                        iron: stats.achievements.iron,
                        killing_frenzy: stats.achievements.killing_frenzy,
                        landfall: stats.achievements.landfall,
                        last_stand: stats.achievements.last_stand,
                        lee_r_wilson_memorial: stats.achievements.lee_r_wilson_memorial,
                        marathon_man: stats.achievements.marathon_man,
                        maybe_next_time_buddy: stats.achievements.maybe_next_time_buddy,
                        mongoose_mowdown: stats.achievements.mongoose_mowdown,
                        mvp: stats.achievements.mvp,
                        mythic: stats.achievements.mythic,
                        orpheus: stats.achievements.orpheus,
                        overkill: stats.achievements.overkill,
                        ranger: stats.achievements.ranger,
                        reclaimer: stats.achievements.reclaimer,
                        refuge: stats.achievements.refuge,
                        return: stats.achievements._return,
                        spartan_officer: stats.achievements.spartan_officer,
                        steppin_razor: stats.achievements.steppin_razor,
                        the_key: stats.achievements.the_key,
                        the_road: stats.achievements.the_road,
                        thunderstorm: stats.achievements.thunderstorm,
                        tilt: stats.achievements.tilt,
                        too_close_to_the_sun: stats.achievements.too_close_to_the_sun,
                        tough_luck: stats.achievements.tough_luck,
                        triple_kill: stats.achievements.triple_kill,
                        two_for_one: stats.achievements.two_for_one,
                        unsc_spartan: stats.achievements.unsc_spartan,
                        up_close_and_personal: stats.achievements.up_close_and_personal,
                        used_car_salesman: stats.achievements.used_car_salesman,
                        vanguard: stats.achievements.vanguard,
                        we_re_in_for_some_chop: stats.achievements.we_re_in_for_some_chop
                    }))
            })

            const damageStatistics:  {
                carnage_report_id: string,
                player_index: number,
                damage_source: string,
                kills: number,
                betrayals: number,
                deaths: number,
                suicides: number,
                headshots: number,
            }[] = [];

            multi._par.mps1.players
                .filter((_, i) => i < playerCount)
                .forEach((playerStats, i) => {
                    Object.entries(playerStats.damage_statistics)
                        .filter(([_, v]) => v.valid)
                        .forEach(([k,v]) => {
                            damageStatistics.push({
                                carnage_report_id: carnageReportId,
                                player_index: i,
                                damage_source: k,
                                kills: v.kills,
                                betrayals: v.betrayals,
                                deaths: v.deaths,
                                suicides: v.suicides,
                                headshots: v.suicides,
                            })
                        })
                })
            await tx.ares_carnage_report_player_damage_statistics.createMany({
                data: damageStatistics
            })

            const interactions: {
                carnage_report_id: string,
                left_player_index: number,
                right_player_index: number,
                killed: number,
                killed_by: number
            }[] = [];

            multi._par.mps2.players
                .filter((p, i) => i < playerCount)
                .map(right => right.filter((p, i) => i < playerCount))
                .forEach((right, leftIndex) => {
                    right.forEach((data, rightIndex) => {
                        interactions.push({
                            carnage_report_id: carnageReportId,
                            left_player_index: leftIndex,
                            right_player_index: rightIndex,
                            killed: data.kills,
                            killed_by: data.deaths
                        })
                    })
                });
            await tx.ares_carnage_report_player_interaction.createMany({
                data: interactions
            })
            await tx.ares_carnage_report_player_medals.createMany({
                data: multi._par.mps1.players
                    .filter((p, i) => i < playerCount)
                    .map((p, i) => ({
                        carnage_report_id: carnageReportId,
                        player_index: i,
                        ...p.medals
                    }))
            })
            await tx.ares_carnage_report_player_statistics.createMany({
                data: multi._par.mps1.players
                    .filter((p, i) => i < playerCount)
                    .map((p, i) => ({
                        carnage_report_id: carnageReportId,
                        player_index: i,
                        ...p.statistics
                    }))
            })
            await tx.ares_carnage_report_team_statistics.createMany({
                data: multi._par.mps3.teams
                    .filter((t, i) => i < teamCount)
                    .map((t, i) => ({
                        carnage_report_id: carnageReportId,
                        team_index: i,
                        ...t
                    }))
            })
            
            this.logger.debug(`[UPLOAD] Received Ares Carnage Report: ${multi.mpvr.game_variant.m_base_variant.m_metadata.name} on ${multi.mpgd.map_variant_name} (${carnageReportId})`)
            
            let winner: string | undefined = undefined;
            let winningScore: number = Number.NEGATIVE_INFINITY;
            if (multi.mpgd.team_game) {
                multi.mptm.teams.forEach((t, i) => {
                    if (!t.exists) return;
                    if (t.score > winningScore) {
                        winningScore = t.score;
                        winner = `${TEAM_NAMES[i]} Team`;
                    }
                    else if (winningScore === t.score) {
                        // It's a tie.
                        winner = undefined;
                    }
                })
            } else {
                multi.mppl.players.forEach(p => {
                    if (!p.player_exists) return;
                    if (p.score > winningScore) {
                        winningScore = p.score;
                        winner = p.player_configuration_from_host.player_name;
                    }
                    else if (winningScore === p.score) {
                        winner = undefined;
                    }
                })
            }

            if (multi.mpgd.finished) {
                this.discordWebhookService.sendAresCarnageReport({
                    carnageReportId,
                    startTime: multi.mpgd.start_time,
                    finishTime: multi.mpgd.finish_time,
                    gametype: multi.mpvr.game_variant.m_base_variant.m_metadata.name,
                    hopperName: multi.mpmo.hopper_identifier >= 0
                        ? multi.mpmo.hopper_name
                        : undefined,
                    map: multi.mpgd.map_variant_name,
                    mapId: multi.mpgd.map_id,
                    playerCount,
                    teamGame: multi.mpgd.team_game,
                    winningScore,
                    winner
                }).catch((err) => this.logger.error(`Failed to send carnage report to discord: ${err}`))
            }

            await tx.ares_service_record.deleteMany({
                where: {
                    player_xuid: {
                        in: multi.mppl.players
                            .filter(player => player.player_exists)
                            .map(player => player.player_configuration_from_client.player_xuid.toString())
                    }
                }
            })

            await tx.ares_service_record.createMany({
                data: multi.mppl.players
                    .filter(player => player.player_exists)
                    .filter(player => !isGuestXuid(player.player_configuration_from_client.player_xuid))
                    .map(player => {
                        const config = player.player_configuration_from_client;
                        return {
                            player_xuid: config.player_xuid.toString(),
                            player_name: config.player_name,
                            appearance_flags: config.appearance.appearance_flags,
                            primary_color: config.appearance.primary_color,
                            secondary_color: config.appearance.secondary_color,
                            tertiary_color: config.appearance.tertiary_color,
                            is_elite: config.appearance.player_model_choice,
                            foreground_emblem: config.appearance.foreground_emblem,
                            background_emblem: config.appearance.background_emblem,
                            emblem_flags: config.appearance.emblem_flags,
                            emblem_primary_color: config.appearance.emblem_primary_color,
                            emblem_secondary_color: config.appearance.emblem_secondary_color,
                            emblem_background_color: config.appearance.emblem_background_color,
                            spartan_helmet: config.appearance.spartan_model_area_0,
                            spartan_left_shoulder: config.appearance.spartan_model_area_1,
                            spartan_right_shoulder: config.appearance.spartan_model_area_2,
                            spartan_body: config.appearance.spartan_model_area_3,
                            elite_helmet: config.appearance.elite_model_area_0,
                            elite_left_shoulder: config.appearance.elite_model_area_1,
                            elite_right_shoulder: config.appearance.elite_model_area_2,
                            elite_body: config.appearance.elite_model_area_3,
                            service_tag: config.appearance.service_tag,
                            campaign_progress: config.campaign_difficulty_completed,
                            highest_skill: config.queried_player_statistics.queried_player_global_statistics.highest_skill,
                            total_exp: player.player_configuration_from_host.stats_global_experience,
                            experience_base: player.player_configuration_from_client.queried_player_statistics.queried_player_global_statistics.experience_base,
                            rank: player.player_configuration_from_host.stats_global_rank,
                            grade: player.player_configuration_from_host.stats_global_grade,
                            games_completed: player.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.custom_games_completed
                                + player.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.matchmade_ranked_games_played
                                + player.player_configuration_from_client.queried_player_statistics.queried_player_displayed_statistics.matchmade_unranked_games_played,
                            first_played: config.queried_player_statistics.queried_player_displayed_statistics.first_played,
                            last_played: config.queried_player_statistics.queried_player_displayed_statistics.last_played,
                            bungienet_user_flags: config.bungienet_user_flags,
                            is_silver_or_gold_live: config.is_silver_or_gold_live,
                            is_online_enabled: config.is_online_enabled,
                            gamer_region: config.gamer_region,
                            cheat_flags: config.cheat_flags,
                            ban_flags: config.ban_flags,
                            matchmade_ranked_games_played: config.queried_player_statistics.queried_player_displayed_statistics.matchmade_ranked_games_played,
                            matchmade_ranked_games_won: config.queried_player_statistics.queried_player_displayed_statistics.matchmade_ranked_games_won,
                            matchmade_ranked_games_completed: config.queried_player_statistics.queried_player_displayed_statistics.matchmade_ranked_games_completed,
                            matchmade_unranked_games_played: config.queried_player_statistics.queried_player_displayed_statistics.matchmade_unranked_games_played,
                            matchmade_unranked_games_completed: config.queried_player_statistics.queried_player_displayed_statistics.matchmade_unranked_games_completed,
                            custom_games_completed: config.queried_player_statistics.queried_player_displayed_statistics.custom_games_completed,
                        };
                    }
                )
            });
        }, { timeout: 15_000 });
    }
}