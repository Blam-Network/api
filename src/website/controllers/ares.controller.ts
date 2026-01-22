import { BadRequestException, Body, Controller, Delete, Get, Header, Headers, Inject, NotFoundException, Param, ParseBoolPipe, ParseIntPipe, Post, Query, Res, StreamableFile, UnauthorizedException } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { EXAMPLE_XUID } from "src/constants";
import { PrismaService } from "src/db/prisma.service";
import { Halo3EmblemsService } from "../services/halo3emblems.service";
import { AresPopulationService } from "../services/arespopulation.service";

@ApiTags('Ares')
@Controller('/ares')
export class AresController {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly emblemsService: Halo3EmblemsService,
        private readonly populationService: AresPopulationService,
    ) { }

    @Get('/players/:xuid/servicerecord')
    @ApiParam({ name: 'xuid' })
    async getServiceRecordByXuid(
        @Param('xuid') xuid: string,
    ) {
        const sr = await this.prisma.ares_service_record.findUnique({
            where: { player_xuid: xuid as any },
        });
        if (!sr) {
            return {};
        }
        return {
            id: String(sr.player_xuid),
            playerName: sr.player_name,
            appearanceFlags: sr.appearance_flags,
            primaryColor: sr.primary_color,
            secondaryColor: sr.secondary_color,
            tertiaryColor: sr.tertiary_color,
            model: sr.is_elite,
            foregroundEmblem: sr.foreground_emblem,
            backgroundEmblem: sr.background_emblem,
            emblemFlags: sr.emblem_flags,
            emblemPrimaryColor: sr.emblem_primary_color,
            emblemSecondaryColor: sr.emblem_secondary_color,
            emblemBackgroundColor: sr.emblem_background_color,
            spartanHelmet: sr.spartan_helmet,
            spartanLeftShounder: sr.spartan_left_shoulder,
            spartanRightShoulder: sr.spartan_right_shoulder,
            spartanBody: sr.spartan_body,
            eliteHelmet: sr.elite_helmet,
            eliteLeftShoulder: sr.elite_left_shoulder,
            eliteRightShoulder: sr.elite_right_shoulder,
            eliteBody: sr.elite_body,
            serviceTag: sr.service_tag,
            campaignProgress: sr.campaign_progress,
            highestSkill: sr.highest_skill,
            totalEXP: sr.total_exp,
            unknownInsignia: sr.experience_base,
            rank: sr.rank,
            grade: sr.grade,
            unknownInsignia2: 0,
            firstPlayed: sr.first_played,
            lastPlayed: sr.last_played,
            gamesCompleted: sr.games_completed,
        };
    }

    @Get('/players/by-gamertag/:gamertag/servicerecord')
    @ApiParam({ name: 'gamertag' })
    async getServiceRecordByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const sr = await this.prisma.ares_service_record.findFirst({
            where: { player_name: gamertag },
        });
        if (!sr) {
            return {};
        }
        return {
            id: String(sr.player_xuid),
            playerName: sr.player_name,
            appearanceFlags: sr.appearance_flags,
            primaryColor: sr.primary_color,
            secondaryColor: sr.secondary_color,
            tertiaryColor: sr.tertiary_color,
            model: sr.is_elite,
            foregroundEmblem: sr.foreground_emblem,
            backgroundEmblem: sr.background_emblem,
            emblemFlags: sr.emblem_flags,
            emblemPrimaryColor: sr.emblem_primary_color,
            emblemSecondaryColor: sr.emblem_secondary_color,
            emblemBackgroundColor: sr.emblem_background_color,
            spartanHelmet: sr.spartan_helmet,
            spartanLeftShounder: sr.spartan_left_shoulder,
            spartanRightShoulder: sr.spartan_right_shoulder,
            spartanBody: sr.spartan_body,
            eliteHelmet: sr.elite_helmet,
            eliteLeftShoulder: sr.elite_left_shoulder,
            eliteRightShoulder: sr.elite_right_shoulder,
            eliteBody: sr.elite_body,
            serviceTag: sr.service_tag,
            campaignProgress: sr.campaign_progress,
            highestSkill: sr.highest_skill,
            totalEXP: sr.total_exp,
            unknownInsignia: sr.experience_base,
            rank: sr.rank,
            grade: sr.grade,
            unknownInsignia2: 0,
            firstPlayed: sr.first_played,
            lastPlayed: sr.last_played,
            gamesCompleted: sr.games_completed,
        };
    }

    @Get('/emblem')
    @ApiOperation({
        summary: 'Get Emblem',
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

    @Get('/carnage-reports/:id')
    @ApiParam({ name: 'id' })
    async getCarnageReport(
        @Param('id') id: string,
    ) {
        const carnageReport = await this.prisma.ares_carnage_report.findUnique({
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

        const playerInterractions = await this.prisma.ares_carnage_report_player_interaction.findMany({
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
            teams: carnageReport.carnage_report_team.map(team => {
                if (!team.carnage_report_team_statistics) {
                    // If statistics is null, we need to provide all required fields with default values
                    // This shouldn't happen in practice, but handle it gracefully
                    return {
                        score: team.score,
                        standing: team.standing,
                        team_index: team.team_index,
                        statistics: {
                            kills: 0,
                            deaths: 0,
                            assists: 0,
                            unused0: 0,
                            unused1: 0,
                            unused2: 0,
                            suicides: 0,
                            total_wp: 0,
                            betrayals: 0,
                            games_won: 0,
                            games_tied: 0,
                            rounds_won: 0,
                            games_played: 0,
                            king_unused0: 0,
                            king_unused1: 0,
                            seconds_alive: 0,
                            vip_takedowns: 0,
                            ctf_flag_grabs: 0,
                            in_round_score: 0,
                            oddball_unused: 0,
                            vip_guard_time: 0,
                            ctf_flag_scores: 0,
                            games_completed: 0,
                            vip_time_as_vip: 0,
                            ctf_flag_returns: 0,
                            juggernaut_kills: 0,
                            rounds_completed: 0,
                            vip_kills_as_vip: 0,
                            vip_lives_as_vip: 0,
                            assault_bomb_arms: 0,
                            juggernaut_unused: 0,
                            king_time_on_hill: 0,
                            territories_ousts: 0,
                            territories_owned: 0,
                            assault_bomb_grabs: 0,
                            in_game_total_score: 0,
                            most_kills_in_a_row: 0,
                            assault_bomb_disarms: 0,
                            infection_infections: 0,
                            territories_captures: 0,
                            ctf_flag_carrier_kills: 0,
                            infection_zombie_kills: 0,
                            oddball_time_with_ball: 0,
                            infection_time_as_human: 0,
                            king_total_control_time: 0,
                            assault_bomb_detonations: 0,
                            oddball_kills_as_carrier: 0,
                            oddball_ball_carrier_kills: 0,
                            juggernaut_total_control_time: 0,
                            territories_time_in_territory: 0,
                            juggernaut_kills_as_juggernaut: 0,
                        },
                    };
                }
                const { carnage_report_id, team_index: _, ...statistics } = team.carnage_report_team_statistics;
                return {
                    score: team.score,
                    standing: team.standing,
                    team_index: team.team_index,
                    statistics,
                };
            }),
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
            matchmaking_options: carnageReport.carnage_report_matchmaking_options 
            ?  {
                    ...carnageReport.carnage_report_matchmaking_options,
                    draw_probability: Number(carnageReport.carnage_report_matchmaking_options?.draw_probability),
                    experience_base_increment: Number(carnageReport.carnage_report_matchmaking_options?.draw_probability),
                    experience_penalty_decrement: Number(carnageReport.carnage_report_matchmaking_options?.draw_probability),
                }
            : undefined,
            player_interactions: playerInterractions,
            map_variant_unique_id: carnageReport.map_variant_unique_id,
            game_variant_unique_id: carnageReport.game_variant_unique_id,
            team_game: carnageReport.team_game,
        }
    }

    @Get('/nightmap')
    @ApiOperation({
        summary: 'Get Nightmap',
        description: 'Returns the dynamic nightmap showing recent player locations (6 hours).',
    })
    @Header('Content-Type', 'image/jpeg')
    async getNightmap() {
        const nightmap = await this.populationService.getNightmap(6);
        return new StreamableFile(nightmap, { disposition: "filename=nightmap.jpg" });
    }

    @Get('/nightmap-24h')
    @ApiOperation({
        summary: 'Get Nightmap (24h)',
        description: 'Returns the dynamic nightmap showing recent player locations (24 hours).',
    })
    @Header('Content-Type', 'image/jpeg')
    async getNightmap24h() {
        const nightmap = await this.populationService.getNightmap(24);
        return new StreamableFile(nightmap, { disposition: "filename=nightmap-24h.jpg" });
    }

    @Get('/online-players')
    @ApiOperation({
        summary: 'Get Online Players Count',
        description: 'Returns the number of players who have played in the last 6 hours (matching the nightmap).',
    })
    async getOnlinePlayersCount() {
        const result = await this.prisma.$queryRaw<{ player_count: bigint }[]>`
            SELECT COUNT(DISTINCT crp.player_xuid)::bigint AS player_count
            FROM "ares"."carnage_report_player" crp
            INNER JOIN "ares"."carnage_report" cr ON cr.id = crp.carnage_report_id
            WHERE cr.finish_time >= NOW() AT TIME ZONE 'UTC' - INTERVAL '6 hours'
        `;
        return {
            count: Number(result[0]?.player_count ?? 0),
        };
    }

    @Get('/online-players-24h')
    @ApiOperation({
        summary: 'Get Online Players Count (24h)',
        description: 'Returns the number of players who have played in the last 24 hours.',
    })
    async getOnlinePlayersCount24h() {
        const result = await this.prisma.$queryRaw<{ player_count: bigint }[]>`
            SELECT COUNT(DISTINCT crp.player_xuid)::bigint AS player_count
            FROM "ares"."carnage_report_player" crp
            INNER JOIN "ares"."carnage_report" cr ON cr.id = crp.carnage_report_id
            WHERE cr.finish_time >= NOW() AT TIME ZONE 'UTC' - INTERVAL '24 hours'
        `;
        return {
            count: Number(result[0]?.player_count ?? 0),
        };
    }

    @Get('/players')
    @ApiOperation({
        summary: 'List Players',
        description: 'Returns a paginated list of players with optional search by name.',
    })
    async listPlayers(
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 20,
        @Query('search') search?: string,
    ) {
        const skip = (page - 1) * pageSize;
        const take = pageSize;

        const where = search
            ? {
                  player_name: {
                      contains: search,
                      mode: 'insensitive' as const,
                  },
              }
            : {};

        const [players, total] = await Promise.all([
            this.prisma.ares_service_record.findMany({
                where,
                skip,
                take,
                orderBy: {
                    last_played: 'desc',
                },
                select: {
                    player_xuid: true,
                    player_name: true,
                    appearance_flags: true,
                    primary_color: true,
                    secondary_color: true,
                    tertiary_color: true,
                    is_elite: true,
                    foreground_emblem: true,
                    background_emblem: true,
                    emblem_flags: true,
                    emblem_primary_color: true,
                    emblem_secondary_color: true,
                    emblem_background_color: true,
                    spartan_helmet: true,
                    spartan_left_shoulder: true,
                    spartan_right_shoulder: true,
                    spartan_body: true,
                    elite_helmet: true,
                    elite_left_shoulder: true,
                    elite_right_shoulder: true,
                    elite_body: true,
                    service_tag: true,
                    campaign_progress: true,
                    highest_skill: true,
                    total_exp: true,
                    experience_base: true,
                    rank: true,
                    grade: true,
                    first_played: true,
                    last_played: true,
                    games_completed: true,
                },
            }),
            this.prisma.ares_service_record.count({ where }),
        ]);

        return {
            players: players.map(sr => ({
                id: String(sr.player_xuid),
                playerName: sr.player_name,
                appearanceFlags: sr.appearance_flags,
                primaryColor: sr.primary_color,
                secondaryColor: sr.secondary_color,
                tertiaryColor: sr.tertiary_color,
                model: sr.is_elite,
                foregroundEmblem: sr.foreground_emblem,
                backgroundEmblem: sr.background_emblem,
                emblemFlags: sr.emblem_flags,
                emblemPrimaryColor: sr.emblem_primary_color,
                emblemSecondaryColor: sr.emblem_secondary_color,
                emblemBackgroundColor: sr.emblem_background_color,
                spartanHelmet: sr.spartan_helmet,
                spartanLeftShounder: sr.spartan_left_shoulder,
                spartanRightShoulder: sr.spartan_right_shoulder,
                spartanBody: sr.spartan_body,
                eliteHelmet: sr.elite_helmet,
                eliteLeftShoulder: sr.elite_left_shoulder,
                eliteRightShoulder: sr.elite_right_shoulder,
                eliteBody: sr.elite_body,
                serviceTag: sr.service_tag,
                campaignProgress: sr.campaign_progress,
                highestSkill: sr.highest_skill,
                totalEXP: sr.total_exp,
                unknownInsignia: sr.experience_base,
                rank: sr.rank,
                grade: sr.grade,
                unknownInsignia2: 0,
                firstPlayed: sr.first_played,
                lastPlayed: sr.last_played,
                gamesCompleted: sr.games_completed,
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    @Get('/players/by-gamertag/:gamertag/statistics')
    @ApiParam({ name: 'gamertag' })
    @ApiOperation({
        summary: 'Get Player Statistics',
        description: 'Returns aggregated statistics for a player including game type breakdown and win/loss/tie counts.',
    })
    async getPlayerStatistics(
        @Param('gamertag') gamertag: string,
    ) {
        const decodedGamertag = decodeURIComponent(gamertag);
        // TODO: in future we should use XUID as the param instead.
        const serviceRecord = await this.prisma.ares_service_record.findFirst({
            where: {
                player_name: decodedGamertag,
            },
            select: {
                player_xuid: true,
            },
        })
        if (!serviceRecord) {
            throw new NotFoundException('Player not found');
        }
        const playerXuid = serviceRecord.player_xuid.toString();

        // TODO: Fill Data
        const campaignMatches = {
            _count: {
                id: 0,
            }
        }

        const matchmakingMatches = await this.prisma.ares_carnage_report.aggregate({
            _count: {
                id: true,
            },
            where: {
                carnage_report_player: {
                    some: {
                        player_xuid: playerXuid,
                    },
                },
                carnage_report_matchmaking_options: {
                    isNot: null,
                }
            },
        })
        const customGames = await this.prisma.ares_carnage_report.aggregate({
            _count: {
                id: true,
            },
            where: {
                carnage_report_player: {
                    some: {
                        player_xuid: playerXuid,
                    },
                },
                carnage_report_matchmaking_options: {
                    is: null,
                },
                carnage_report_game_variant: {
                    game_engine: {
                        not: 5,
                    }
                }
            },
        })
        const forgeGames = await this.prisma.ares_carnage_report.aggregate({
            _count: {
                id: true,
            },
            where: {
                carnage_report_player: {
                    some: {
                        player_xuid: playerXuid,
                    },
                },
                carnage_report_matchmaking_options: {
                    is: null,
                },
                carnage_report_game_variant: {
                    game_engine: 5
                }
            },
        })

        // Calculate game type breakdown
        const gameTypeCounts = {
            Campaign: campaignMatches._count.id,
            Matchmaking: matchmakingMatches._count.id,
            "Custom Games": customGames._count.id,
            Forge: forgeGames._count.id,
        };

        const kdRatio = await this.prisma.ares_carnage_report_player_statistics.aggregate({
            _sum: {
                kills: true,
                deaths: true,
            },
            where: {
                carnage_report_player: {
                    player_xuid: playerXuid,
                    carnage_report: {
                        carnage_report_matchmaking_options: {
                            isNot: null,
                        }
                    }
                }
            },
        })

        // Get player statistics for kills/deaths
        let totalKills = kdRatio._sum.kills;
        let totalDeaths = kdRatio._sum.deaths;

        // Get most killed and most killed by

        const mostKilledXuids = await this.prisma.$queryRaw<
            { killedxuid: bigint; killedcount: bigint }[]
        >`
            select 
                right_player.player_xuid as killedxuid,
                sum(crpi.killed) as killedcount 
            from 
                ares.carnage_report_player_interaction crpi
            left join 
                ares.carnage_report_player right_player 
            on right_player.player_index = crpi.right_player_index 
                and right_player.carnage_report_id = crpi.carnage_report_id
            left join 
                ares.carnage_report_player left_player 
            on left_player.player_index = crpi.left_player_index 
                and left_player.carnage_report_id = crpi.carnage_report_id
            where left_player.player_xuid = ${playerXuid}::bigint
                and right_player.is_guest = false
            group by right_player.player_xuid
            order by killedcount desc
            limit 10;
        `;

        const mostKilledByXuids = await this.prisma.$queryRaw<
            { killerxuid: bigint; killedbycount: bigint }[]
        >`
            select 
                right_player.player_xuid as killerxuid,
                sum(crpi.killed_by) as killedbycount 
            from 
                ares.carnage_report_player_interaction crpi
            left join 
                ares.carnage_report_player right_player 
            on right_player.player_index = crpi.right_player_index 
                and right_player.carnage_report_id = crpi.carnage_report_id
            left join 
                ares.carnage_report_player left_player 
            on left_player.player_index = crpi.left_player_index 
                and left_player.carnage_report_id = crpi.carnage_report_id
            where left_player.player_xuid = ${playerXuid}::bigint
                and right_player.is_guest = false
            group by right_player.player_xuid
            order by killedbycount desc
            limit 10;
        `;
        
        const mostKilledServiceRecords = await this.prisma.ares_service_record.findMany({
            where: {
                player_xuid: { in: mostKilledXuids.map(x => x.killedxuid.toString()) },
            },
            select: {
                player_xuid: true,
                player_name: true,
                service_tag: true,
                is_elite: true,
                primary_color: true,
                foreground_emblem: true,
                background_emblem: true,
                emblem_flags: true,
                emblem_primary_color: true,
                emblem_secondary_color: true,
                emblem_background_color: true,
            }
        })

        const mostKilledByServiceRecords = await this.prisma.ares_service_record.findMany({
            where: {
                player_xuid: { in: mostKilledByXuids.map(x => x.killerxuid.toString()) },
            },
            select: {
                player_xuid: true,
                player_name: true,
                service_tag: true,
                is_elite: true,
                primary_color: true,
                foreground_emblem: true,
                background_emblem: true,
                emblem_flags: true,
                emblem_primary_color: true,
                emblem_secondary_color: true,
                emblem_background_color: true,
            }
        })

        const mostKilled = mostKilledServiceRecords.map(sr => ({
            count: (mostKilledXuids.find(x => x.killedxuid.toString() === sr.player_xuid.toString())?.killedcount || 0).toString(),
            ...sr,
            player_xuid: sr.player_xuid.toString(),
        }));

        const mostKilledBy = mostKilledByServiceRecords.map(sr => ({
            count: (mostKilledByXuids.find(x => x.killerxuid.toString() === sr.player_xuid.toString())?.killedbycount || 0).toString(),
            ...sr,
            player_xuid: sr.player_xuid.toString(),
        }));
        
        let weaponKillsQueryResult = await this.prisma.ares_carnage_report_player_damage_statistics.groupBy({
            by: ['damage_source'],
            _sum: {
                kills: true,
            },
            where: {
                carnage_report_player: {
                    player_xuid: playerXuid,
                    carnage_report: {
                        carnage_report_matchmaking_options: {
                            isNot: null,
                        }
                    }
                },
            },
        })

        const weaponKills = weaponKillsQueryResult
            .filter(w => w._sum.kills ?? 0 > 0)
            .map(w => ({
                weapon: w.damage_source,
                kills: w._sum.kills ?? 0,
            }));

        const weaponOfChoice = weaponKills.sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0))[0] ?? null;

        const medalChestQueryData = await this.prisma.ares_carnage_report_player_medals.aggregate({
            _sum: {
                extermination: true,
                perfection: true,
                multiple_kill_2: true,
                multiple_kill_3: true,
                multiple_kill_4: true,
                multiple_kill_5: true,
                multiple_kill_6: true,
                multiple_kill_7: true,
                multiple_kill_8: true,
                multiple_kill_9: true,
                multiple_kill_10: true,
                kills_in_a_row_5: true,
                kills_in_a_row_10: true,
                kills_in_a_row_15: true,
                kills_in_a_row_20: true,
                kills_in_a_row_25: true,
                kills_in_a_row_30: true,
                sniper_kill_5: true,
                sniper_kill_10: true,
                shotgun_kill_5: true,
                shotgun_kill_10: true,
                collision_kill_5: true,
                collision_kill_10: true,
                sword_kill_5: true,
                sword_kill_10: true,
                juggernaut_kill_5: true,
                juggernaut_kill_10: true,
                zombie_kill_5: true,
                zombie_kill_10: true,
                human_kill_5: true,
                human_kill_10: true,
                human_kill_15: true,
                koth_kill_5: true,
                shotgun_kill_sword: true,
                vehicle_impact_kill: true,
                vehicle_hijack: true,
                aircraft_hijack: true,
                deadplayer_kill: true,
                player_kill_spreeplayer: true,
                spartanlaser_kill: true,
                stickygrenade_kill: true,
                sniper_kill: true,
                bashbehind_kill: true,
                bash_kill: true,
                flame_kill: true,
                driver_assist_gunner: true,
                assault_bomb_planted: true,
                assault_player_kill_carrier: true,
                vip_player_kill_vip: true,
                juggernaut_player_kill_juggernaut: true,
                oddball_carrier_kill_player: true,
                ctf_flag_captured: true,
                ctf_flag_player_kill_carrier: true,
                ctf_flag_carrier_kill_player: true,
                infection_survive: true,
                nemesis: true,
                avenger: true,
                unused3: true,
            },
            where: {
                carnage_report_player: {
                    player_xuid: playerXuid,
                    carnage_report: {
                        carnage_report_matchmaking_options: {
                            isNot: null,
                        }
                    }
                }
            },
        })

        const medalChest = Object.entries(medalChestQueryData._sum).map(([medal, count]) => ({
            medal,
            count: count ?? 0
        })).filter(m => m.count > 0);


        // Detect Steaktacular and Linktacular medals
        let steaktacularCount = 0;
        let linktacularCount = 0;

        const linktacularGames = await this.prisma.$queryRaw<{ count: bigint }[]>`
            select count(id) as count from ares.carnage_report cr 
            left join
                ares.carnage_report_player crp 
            on crp.carnage_report_id = cr.id
            where crp.player_xuid = ${playerXuid}::bigint
            AND NOT EXISTS (
                SELECT 1
                FROM ares.carnage_report_player p
                WHERE p.carnage_report_id = cr.id
                AND (p.bungienet_user_flags::bigint & 1) <> 1
            )
            and exists (
                select 1
                from ares.carnage_report_matchmaking_options crmo 
                where crmo.id = cr.id
            );
        `;

        linktacularCount = Number(linktacularGames[0]?.count || 0);

        const ffaSteaktacularGames = await this.prisma.$queryRaw<{ count: bigint }[]>`
            select count(cr.id) as count from ares.carnage_report cr 
            left join
                ares.carnage_report_player crp 
            on crp.carnage_report_id = cr.id
            left join
                ares.carnage_report_player_statistics crps 
            on crps.carnage_report_id = cr.id
            left join
                ares.carnage_report_game_variant crgv 
            on crgv.id = cr.id
            and crps.player_index = crp.player_index
            where crp.player_xuid = ${playerXuid}::bigint
            and crgv.game_engine = 2
            and cr.team_game = false
            and crps.kills > (
                select max(kills) from ares.carnage_report_player_statistics crps2 
                where crps2.carnage_report_id = cr.id and crps2.player_index <> crp.player_index
            ) + 20
            and exists (
                select 1
                from ares.carnage_report_matchmaking_options crmo 
                where crmo.id = cr.id
            );
        `;

        const teamSteaktacularGames = await this.prisma.$queryRaw<{ count: bigint }[]>`
            select count(cr.id) as count from ares.carnage_report cr 
            left join
                ares.carnage_report_player crp 
            on crp.carnage_report_id = cr.id
            left join
                ares.carnage_report_team crt
            on crt.carnage_report_id = cr.id
            and crt.team_index = crp.player_team
            left join
                ares.carnage_report_game_variant crgv 
            on crgv.id = cr.id
            where crp.player_xuid = ${playerXuid}::bigint
            and crgv.game_engine = 2
            and cr.team_game = true
            and crt.score > (
                select max(score) from ares.carnage_report_team crt2 
                where crt2.carnage_report_id = cr.id and crt2.team_index <> crp.player_team
            ) + 20
            and exists (
                select 1
                from ares.carnage_report_matchmaking_options crmo 
                where crmo.id = cr.id
            );
        `;

        steaktacularCount = Number(ffaSteaktacularGames[0]?.count || 0) + Number(teamSteaktacularGames[0]?.count || 0);

        return {
            gameTypes: Object.entries(gameTypeCounts)
                .filter(([_, count]) => count > 0)
                .map(([name, value]) => ({ name, value })),
            killsDeaths: [
                { name: "Kills", value: totalKills ?? 0 },
                { name: "Deaths", value: totalDeaths ?? 0 },
            ],
            mostKilled,
            mostKilledBy,
            medalChest,
            weaponKills,
            weaponOfChoice,
            steaktacularCount,
            linktacularCount,
        };
    }

    @Get('/players/by-gamertag/:gamertag/activity-heatmap')
    @ApiParam({ name: 'gamertag' })
    @ApiOperation({
        summary: 'Get Player Activity Heatmap',
        description: 'Returns daily game counts for the last year for a GitHub-style heatmap visualization.',
    })
    async getPlayerActivityHeatmap(
        @Param('gamertag') gamertag: string,
    ) {
        const decodedGamertag = decodeURIComponent(gamertag);
        const escapedGamertag = decodedGamertag.replace(/'/g, "''");

        // Get games from the last year
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

        // Query to get daily game counts
        const dailyCountsQuery = `
            SELECT 
                DATE(finish_time) as date,
                COUNT(*)::int as count
            FROM (
                SELECT finish_time
                FROM "ares"."carnage_report" cr
                WHERE EXISTS (
                    SELECT 1 FROM "ares"."carnage_report_player" crp
                    WHERE crp.carnage_report_id = cr.id
                    AND crp.player_name = '${escapedGamertag}'
                )
                AND cr.finished = true
                AND cr.finish_time >= '${oneYearAgoStr}'
                UNION ALL
                SELECT finish_time
                FROM "ares"."campaign_carnage_report" ccr
                WHERE EXISTS (
                    SELECT 1 FROM "ares"."campaign_carnage_report_player" ccrp
                    WHERE ccrp.carnage_report_id = ccr.id
                    AND ccrp.player_name = '${escapedGamertag}'
                )
                AND ccr.finish_time >= '${oneYearAgoStr}'
            ) combined
            GROUP BY DATE(finish_time)
            ORDER BY date ASC
        `;

        const dailyCounts = await this.prisma.$queryRawUnsafe<Array<{ 
            date: Date; 
            count: number;
        }>>(dailyCountsQuery);

        // Convert to map for easy lookup
        const heatmapData: Record<string, number> = {};
        dailyCounts.forEach(entry => {
            const dateStr = entry.date.toISOString().split('T')[0];
            heatmapData[dateStr] = entry.count;
        });

        return {
            data: heatmapData,
        };
    }
}