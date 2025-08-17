import { BadRequestException, Controller, Get, Header, Headers, Inject, NotFoundException, Param, ParseBoolPipe, ParseIntPipe, Post, Query, Res, StreamableFile, UnauthorizedException } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { EXAMPLE_XUID } from "src/lsp/constants";
import { AchievementsService } from "../services/achievements.service";
import { parseXuid } from "src/xbox/xuid";
import { PrismaService } from "src/db/prisma.service";
import { Halo3EmblemsService } from "../services/halo3emblems.service";
import { Halo3FileShareService } from "../services/halo3fileshare.service";
import { TitleID } from "src/xbox/titles";

const RECON_REQUIRED_ACHIEVEMENTS = [
    {
        id: 91,
        online: true,
    },
    {
        id: 92,
        online: true,
    },
    {
        id: 63,
        online: true,
    },
    {
        id: 90,
        online: false,
    },
    {
        id: 108,
        online: true,
    },
    {
        id: 109,
        online: true,
    },
    {
        id:107,
        online: true,
    },
]


@ApiTags('Halo 3')
@Controller('/halo3')
export class Halo3Controller {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly achievementsService: AchievementsService,
        private readonly prisma: PrismaService,
        private readonly emblemsService: Halo3EmblemsService,
        private readonly fileshareService: Halo3FileShareService,
    ) { }

    @Get('/screenshots/:id/view')
    @ApiOperation({
        summary: 'View Screenshot',
        description: 'Returns an uploaded Halo 3 JPEG screenshot.'
    })
    @Header('Content-Type', 'image/jpeg')
    async viewScreenshot(
        @Param('id') id: string,
    ) {
        return new StreamableFile(
            Uint8Array.from(await this.fileshareService.viewBlindScreenshot(id))
        );
    }

    @Get('/emblem')
    @ApiOperation({
        summary: 'Get Emblemr',
        description: `Renders a Halo 3 Emblem PNG using the provided parameters.`,
    })
    @Header('Content-Type', 'image/png')
    async generateEmblemImage(
        @Query('armour_primary_color', new ParseIntPipe({optional: true})) armour_primary_color: number | undefined,
        @Query('size', ParseIntPipe) size: number,
        @Query('primary', ParseIntPipe) primary: number,
        @Query('secondary') secondary: boolean,
        @Query('background', ParseIntPipe) background: number,
        @Query('primary_color', ParseIntPipe) primary_color: number,
        @Query('secondary_color', ParseIntPipe) secondary_color: number,
        @Query('background_color', ParseIntPipe) background_color: number,
    ) { 
        if (size > 1000) throw new BadRequestException('Invalid emblem size.');
        
        return new StreamableFile(await this.emblemsService.renderEmblem({
            armour_primary_color,
            size,
            primary,
            secondary,
            background,
            primary_color,
            secondary_color,
            background_color
        }));
    }

    @Post('/unlock_recon')
    @ApiOperation({
        summary: 'Unlock Recon Armor',
        description: `Checks if the provided XUID has unlocked the Vidmaster Road-to-Recon Achievements and unlocks the Recon armor if true.`,
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID})
    @ApiHeader({ name: 'x-uhs' })
    @ApiHeader({ name: 'Authorization' })
    async unlockRecon(
        @Headers('x-xuid') xuid: string,
        @Headers('x-uhs') uhs: string,
        @Headers('Authorization') xsts: string,
    ) {
        // Request Achievements
        const authorization = `XBL3.0 x=${uhs};${xsts}`
        const player_xuid = parseXuid(xuid);

        const halo3Achieevements = await this.achievementsService.getAchievements(
            authorization,
            player_xuid,
            TitleID.HALO3,
            true,
            79
        )

        
        const halo3ODSTAchieevements = await this.achievementsService.getAchievements(
            authorization,
            player_xuid,
            TitleID.HALO3ODST,
            true,
            47
        )

        const allAchievements = halo3Achieevements.achivements.concat(halo3ODSTAchieevements.achivements);
        let reconUnlocked = true;
        for (const requiredAchievement of RECON_REQUIRED_ACHIEVEMENTS) {
            const unlocked = allAchievements.filter(cheevo => cheevo.id === requiredAchievement.id && (!requiredAchievement.online || cheevo.unlockedOnline)).length > 0;
            if (!unlocked) {
                reconUnlocked = false;
                break;
            }
        }

        if (!reconUnlocked) {
            return new UnauthorizedException("You haven't unlocked all of the required achievements yet.")
        }

        await this.prisma.player_data.upsert({
            where: {
                player_xuid
            },
            create: {
                player_xuid,
                road_to_recon_completed: true
            },
            update: {
                road_to_recon_completed: true
            }
        })

    }

    @Get('/carnage-reports/:id')
    @ApiParam({ name: 'id' })
    async getCarnageReport(
        @Param('id') id: string,
    ) {
        const carnageReport = await this.prisma.carnage_report.findUnique({
            where: {
                id,
            },
            include: {
                carnage_report_matchmaking_options: true,
                carnage_report_team: {
                    include: {
                        carnage_report_team_statistics: true,
                    }
                },
                carnage_report_player: {
                    include: {
                        carnage_report_player_statistics: true,
                        carnage_report_player_medals: true,
                        carnage_report_player_achievements: true,
                        carnage_report_player_damage_statistics: {
                            select: {
                                damage_source: true,
                                kills: true,
                                deaths: true,
                                betrayals: true,
                                suicides: true,
                                headshots: true,
                            }
                        },
                        carnage_report_machine: {
                            select: {
                                machine_host: true,
                                machine_initial_host: true,
                                session_party_nonce: true,
                            }
                        },
                    }
                },
                carnage_report_event_carry: {
                    select: {
                        time: true,
                        weapon_index: true,
                        carry_player_index: true,
                        position: true,
                        carry_type: true,
                    }
                },
                carnage_report_event_kill: {
                    select: {
                        time: true,
                        killer_player_index: true,
                        dead_player_index: true,
                        killer_position: true,
                        dead_position: true,
                        kill_type: true,
                    }
                },
                carnage_report_event_score: {
                    select: {
                        time: true,
                        score_player_index: true,
                        position: true,
                        weapon_index: true,
                        score_type: true,
                    }
                },
                carnage_report_game_variant: true,
            }
        })

        if (!carnageReport) {
            throw new NotFoundException();
        }

        const playerInterractions = await this.prisma.carnage_report_player_interaction.findMany({
            where: {
                carnage_report_id: id,
            },
            select: {
                left_player_index: true,
                right_player_index: true,
                killed: true,
                killed_by: true,
            }
        })

        return {
            id: carnageReport.id,
            teams: carnageReport.carnage_report_team.map(team => ({
                score: team.score,
                standing: team.standing,
                team_index: team.team_index,
                statistics: team.carnage_report_team_statistics,
            })),
            events: {
                kill_events: carnageReport.carnage_report_event_kill,
                carry_events: carnageReport.carnage_report_event_carry,
                score_events: carnageReport.carnage_report_event_score,
            },
            map_id: carnageReport.map_id,
            game_id: carnageReport.game_id,
            players: carnageReport.carnage_report_player.map(player => ({
                medals: player.carnage_report_player_medals,
                statistics: player.carnage_report_player_statistics,
                achievements: player.carnage_report_player_achievements,
                damage_statistics: player.carnage_report_player_damage_statistics,
                ...player.carnage_report_machine,
                score: player.score,
                result: player.result,
                standing: player.standing,
                ban_flags: player.ban_flags,
                gamer_zone: player.gamer_zone,
                is_griefer: player.is_griefer,
                cheat_flags: player.cheat_flags,
                last_played: player.last_played,
                player_name: player.player_name,
                player_team: player.player_team,
                player_xuid: player.player_xuid,
                service_tag: player.service_tag,
                desires_veto: player.desires_veto,
                emblem_flags: player.emblem_flags,
                first_played: player.first_played,
                gamer_region: player.gamer_region,
                player_index: player.player_index,
                machine_index: player.machine_index,
                primary_color: player.primary_color,
                tertiary_color: player.tertiary_color,
                desires_rematch: player.desires_rematch,
                secondary_color: player.secondary_color,
                appearance_flags: player.appearance_flags,
                background_emblem: player.background_emblem,
                foreground_emblem: player.foreground_emblem,
                is_online_enabled: player.is_online_enabled,
                player_identifier: player.player_identifier,
                elite_model_area_0: player.elite_model_area_0,
                elite_model_area_1: player.elite_model_area_1,
                elite_model_area_2: player.elite_model_area_2,
                elite_model_area_3: player.elite_model_area_3,
                hopper_access_flags: player.hopper_access_flags,
                player_model_choice: player.player_model_choice,
                bungienet_user_flags: player.bungienet_user_flags,
                emblem_primary_color: player.emblem_primary_color,
                hopper_statistics_mu: player.hopper_statistics_mu,
                player_assigned_team: player.player_assigned_team,
                spartan_model_area_0: player.spartan_model_area_0,
                spartan_model_area_1: player.spartan_model_area_1,
                spartan_model_area_2: player.spartan_model_area_2,
                spartan_model_area_3: player.spartan_model_area_3,
                custom_games_completed: player.custom_games_completed,
                emblem_secondary_color: player.emblem_secondary_color,
                hopper_experience_base: player.hopper_experience_base,
                host_stats_global_rank: player.host_stats_global_rank,
                is_controller_attached: player.is_controller_attached,
                is_silver_or_gold_live: player.is_silver_or_gold_live,
                emblem_background_color: player.emblem_background_color,
                global_statistics_valid: player.global_statistics_valid,
                hopper_statistics_sigma: player.hopper_statistics_sigma,
                hopper_statistics_valid: player.hopper_statistics_valid,
                host_stats_global_grade: player.host_stats_global_grade,
                host_stats_global_valid: player.host_stats_global_valid,
                host_stats_hopper_skill: player.host_stats_hopper_skill,
                host_stats_hopper_valid: player.host_stats_hopper_valid,
                experience_growth_banned: player.experience_growth_banned,
                user_selected_team_index: player.user_selected_team_index,
                hopper_experience_penalty: player.hopper_experience_penalty,
                is_free_live_gold_account: player.is_free_live_gold_account,
                repeated_play_coefficient: player.repeated_play_coefficient,
                matchmade_ranked_games_won: player.matchmade_ranked_games_won,
                hopper_statistics_games_won: player.hopper_statistics_games_won,
                hopper_statistics_identifier: player.hopper_statistics_identifier,
                host_stats_global_experience: player.host_stats_global_experience,
                campaign_difficulty_completed: player.campaign_difficulty_completed,
                matchmade_ranked_games_played: player.matchmade_ranked_games_played,
                hopper_statistics_games_played: player.hopper_statistics_games_played,
                hopper_statistics_hopper_skill: player.hopper_statistics_hopper_skill,
                global_statistics_highest_skill: player.global_statistics_highest_skill,
                host_stats_hopper_skill_display: player.host_stats_hopper_skill_display,
                is_user_created_content_allowed: player.is_user_created_content_allowed,
                matchmade_unranked_games_played: player.matchmade_unranked_games_played,
                matchmade_ranked_games_completed: player.matchmade_ranked_games_completed,
                global_statistics_experience_base: player.global_statistics_experience_base,
                hopper_statistics_games_completed: player.hopper_statistics_games_completed,
                is_friend_created_content_allowed: player.is_friend_created_content_allowed,
                matchmade_unranked_games_completed: player.matchmade_unranked_games_completed,
                global_statistics_experience_penalty: player.global_statistics_experience_penalty,
                host_stats_hopper_skill_update_weight: player.host_stats_hopper_skill_update_weight,
            })),
            started: carnageReport.started,
            finished: carnageReport.finished,
            start_time: carnageReport.start_time,
            finish_time: carnageReport.finish_time,
            game_variant: carnageReport.carnage_report_game_variant,
            migrated_solo: carnageReport.migrated_solo,
            scenario_path: carnageReport.scenario_path,
            in_group_session: carnageReport.in_group_session,
            in_squad_session: carnageReport.in_squad_session,
            map_variant_name: carnageReport.map_variant_name,
            migrated_to_group: carnageReport.migrated_to_group,
            simulation_aborted: carnageReport.simulation_aborted,
            matchmaking_options: carnageReport.carnage_report_matchmaking_options,
            player_interactions: playerInterractions,
            map_variant_unique_id: carnageReport.map_variant_unique_id,
            game_variant_unique_id: carnageReport.game_variant_unique_id,
            team_game: carnageReport.team_game,
        }
    }
}