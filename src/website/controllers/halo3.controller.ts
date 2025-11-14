import { BadRequestException, Body, Controller, Delete, Get, Header, Headers, Inject, NotFoundException, Param, ParseBoolPipe, ParseIntPipe, Post, Query, Res, StreamableFile, UnauthorizedException } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { EXAMPLE_XUID } from "src/constants";
import { AchievementsService } from "../services/achievements.service";
import { parseXuid } from "src/xbox/xuid";
import { PrismaService } from "src/db/prisma.service";
import { Halo3EmblemsService } from "../services/halo3emblems.service";
import { Halo3FileShareService } from "../services/halo3fileshare.service";
import { TitleID } from "src/xbox/titles";
import { HALO3_UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA, HALO3_UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA, HALO3_MAX_ACTIVE_TRANSFERS } from "src/constants";
import { Halo3PopulationService } from "../services/halo3population.service";

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
        private readonly populationService: Halo3PopulationService,
    ) { }

    @Get('/players/by-gamertag/:gamertag/carnage-reports')
    @ApiParam({ name: 'gamertag' })
    async listPlayerCarnageReportsByGamertag(
        @Param('gamertag') gamertag: string,
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 25,
    ) {
        const decodedGamertag = decodeURIComponent(gamertag);
        const skip = (page - 1) * pageSize;
        
        // Use UNION query to get IDs and types, sorted by finish_time
        // Escape single quotes in gamertag for SQL safety
        const escapedGamertag = decodedGamertag.replace(/'/g, "''");
        const unionQuery = `
            SELECT id, finish_time, 'multiplayer'::text as type
            FROM "halo3"."carnage_report" cr
            WHERE EXISTS (
                SELECT 1 FROM "halo3"."carnage_report_player" crp
                WHERE crp.carnage_report_id = cr.id
                AND crp.player_name = '${escapedGamertag}'
            )
            UNION ALL
            SELECT id, finish_time, 'campaign'::text as type
            FROM "halo3"."campaign_carnage_report" ccr
            WHERE EXISTS (
                SELECT 1 FROM "halo3"."campaign_carnage_report_player" ccrp
                WHERE ccrp.carnage_report_id = ccr.id
                AND ccrp.player_name = '${escapedGamertag}'
            )
            ORDER BY finish_time DESC
            LIMIT ${pageSize} OFFSET ${skip}
        `;
        
        const unionResults = await this.prisma.$queryRawUnsafe<Array<{ id: string; finish_time: Date; type: string }>>(unionQuery);
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*)::bigint as total
            FROM (
                SELECT id FROM "halo3"."carnage_report" cr
                WHERE EXISTS (
                    SELECT 1 FROM "halo3"."carnage_report_player" crp
                    WHERE crp.carnage_report_id = cr.id
                    AND crp.player_name = '${escapedGamertag}'
                )
                UNION ALL
                SELECT id FROM "halo3"."campaign_carnage_report" ccr
                WHERE EXISTS (
                    SELECT 1 FROM "halo3"."campaign_carnage_report_player" ccrp
                    WHERE ccrp.carnage_report_id = ccr.id
                    AND ccrp.player_name = '${escapedGamertag}'
                )
            ) combined
        `;
        const countResult = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(countQuery);
        const total = Number(countResult[0]?.total || 0);
        
        // Separate IDs by type
        const multiplayerIds = unionResults.filter(r => r.type === 'multiplayer').map(r => r.id);
        const campaignIds = unionResults.filter(r => r.type === 'campaign').map(r => r.id);
        
        // Fetch full details using Prisma
        type MultiplayerReportSelect = {
            id: string;
            map_id: number;
            game_id: any;
            start_time: Date;
            finish_time: Date;
            team_game: boolean;
            map_variant_name: string;
            game_variant_unique_id: any;
            carnage_report_game_variant: {
                name: string;
            } | null;
            carnage_report_matchmaking_options: {
                hopper_name: string | null;
                hopper_identifier: number | null;
            } | null;
        };
        
        type CampaignReportSelect = {
            id: string;
            map_id: number;
            game_id: any;
            start_time: Date;
            finish_time: Date;
            campaign_difficulty: number;
            campaign_id: number;
        };
        
        const [multiplayerReports, campaignReports] = await Promise.all([
            multiplayerIds.length > 0 ? this.prisma.halo3_carnage_report.findMany({
                where: { id: { in: multiplayerIds } },
                select: {
                    id: true,
                    map_id: true,
                    game_id: true,
                    start_time: true,
                    finish_time: true,
                    team_game: true,
                    map_variant_name: true,
                    game_variant_unique_id: true,
                    carnage_report_game_variant: {
                        select: {
                            name: true,
                        }
                    },
                    carnage_report_matchmaking_options: {
                        select: {
                            hopper_name: true,
                            hopper_identifier: true,
                        }
                    }
                }
            }) : [] as MultiplayerReportSelect[],
            campaignIds.length > 0 ? this.prisma.halo3_campaign_carnage_report.findMany({
                where: { id: { in: campaignIds } },
                select: {
                    id: true,
                    map_id: true,
                    game_id: true,
                    start_time: true,
                    finish_time: true,
                    campaign_difficulty: true,
                    campaign_id: true,
                }
            }) : [] as CampaignReportSelect[]
        ]);
        
        // Create a map for quick lookup
        const multiplayerMap = new Map<string, MultiplayerReportSelect>();
        multiplayerReports.forEach(r => multiplayerMap.set(r.id, r));
        const campaignMap = new Map<string, CampaignReportSelect>();
        campaignReports.forEach(r => campaignMap.set(r.id, r));
        
        // Build response in the order from UNION query
        const paginatedReports = unionResults.map(unionResult => {
            if (unionResult.type === 'multiplayer') {
                const r = multiplayerMap.get(unionResult.id);
                if (!r) return null;
                return {
                    id: r.id,
                    type: 'multiplayer' as const,
                    map_id: r.map_id,
                    game_id: r.game_id.toString(),
                    start_time: r.start_time,
                    finish_time: r.finish_time,
                    team_game: r.team_game,
                    map_variant_name: r.map_variant_name,
                    game_variant_unique_id: r.game_variant_unique_id.toString(),
                    game_variant_name: r.carnage_report_game_variant?.name ?? null,
                    hopper_name: r.carnage_report_matchmaking_options?.hopper_name ?? null,
                    hopper_identifier: r.carnage_report_matchmaking_options?.hopper_identifier ?? null,
                };
            } else {
                const r = campaignMap.get(unionResult.id);
                if (!r) return null;
                return {
                    id: r.id,
                    type: 'campaign' as const,
                    map_id: r.map_id,
                    game_id: r.game_id.toString(),
                    start_time: r.start_time,
                    finish_time: r.finish_time,
                    team_game: false,
                    map_variant_name: null,
                    game_variant_unique_id: null,
                    hopper_name: null,
                    hopper_identifier: null,
                    campaign_difficulty: r.campaign_difficulty,
                    campaign_id: r.campaign_id,
                };
            }
        }).filter((r): r is NonNullable<typeof r> => r !== null);

        return {
            data: paginatedReports,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    @Get('/players/:xuid/servicerecord')
    @ApiParam({ name: 'xuid' })
    async getServiceRecordByXuid(
        @Param('xuid') xuid: string,
    ) {
        const sr = await this.prisma.halo3_service_record.findUnique({
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
        const sr = await this.prisma.halo3_service_record.findFirst({
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
    @Get('/players/:xuid/screenshots')
    @ApiParam({ name: 'xuid' })
    async listPlayerScreenshotsByXuid(
        @Param('xuid') xuid: string,
    ) {
        const screenshots = await this.prisma.halo3_blind_screenshot.findMany({
            where: {
                author_id: xuid as any,
            },
            orderBy: {
                date: 'desc',
            },
            take: 48,
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            }
        });
        return screenshots.map(sc => ({
            id: sc.id,
            header: {
                filename: sc.name,
                description: sc.description,
            },
            author: sc.author,
            date: sc.date,
        }));
    }

    @Get('/fileshare/:shareId/:slotId/view')
    @ApiOperation({
        summary: 'View Fileshare Screenshot',
        description: 'Returns a JPEG screenshot from fileshare by share ID and slot number.'
    })
    @Header('Content-Type', 'image/jpeg')
    @ApiParam({ name: 'shareId' })
    @ApiParam({ name: 'slotId' })
    async viewFileshareScreenshot(
        @Param('shareId') shareId: string,
        @Param('slotId') slotId: string,
    ) {
        const slotNumber = parseInt(slotId, 10);
        return new StreamableFile(
            Uint8Array.from(await this.fileshareService.viewFileshareScreenshot(shareId, slotNumber)),
            { disposition: "filename=screenshot.jpg" }
        );
    }


    @Get('/players/by-gamertag/:gamertag/screenshots')
    @ApiParam({ name: 'gamertag' })
    async listPlayerScreenshotsByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const screenshots = await this.prisma.halo3_blind_screenshot.findMany({
            where: {
                author: gamertag,
            },
            orderBy: {
                date: 'desc',
            },
            take: 48,
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            }
        });
        return screenshots.map(sc => ({
            id: sc.id,
            header: {
                filename: sc.name,
                description: sc.description,
            },
            author: sc.author,
            date: sc.date,
        }));
    }

    @Get('/players/by-gamertag/:gamertag/fileshare')
    @ApiParam({ name: 'gamertag' })
    async listPlayerFileShareByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const sr = await this.prisma.halo3_service_record.findFirst({
            where: { player_name: gamertag },
            select: { player_xuid: true },
        });
        if (!sr?.player_xuid) {
            return {
                id: '',
                ownerId: '',
                visibleSlots: 0,
                quotaBytes: HALO3_UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA,
                quotaSlots: HALO3_UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA,
                subscriptionHash: 0,
                slots: [],
            };
        }
        
        const shareId = String(sr.player_xuid);
        const share = await this.prisma.halo3_file_share.findUnique({
            where: { share_id: shareId },
            select: {
                share_id: true,
                quota_slots: true,
                quota_bytes: true,
                lastHash: true,
            },
        });

        const files = await this.prisma.halo3_file_share_file.findMany({
            where: { share_id: shareId, is_uploaded: true },
            orderBy: { slot: 'asc' },
            select: {
                id: true,
                slot: true,
                unique_id: true,
                name: true,
                description: true,
                author: true,
                file_type: true,
                author_is_xuid_online: true,
                author_id: true,
                size_in_bytes: true,
                date: true,
                length_seconds: true,
                campaign_id: true,
                map_id: true,
                game_engine_type: true,
                campaign_difficulty: true,
                hopper_id: true,
                game_id: true,
                campaign_insertion_point: true,
            }
        });

        return {
            id: String(share?.share_id ?? shareId),
            ownerId: String(share?.share_id ?? shareId),
            visibleSlots: files.length,
            quotaBytes: share?.quota_bytes ?? HALO3_UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA,
            quotaSlots: share?.quota_slots ?? HALO3_UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA,
            subscriptionHash: share?.lastHash ?? 0,
            slots: files.map(f => ({
                id: f.id,
                uniqueId: String(f.unique_id ?? ''),
                slotNumber: f.slot,
                header: {
                    buildNumber: 0,
                    mapVersion: 0,
                    uniqueId: String(f.unique_id ?? ''),
                    filename: f.name ?? '',
                    description: f.description ?? '',
                    author: f.author ?? '',
                    filetype: f.file_type,
                    authorXuidIsOnline: !!f.author_is_xuid_online,
                    authorXuid: f.author_id ? String(f.author_id) : '',
                    size: Number(f.size_in_bytes ?? 0),
                    date: f.date?.toISOString() ?? '',
                    lengthSeconds: f.length_seconds ?? 0,
                    campaignId: f.campaign_id ?? 0,
                    mapId: f.map_id ?? 0,
                    gameEngineType: f.game_engine_type ?? 0,
                    campaignDifficulty: f.campaign_difficulty ?? 0,
                    hopperId: f.hopper_id ?? 0,
                    gameId: f.game_id ? Number(f.game_id) : 0,
                    campaignInsertionPoint: f.campaign_insertion_point ?? 0,
                    campaignSurvivalEnabled: false,
                }
            })),
        };
    }
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
        const playerXuid = parseXuid(xuid);

        const halo3Achieevements = await this.achievementsService.getAchievements(
            authorization,
            playerXuid,
            TitleID.HALO3,
            true,
            79
        )

        
        const halo3ODSTAchieevements = await this.achievementsService.getAchievements(
            authorization,
            playerXuid,
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

        await this.prisma.halo3_player_data.upsert({
            where: {
                player_xuid: playerXuid.toString()
            },
            create: {
                player_xuid: playerXuid.toString(),
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
        const carnageReport = await this.prisma.halo3_carnage_report.findUnique({
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

        const playerInterractions = await this.prisma.halo3_carnage_report_player_interaction.findMany({
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

    @Get('/campaign-carnage-reports/:id')
    @ApiOperation({
        summary: 'Get Campaign Carnage Report',
        description: 'Returns detailed information about a campaign carnage report including player statistics.',
    })
    @ApiParam({ name: 'id' })
    async getCampaignCarnageReport(
        @Param('id') id: string,
    ) {
        const carnageReport = await this.prisma.halo3_campaign_carnage_report.findUnique({
            where: {
                id,
            },
            include: {
                players: {
                    include: {
                        kills: true,
                    },
                    orderBy: {
                        player_final_score: 'desc',
                    }
                }
            }
        })

        if (!carnageReport) {
            throw new NotFoundException();
        }

        return {
            id: carnageReport.id,
            game_id: carnageReport.game_id.toString(),
            map_id: carnageReport.map_id,
            scenario_path: carnageReport.scenario_path,
            start_time: carnageReport.start_time,
            finish_time: carnageReport.finish_time,
            campaign_id: carnageReport.campaign_id,
            campaign_difficulty: carnageReport.campaign_difficulty,
            campaign_insertion_point: carnageReport.campaign_insertion_point,
            campaign_metagame_scoring: carnageReport.campaign_metagame_scoring,
            campaign_metagame_enabled: carnageReport.campaign_metagame_enabled,
            campaign_active_primary_skulls: carnageReport.campaign_active_primary_skulls,
            campaign_active_secondary_skulls: carnageReport.campaign_active_secondary_skulls,
            time_bonus: carnageReport.time_bonus,
            final_total_score: carnageReport.final_total_score,
            players: carnageReport.players.map(player => ({
                player_name: player.player_name,
                player_xuid: player.player_xuid.toString(),
                player_identifier: player.player_identifier.toString(),
                service_tag: player.service_tag,
                primary_color: player.primary_color,
                secondary_color: player.secondary_color,
                tertiary_color: player.tertiary_color,
                player_model_choice: player.player_model_choice,
                foreground_emblem: player.foreground_emblem,
                background_emblem: player.background_emblem,
                emblem_flags: player.emblem_flags,
                emblem_primary_color: player.emblem_primary_color,
                emblem_secondary_color: player.emblem_secondary_color,
                emblem_background_color: player.emblem_background_color,
                campaign_difficulty_completed: player.campaign_difficulty_completed,
                player_final_score: player.player_final_score,
                kills: player.kills,
                kills_total: player.kill_total_count,
                grenade_sticky_kills: player.grenade_sticky_kills,
                headshot_kills: player.headshot_kills,
                assassination_kills: player.assassination_kills,
                splatter_kills: player.splatter_kills,
                multi_kills: player.multi_kills,
                needler_supercombine_kills: player.needler_supercombine_kills,
                emp_kills: player.emp_kills,
                ai_betrayal_count: player.ai_betrayal_count,
                infantry_kills: player.infantry_kills,
                leader_kills: player.leader_kills,
                hero_kills: player.hero_kills,
                specialist_kills: player.specialist_kills,
                light_vehicle_kills: player.light_vehicle_kills,
                heavy_vehicle_kills: player.heavy_vehicle_kills,
                giant_vehicle_kills: player.giant_vehicle_kills,
                standard_vehicle_kills: player.standard_vehicle_kills,
                style_total_count: player.style_total_count,
                transient_subtotal: player.transient_subtotal,
                subtotal: player.subtotal,
                medal_points: player.medal_points,
                scripted_points: player.scripted_points,
            }))
        }
    }

    @Get('/carnage-reports/:id/related-files')
    @ApiParam({ name: 'id' })
    async getRelatedFiles(
        @Param('id') id: string,
    ) {
        const carnageReport = await this.prisma.halo3_carnage_report.findUnique({
            where: { id },
            select: { game_id: true },
        });

        if (!carnageReport) {
            throw new NotFoundException('Carnage report not found');
        }

        const gameId = carnageReport.game_id;

        // Get fileshare files with matching game_id
        const fileshareFiles = await this.prisma.halo3_file_share_file.findMany({
            where: {
                game_id: gameId,
                is_uploaded: true,
            },
            orderBy: { date: 'desc' },
            take: 20,
            select: {
                id: true,
                share_id: true,
                slot: true,
                unique_id: true,
                name: true,
                description: true,
                author: true,
                file_type: true,
                author_is_xuid_online: true,
                author_id: true,
                size_in_bytes: true,
                date: true,
                length_seconds: true,
                campaign_id: true,
                map_id: true,
                game_engine_type: true,
                campaign_difficulty: true,
                hopper_id: true,
                game_id: true,
                campaign_insertion_point: true,
            }
        });

        // Get screenshots with matching game_id
        const screenshots = await this.prisma.halo3_blind_screenshot.findMany({
            where: {
                game_id: gameId,
            },
            orderBy: { date: 'desc' },
            take: 20,
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            }
        });

        return {
            fileshare: fileshareFiles.map(f => ({
                id: f.id,
                uniqueId: String(f.unique_id ?? ''),
                slotNumber: f.slot,
                shareId: String(f.share_id),
                header: {
                    buildNumber: 0,
                    mapVersion: 0,
                    uniqueId: String(f.unique_id ?? ''),
                    filename: f.name ?? '',
                    description: f.description ?? '',
                    author: f.author ?? '',
                    filetype: f.file_type,
                    authorXuidIsOnline: !!f.author_is_xuid_online,
                    authorXuid: f.author_id ? String(f.author_id) : '',
                    size: Number(f.size_in_bytes ?? 0),
                    date: f.date?.toISOString() ?? '',
                    lengthSeconds: f.length_seconds ?? 0,
                    campaignId: f.campaign_id ?? 0,
                    mapId: f.map_id ?? 0,
                    gameEngineType: f.game_engine_type ?? 0,
                    campaignDifficulty: f.campaign_difficulty ?? 0,
                    hopperId: f.hopper_id ?? 0,
                    gameId: f.game_id ? Number(f.game_id) : 0,
                    campaignInsertionPoint: f.campaign_insertion_point ?? 0,
                    campaignSurvivalEnabled: false,
                }
            })),
            screenshots: screenshots.map(sc => ({
                id: sc.id,
                header: {
                    filename: sc.name,
                    description: sc.description,
                },
                author: sc.author,
                date: sc.date,
            })),
        };
    }

    @Post('/fileshare/transfer')
    @ApiOperation({
        summary: 'Create Fileshare Transfer',
        description: 'Creates a fileshare transfer for the logged-in user to download a file.',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID})
    async createFileshareTransfer(
        @Headers('x-xuid') xuid: string,
        @Body() body: { fileId: string },
    ) {
        const fileId = body.fileId;
        const playerXuid = parseXuid(xuid).toString();

        // Check if file exists and is uploaded
        const file = await this.prisma.halo3_file_share_file.findUnique({
            where: { id: fileId },
        });

        if (!file) {
            throw new NotFoundException('File not found');
        }

        if (!file.is_uploaded) {
            throw new BadRequestException('File is not yet uploaded');
        }

        // Check if transfer already exists
        const existingTransfer = await this.prisma.halo3_file_share_transfer.findUnique({
            where: {
                player_xuid_file_id: {
                    player_xuid: playerXuid,
                    file_id: fileId,
                }
            },
        });

        // If transfer already exists, return success (idempotent)
        if (existingTransfer) {
            return { success: true };
        }

        // Check transfer limit (8 active transfers max)
        const transferCount = await this.prisma.halo3_file_share_transfer.count({
            where: {
                player_xuid: playerXuid,
            },
        });

        if (transferCount >= HALO3_MAX_ACTIVE_TRANSFERS) {
            throw new BadRequestException(`You have reached the maximum of ${HALO3_MAX_ACTIVE_TRANSFERS} active transfers. Please complete your transfers by launching Halo 3 on your Xbox 360, or cancel existing transfers before adding new ones.`);
        }

        // Create transfer
        await this.prisma.halo3_file_share_transfer.create({
            data: {
                player_xuid: playerXuid,
                file_id: fileId,
                is_odst: false, // Default to Halo 3, could be determined from file metadata if needed
            },
        });

        this.logger.log(`[FileShare] Transfer created for user ${playerXuid} to file ${fileId}`);
        return { success: true };
    }

    @Get('/fileshare/transfers')
    @ApiOperation({
        summary: 'Get Pending Fileshare Transfers',
        description: 'Returns a list of pending fileshare transfers for the logged-in user.',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID})
    async getPendingTransfers(
        @Headers('x-xuid') xuid: string,
    ) {
        const playerXuid = parseXuid(xuid).toString();

        const transfers = await this.prisma.halo3_file_share_transfer.findMany({
            where: {
                player_xuid: playerXuid,
            },
            include: {
                file: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        author: true,
                        file_type: true,
                        date: true,
                        share_id: true,
                        slot: true,
                        game_engine_type: true,
                    }
                }
            },
            orderBy: [
                {
                    file: {
                        date: 'desc'
                    }
                }
            ]
        });

        return {
            transfers: transfers.map(t => ({
                fileId: t.file_id,
                fileName: t.file.name,
                fileDescription: t.file.description,
                fileAuthor: t.file.author,
                fileType: t.file.file_type,
                fileDate: t.file.date,
                shareId: t.file.share_id.toString(),
                slot: t.file.slot,
                gameEngineType: t.file.game_engine_type ?? null,
            })),
            maxTransfers: HALO3_MAX_ACTIVE_TRANSFERS,
        };
    }

    @Delete('/fileshare/transfers/:fileId')
    @ApiOperation({
        summary: 'Delete Fileshare Transfer',
        description: 'Deletes a pending fileshare transfer for the logged-in user.',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID})
    @ApiParam({ name: 'fileId' })
    async deleteTransfer(
        @Headers('x-xuid') xuid: string,
        @Param('fileId') fileId: string,
    ) {
        const playerXuid = parseXuid(xuid).toString();

        await this.prisma.halo3_file_share_transfer.delete({
            where: {
                player_xuid_file_id: {
                    player_xuid: playerXuid,
                    file_id: fileId,
                }
            }
        });

        this.logger.log(`[FileShare] Transfer deleted for user ${playerXuid} for file ${fileId}`);
        return { success: true };
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

    @Get('/games')
    @ApiOperation({
        summary: 'List Games',
        description: 'Returns paginated games across all users, optionally filtered by gamertag. Includes both multiplayer and campaign reports.',
    })
    async listGames(
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 48,
        @Query('gamertag') gamertag?: string,
    ) {
        const skip = (page - 1) * pageSize;
        
        // Use UNION query to get IDs and types, sorted by finish_time
        // If gamertag is provided, filter by it; otherwise get all games
        let unionQuery: string;
        let countQuery: string;
        
        if (gamertag) {
            const escapedGamertag = gamertag.replace(/'/g, "''");
            unionQuery = `
                SELECT id, finish_time, 'multiplayer'::text as type
                FROM "halo3"."carnage_report" cr
                WHERE EXISTS (
                    SELECT 1 FROM "halo3"."carnage_report_player" crp
                    WHERE crp.carnage_report_id = cr.id
                    AND crp.player_name = '${escapedGamertag}'
                )
                UNION ALL
                SELECT id, finish_time, 'campaign'::text as type
                FROM "halo3"."campaign_carnage_report" ccr
                WHERE EXISTS (
                    SELECT 1 FROM "halo3"."campaign_carnage_report_player" ccrp
                    WHERE ccrp.carnage_report_id = ccr.id
                    AND ccrp.player_name = '${escapedGamertag}'
                )
                ORDER BY finish_time DESC
                LIMIT ${pageSize} OFFSET ${skip}
            `;
            
            countQuery = `
                SELECT COUNT(*)::bigint as total
                FROM (
                    SELECT id FROM "halo3"."carnage_report" cr
                    WHERE EXISTS (
                        SELECT 1 FROM "halo3"."carnage_report_player" crp
                        WHERE crp.carnage_report_id = cr.id
                        AND crp.player_name = '${escapedGamertag}'
                    )
                    UNION ALL
                    SELECT id FROM "halo3"."campaign_carnage_report" ccr
                    WHERE EXISTS (
                        SELECT 1 FROM "halo3"."campaign_carnage_report_player" ccrp
                        WHERE ccrp.carnage_report_id = ccr.id
                        AND ccrp.player_name = '${escapedGamertag}'
                    )
                ) combined
            `;
        } else {
            unionQuery = `
                SELECT id, finish_time, 'multiplayer'::text as type
                FROM "halo3"."carnage_report"
                UNION ALL
                SELECT id, finish_time, 'campaign'::text as type
                FROM "halo3"."campaign_carnage_report"
                ORDER BY finish_time DESC
                LIMIT ${pageSize} OFFSET ${skip}
            `;
            
            countQuery = `
                SELECT COUNT(*)::bigint as total
                FROM (
                    SELECT id FROM "halo3"."carnage_report"
                    UNION ALL
                    SELECT id FROM "halo3"."campaign_carnage_report"
                ) combined
            `;
        }
        
        const unionResults = await this.prisma.$queryRawUnsafe<Array<{ id: string; finish_time: Date; type: string }>>(unionQuery);
        
        // Get total count
        const countResult = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(countQuery);
        const total = Number(countResult[0]?.total || 0);
        
        // Debug logging
        const campaignInResults = unionResults.filter(r => r.type === 'campaign').length;
        const multiplayerInResults = unionResults.filter(r => r.type === 'multiplayer').length;
        this.logger.log(`[listGames] Query returned ${unionResults.length} results: ${campaignInResults} campaign, ${multiplayerInResults} multiplayer`);
        
        // Separate IDs by type
        const multiplayerIds = unionResults.filter(r => r.type === 'multiplayer').map(r => r.id);
        const campaignIds = unionResults.filter(r => r.type === 'campaign').map(r => r.id);
        
        // Fetch full details using Prisma
        type MultiplayerReportSelect = {
            id: string;
            map_id: number;
            game_id: any;
            start_time: Date;
            finish_time: Date;
            team_game: boolean;
            map_variant_name: string;
            game_variant_unique_id: any;
            carnage_report_game_variant: {
                name: string;
                game_engine: number | null;
            } | null;
            carnage_report_matchmaking_options: {
                hopper_name: string | null;
                hopper_identifier: number | null;
            } | null;
            carnage_report_player: Array<{ player_name: string }>;
        };
        
        type CampaignReportSelect = {
            id: string;
            map_id: number;
            game_id: any;
            start_time: Date;
            finish_time: Date;
            campaign_difficulty: number;
            players?: Array<{ player_name: string }>;
        };
        
        const [multiplayerReports, campaignReports] = await Promise.all([
            multiplayerIds.length > 0 ? this.prisma.halo3_carnage_report.findMany({
                where: { id: { in: multiplayerIds } },
                select: {
                    id: true,
                    map_id: true,
                    game_id: true,
                    start_time: true,
                    finish_time: true,
                    team_game: true,
                    map_variant_name: true,
                    game_variant_unique_id: true,
                    carnage_report_game_variant: {
                        select: {
                            name: true,
                            game_engine: true,
                        }
                    },
                    carnage_report_matchmaking_options: {
                        select: {
                            hopper_name: true,
                            hopper_identifier: true,
                        }
                    },
                    carnage_report_player: {
                        select: {
                            player_name: true,
                        },
                        take: 1,
                    }
                }
            }) : [] as MultiplayerReportSelect[],
            campaignIds.length > 0 ? this.prisma.halo3_campaign_carnage_report.findMany({
                where: { id: { in: campaignIds } },
                select: {
                    id: true,
                    map_id: true,
                    game_id: true,
                    start_time: true,
                    finish_time: true,
                    campaign_difficulty: true,
                    players: {
                        select: {
                            player_name: true,
                        },
                        take: 1,
                    }
                }
            }) : [] as CampaignReportSelect[]
        ]);
        
        // Create a map for quick lookup
        const multiplayerMap = new Map<string, MultiplayerReportSelect>();
        multiplayerReports.forEach(r => multiplayerMap.set(r.id, r));
        const campaignMap = new Map<string, CampaignReportSelect>();
        campaignReports.forEach(r => campaignMap.set(r.id, r));
        
        // Build response in the order from UNION query
        const combinedReports = unionResults.map(unionResult => {
            if (unionResult.type === 'multiplayer') {
                const r = multiplayerMap.get(unionResult.id);
                if (!r) return null;
                return {
                    id: r.id,
                    map_id: r.map_id,
                    game_id: r.game_id.toString(),
                    start_time: r.start_time,
                    finish_time: r.finish_time,
                    team_game: r.team_game,
                    map_variant_name: r.map_variant_name,
                    game_variant_unique_id: r.game_variant_unique_id.toString(),
                    game_variant_name: r.carnage_report_game_variant?.name ?? null,
                    game_engine: r.carnage_report_game_variant?.game_engine ?? null,
                    hopper_name: r.carnage_report_matchmaking_options?.hopper_name ?? null,
                    hopper_identifier: r.carnage_report_matchmaking_options?.hopper_identifier ?? null,
                    player_name: r.carnage_report_player[0]?.player_name ?? null,
                    type: 'multiplayer' as const,
                };
            } else {
                const r = campaignMap.get(unionResult.id);
                if (!r) return null;
                return {
                    id: r.id,
                    map_id: r.map_id,
                    game_id: r.game_id.toString(),
                    start_time: r.start_time,
                    finish_time: r.finish_time,
                    team_game: false,
                    map_variant_name: null,
                    game_variant_unique_id: null,
                    game_variant_name: null,
                    game_engine: null,
                    hopper_name: null,
                    hopper_identifier: null,
                    player_name: r.players?.[0]?.player_name ?? null,
                    type: 'campaign' as const,
                    campaign_difficulty: r.campaign_difficulty,
                };
            }
        }).filter((r): r is NonNullable<typeof r> => r !== null);

        return {
            data: combinedReports,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }


    @Get('/screenshots')
    @ApiOperation({
        summary: 'List Screenshots',
        description: 'Returns paginated screenshots across all users, optionally filtered by gamertag.',
    })
    async listScreenshots(
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 48,
        @Query('gamertag') gamertag?: string,
    ) {
        const skip = (page - 1) * pageSize;
        
        const where = gamertag ? { author: gamertag } : {};
        
        const [screenshots, total] = await Promise.all([
            this.prisma.halo3_blind_screenshot.findMany({
                where,
                orderBy: {
                    date: 'desc',
                },
                skip,
                take: pageSize,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    author: true,
                    date: true,
                }
            }),
            this.prisma.halo3_blind_screenshot.count({ where }),
        ]);

        return {
            data: screenshots.map(sc => ({
                id: sc.id,
                header: {
                    filename: sc.name,
                    description: sc.description,
                },
                author: sc.author,
                date: sc.date,
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    @Get('/recent-screenshots')
    @ApiOperation({
        summary: 'Get Recent Screenshots',
        description: 'Returns the last 15 screenshots across all users.',
    })
    async getRecentScreenshots() {
        const screenshots = await this.prisma.halo3_blind_screenshot.findMany({
            orderBy: {
                date: 'desc',
            },
            take: 15,
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            }
        });
        return screenshots.map(sc => ({
            id: sc.id,
            header: {
                filename: sc.name,
                description: sc.description,
            },
            author: sc.author,
            date: sc.date,
        }));
    }

    @Get('/online-players')
    @ApiOperation({
        summary: 'Get Online Players Count',
        description: 'Returns the number of players who have played in the last 6 hours (matching the nightmap).',
    })
    async getOnlinePlayersCount() {
        const result = await this.prisma.$queryRaw<{ player_count: bigint }[]>`
            SELECT COUNT(DISTINCT crp.player_xuid)::bigint AS player_count
            FROM "halo3"."carnage_report_player" crp
            INNER JOIN "halo3"."carnage_report" cr ON cr.id = crp.carnage_report_id
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
            FROM "halo3"."carnage_report_player" crp
            INNER JOIN "halo3"."carnage_report" cr ON cr.id = crp.carnage_report_id
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
            this.prisma.halo3_service_record.findMany({
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
            this.prisma.halo3_service_record.count({ where }),
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
        const escapedGamertag = decodedGamertag.replace(/'/g, "''");

        // Get all multiplayer games for the player
        const multiplayerGamesWithPlayer = await this.prisma.halo3_carnage_report_player.findMany({
            where: {
                player_name: decodedGamertag,
            },
            select: {
                carnage_report_id: true,
            },
            distinct: ['carnage_report_id'],
        });

        // Get all campaign games for the player
        const campaignGamesWithPlayer = await this.prisma.halo3_campaign_carnage_report_player.findMany({
            where: {
                player_name: decodedGamertag,
            },
            select: {
                carnage_report_id: true,
            },
            distinct: ['carnage_report_id'],
        });

        const campaignIds = campaignGamesWithPlayer.map(p => p.carnage_report_id);

        // Get game type information for multiplayer games (only finished games)
        const multiplayerGames = multiplayerGamesWithPlayer.length > 0 ? await this.prisma.halo3_carnage_report.findMany({
            where: { 
                id: { in: multiplayerGamesWithPlayer.map(p => p.carnage_report_id) },
                finished: true,
            },
            select: {
                id: true,
                map_id: true,
                team_game: true,
                carnage_report_matchmaking_options: {
                    select: {
                        hopper_name: true,
                    }
                },
                carnage_report_game_variant: {
                    select: {
                        game_engine: true,
                    }
                }
            }
        }) : [];

        // Calculate game type breakdown
        const gameTypeCounts = {
            Campaign: campaignIds.length,
            Matchmaking: 0,
            "Custom Games": 0,
            Forge: 0,
        };

        multiplayerGames.forEach(game => {
            if (game.carnage_report_matchmaking_options?.hopper_name) {
                gameTypeCounts.Matchmaking++;
            } else {
                // Check if it's a Forge map (Forge canvas maps: 700 Foundry, 701 Sandbox)
                const isForgeMap = game.map_id === 700 || game.map_id === 701;
                const isForgeEngine = game.carnage_report_game_variant?.game_engine === 10;
                if (isForgeMap || isForgeEngine) {
                    gameTypeCounts.Forge++;
                } else {
                    gameTypeCounts["Custom Games"]++;
                }
            }
        });

        // Get multiplayer IDs from finished games
        const multiplayerIds = multiplayerGames.map(g => g.id);

        // Get player statistics for kills/deaths
        let totalKills = 0;
        let totalDeaths = 0;

        if (multiplayerIds.length > 0) {
            // Get player standings for all multiplayer games
            const playerStandings = await this.prisma.halo3_carnage_report_player.findMany({
                where: {
                    carnage_report_id: { in: multiplayerIds },
                    player_name: decodedGamertag,
                },
                select: {
                    carnage_report_id: true,
                    player_index: true,
                }
            });

            // Get player statistics for kills/deaths
            const playerStats = await this.prisma.halo3_carnage_report_player_statistics.findMany({
                where: {
                    OR: playerStandings.map(player => ({
                        carnage_report_id: player.carnage_report_id,
                        player_index: player.player_index,
                    })),
                },
                select: {
                    kills: true,
                    deaths: true,
                }
            });

            // Sum up kills and deaths
            playerStats.forEach(stats => {
                totalKills += stats.kills;
                totalDeaths += stats.deaths;
            });
        }

        // Get most killed and most killed by
        const mostKilled: Array<{ playerName: string; count: number }> = [];
        const mostKilledBy: Array<{ playerName: string; count: number }> = [];
        const weaponKills: Record<number, number> = {};

        if (multiplayerIds.length > 0) {
            // Get player indices for the target player
            const targetPlayerIndices = await this.prisma.halo3_carnage_report_player.findMany({
                where: {
                    carnage_report_id: { in: multiplayerIds },
                    player_name: decodedGamertag,
                },
                select: {
                    carnage_report_id: true,
                    player_index: true,
                }
            });

            // Create a map for quick lookup
            const playerIndexMap = new Map<string, number>();
            targetPlayerIndices.forEach(p => {
                playerIndexMap.set(p.carnage_report_id, p.player_index);
            });

            // Get all kill events for games where the player participated
            const killEvents = await this.prisma.halo3_carnage_report_event_kill.findMany({
                where: {
                    carnage_report_id: { in: multiplayerIds },
                },
                select: {
                    carnage_report_id: true,
                    killer_player_index: true,
                    dead_player_index: true,
                    kill_type: true,
                }
            });

            // Count kills by weapon
            killEvents.forEach(kill => {
                if (!kill.carnage_report_id) return;
                const targetPlayerIndex = playerIndexMap.get(kill.carnage_report_id);
                if (targetPlayerIndex === undefined) return;

                // If this player is the killer, count the weapon
                if (kill.killer_player_index === targetPlayerIndex) {
                    weaponKills[kill.kill_type] = (weaponKills[kill.kill_type] || 0) + 1;
                }
            });

            // Get most killed (victims)
            const victimCounts = new Map<string, number>();
            killEvents.forEach(kill => {
                if (!kill.carnage_report_id) return;
                const targetPlayerIndex = playerIndexMap.get(kill.carnage_report_id);
                if (targetPlayerIndex === undefined) return;

                // If this player is the killer, count the victim
                if (kill.killer_player_index === targetPlayerIndex) {
                    const victimKey = `${kill.carnage_report_id}:${kill.dead_player_index}`;
                    victimCounts.set(victimKey, (victimCounts.get(victimKey) || 0) + 1);
                }
            });

            // Get player names for victims
            const victimPlayerIndices = Array.from(victimCounts.keys()).map(key => {
                const [carnageReportId, playerIndex] = key.split(':');
                return { carnage_report_id: carnageReportId, player_index: parseInt(playerIndex) };
            });

            if (victimPlayerIndices.length > 0) {
                const victimPlayers = await this.prisma.halo3_carnage_report_player.findMany({
                    where: {
                        OR: victimPlayerIndices.map(v => ({
                            carnage_report_id: v.carnage_report_id,
                            player_index: v.player_index,
                        })),
                    },
                    select: {
                        player_name: true,
                        carnage_report_id: true,
                        player_index: true,
                    }
                });

                const victimNameCounts = new Map<string, number>();
                victimPlayers.forEach(victim => {
                    const key = `${victim.carnage_report_id}:${victim.player_index}`;
                    const count = victimCounts.get(key) || 0;
                    const existing = victimNameCounts.get(victim.player_name) || 0;
                    victimNameCounts.set(victim.player_name, existing + count);
                });

                // Get unique player names and fetch their service records for current appearance
                const uniqueVictimNames = Array.from(victimNameCounts.keys());
                const victimServiceRecords = uniqueVictimNames.length > 0 ? await this.prisma.halo3_service_record.findMany({
                    where: {
                        player_name: { in: uniqueVictimNames },
                    },
                    select: {
                        player_name: true,
                        primary_color: true,
                        foreground_emblem: true,
                        background_emblem: true,
                        emblem_flags: true,
                        emblem_primary_color: true,
                        emblem_secondary_color: true,
                        emblem_background_color: true,
                    }
                }) : [];

                // Create a map of player name to service record
                const victimAppearanceMap = new Map<string, any>();
                victimServiceRecords.forEach(sr => {
                    victimAppearanceMap.set(sr.player_name, {
                        primaryColor: sr.primary_color,
                        foregroundEmblem: sr.foreground_emblem,
                        backgroundEmblem: sr.background_emblem,
                        emblemFlags: sr.emblem_flags,
                        emblemPrimaryColor: sr.emblem_primary_color,
                        emblemSecondaryColor: sr.emblem_secondary_color,
                        emblemBackgroundColor: sr.emblem_background_color,
                    });
                });

                mostKilled.push(...Array.from(victimNameCounts.entries())
                    .map(([playerName, count]) => ({ 
                        playerName, 
                        count,
                        appearance: victimAppearanceMap.get(playerName)
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10));
            }

            // Get most killed by (killers)
            const killerCounts = new Map<string, number>();
            killEvents.forEach(kill => {
                if (!kill.carnage_report_id) return;
                const targetPlayerIndex = playerIndexMap.get(kill.carnage_report_id);
                if (targetPlayerIndex === undefined) return;

                // If this player is the victim, count the killer
                if (kill.dead_player_index === targetPlayerIndex) {
                    const killerKey = `${kill.carnage_report_id}:${kill.killer_player_index}`;
                    killerCounts.set(killerKey, (killerCounts.get(killerKey) || 0) + 1);
                }
            });

            // Get player names for killers
            const killerPlayerIndices = Array.from(killerCounts.keys()).map(key => {
                const [carnageReportId, playerIndex] = key.split(':');
                return { carnage_report_id: carnageReportId, player_index: parseInt(playerIndex) };
            });

            if (killerPlayerIndices.length > 0) {
                const killerPlayers = await this.prisma.halo3_carnage_report_player.findMany({
                    where: {
                        OR: killerPlayerIndices.map(k => ({
                            carnage_report_id: k.carnage_report_id,
                            player_index: k.player_index,
                        })),
                    },
                    select: {
                        player_name: true,
                        carnage_report_id: true,
                        player_index: true,
                    }
                });

                const killerNameCounts = new Map<string, number>();
                killerPlayers.forEach(killer => {
                    const key = `${killer.carnage_report_id}:${killer.player_index}`;
                    const count = killerCounts.get(key) || 0;
                    const existing = killerNameCounts.get(killer.player_name) || 0;
                    killerNameCounts.set(killer.player_name, existing + count);
                });

                // Get unique player names and fetch their service records for current appearance
                const uniqueKillerNames = Array.from(killerNameCounts.keys());
                const killerServiceRecords = uniqueKillerNames.length > 0 ? await this.prisma.halo3_service_record.findMany({
                    where: {
                        player_name: { in: uniqueKillerNames },
                    },
                    select: {
                        player_name: true,
                        primary_color: true,
                        foreground_emblem: true,
                        background_emblem: true,
                        emblem_flags: true,
                        emblem_primary_color: true,
                        emblem_secondary_color: true,
                        emblem_background_color: true,
                    }
                }) : [];

                // Create a map of player name to service record
                const killerAppearanceMap = new Map<string, any>();
                killerServiceRecords.forEach(sr => {
                    killerAppearanceMap.set(sr.player_name, {
                        primaryColor: sr.primary_color,
                        foregroundEmblem: sr.foreground_emblem,
                        backgroundEmblem: sr.background_emblem,
                        emblemFlags: sr.emblem_flags,
                        emblemPrimaryColor: sr.emblem_primary_color,
                        emblemSecondaryColor: sr.emblem_secondary_color,
                        emblemBackgroundColor: sr.emblem_background_color,
                    });
                });

                mostKilledBy.push(...Array.from(killerNameCounts.entries())
                    .map(([playerName, count]) => ({ 
                        playerName, 
                        count,
                        appearance: killerAppearanceMap.get(playerName)
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10));
            }
        }

        // Get medal chest (sum all medals from matchmaking games only)
        const medalChest: Record<string, number> = {};
        if (multiplayerIds.length > 0) {
            // First, get all matchmaking game IDs (games with matchmaking options)
            const matchmakingGameIds = await this.prisma.halo3_carnage_report.findMany({
                where: {
                    id: { in: multiplayerIds },
                    carnage_report_matchmaking_options: {
                        isNot: null,
                    },
                },
                select: {
                    id: true,
                }
            });

            const matchmakingIds = matchmakingGameIds.map(g => g.id);

            if (matchmakingIds.length > 0) {
                const targetPlayerIndices = await this.prisma.halo3_carnage_report_player.findMany({
                    where: {
                        carnage_report_id: { in: matchmakingIds },
                        player_name: decodedGamertag,
                    },
                    select: {
                        carnage_report_id: true,
                        player_index: true,
                    }
                });

                if (targetPlayerIndices.length > 0) {
                    const medals = await this.prisma.halo3_carnage_report_player_medals.findMany({
                        where: {
                            OR: targetPlayerIndices.map(p => ({
                                carnage_report_id: p.carnage_report_id,
                                player_index: p.player_index,
                            })),
                        },
                    });

                    medals.forEach(medal => {
                        Object.entries(medal).forEach(([key, value]) => {
                            if (key !== 'carnage_report_id' && key !== 'player_index' && typeof value === 'number') {
                                medalChest[key] = (medalChest[key] || 0) + value;
                            }
                        });
                    });
                }
            }
        }

        // Detect Steaktacular and Linktacular medals
        let steaktacularCount = 0;
        let linktacularCount = 0;

        if (multiplayerIds.length > 0) {
            // Get matchmade games with game variant info and player data
            const matchmadeGamesRaw = await this.prisma.halo3_carnage_report.findMany({
                where: {
                    id: { in: multiplayerIds },
                },
                select: {
                    id: true,
                    team_game: true,
                    carnage_report_matchmaking_options: {
                        select: {
                            hopper_name: true,
                        }
                    },
                    carnage_report_game_variant: {
                        select: {
                            name: true,
                        }
                    },
                    carnage_report_player: {
                        select: {
                            player_name: true,
                            player_index: true,
                            standing: true,
                            player_team: true,
                            bungienet_user_flags: true,
                        }
                    },
                    carnage_report_team: {
                        select: {
                            team_index: true,
                            standing: true,
                        }
                    },
                }
            });

            // Filter to only matchmade games and type assert
            const matchmadeGames = matchmadeGamesRaw.filter(
                g => g.carnage_report_matchmaking_options?.hopper_name != null
            ) as Array<{
                id: string;
                team_game: boolean;
                carnage_report_matchmaking_options: { hopper_name: string | null } | null;
                carnage_report_game_variant: { name: string | null } | null;
                carnage_report_player: Array<{
                    player_name: string;
                    player_index: number;
                    standing: number;
                    player_team: number | null;
                    bungienet_user_flags: any;
                }>;
                carnage_report_team: Array<{
                    team_index: number;
                    standing: number;
                }>;
            }>;

            // Fetch all player statistics for all games upfront to avoid N+1 queries
            const allGameIds = matchmadeGames.map(g => g.id);
            const allPlayerStats = await this.prisma.halo3_carnage_report_player_statistics.findMany({
                where: {
                    carnage_report_id: { in: allGameIds },
                },
                select: {
                    carnage_report_id: true,
                    player_index: true,
                    kills: true,
                }
            });

            // Create a map for quick lookup: gameId -> playerIndex -> kills
            const statsMap = new Map<string, Map<number, number>>();
            allPlayerStats.forEach(stat => {
                if (!statsMap.has(stat.carnage_report_id)) {
                    statsMap.set(stat.carnage_report_id, new Map());
                }
                statsMap.get(stat.carnage_report_id)!.set(stat.player_index, stat.kills);
            });

            for (const game of matchmadeGames) {
                const targetPlayer = game.carnage_report_player.find(p => p.player_name === decodedGamertag);
                if (!targetPlayer) continue;

                const isMatchmade = !!game.carnage_report_matchmaking_options?.hopper_name;
                if (!isMatchmade) continue;

                const gameVariantName = game.carnage_report_game_variant?.name?.toLowerCase() || '';
                const isSlayer = gameVariantName.includes('slayer');

                // Check if player won
                let playerWon = false;
                if (game.team_game) {
                    const playerTeam = targetPlayer.player_team;
                    const playerTeamStanding = game.carnage_report_team.find(t => t.team_index === playerTeam)?.standing;
                    if (playerTeamStanding !== undefined) {
                        const bestStanding = Math.min(...game.carnage_report_team.map(t => t.standing));
                        const teamsWithBestStanding = game.carnage_report_team.filter(t => t.standing === bestStanding);
                        playerWon = playerTeamStanding === bestStanding && teamsWithBestStanding.length === 1;
                    }
                } else {
                    // FFA
                    const playersWithStanding1 = game.carnage_report_player.filter(p => p.standing === 1);
                    playerWon = targetPlayer.standing === 1 && playersWithStanding1.length === 1;
                }

                // Steaktacular: Matchmade slayer game, won by at least 20 kills
                if (isSlayer && playerWon) {
                    const gameStats = statsMap.get(game.id);
                    if (gameStats) {
                        const playerKills = gameStats.get(targetPlayer.player_index) || 0;
                        let secondPlaceKills = 0;

                        if (game.team_game) {
                            const playerTeam = targetPlayer.player_team;
                            const playerTeamStanding = game.carnage_report_team.find(t => t.team_index === playerTeam)?.standing;
                            if (playerTeamStanding === 1) {
                                // Get team scores (kills) for all teams
                                const teamScores = game.carnage_report_team.map(team => {
                                    const teamPlayers = game.carnage_report_player.filter(p => p.player_team === team.team_index);
                                    const teamKills = teamPlayers.reduce((sum, p) => {
                                        return sum + (gameStats.get(p.player_index) || 0);
                                    }, 0);
                                    return teamKills;
                                });
                                const sortedScores = teamScores.sort((a, b) => b - a);
                                secondPlaceKills = sortedScores.length > 1 ? sortedScores[1] : 0;
                            }
                        } else {
                            // FFA - get second place player's kills
                            const secondPlacePlayer = game.carnage_report_player
                                .filter(p => p.standing === 2)
                                .sort((a, b) => a.standing - b.standing)[0];
                            if (secondPlacePlayer) {
                                secondPlaceKills = gameStats.get(secondPlacePlayer.player_index) || 0;
                            }
                        }

                        const killDifference = playerKills - secondPlaceKills;
                        if (killDifference >= 20) {
                            steaktacularCount++;
                        }
                    }
                }

                // Linktacular: Matchmade game with all players being Bungie.net users
                // A player is a Bungie.net user if the first bit (bit 0) of bungienet_user_flags is set
                const allPlayersAreBungieNetUsers = game.carnage_report_player.every(player => {
                    const flags = Number(player.bungienet_user_flags);
                    return (flags & 1) !== 0; // Check if bit 0 is set
                });

                if (allPlayersAreBungieNetUsers) {
                    linktacularCount++;
                }
            }
        }

        // Add Steaktacular and Linktacular to medal chest
        if (steaktacularCount > 0) {
            medalChest['steaktacular'] = (medalChest['steaktacular'] || 0) + steaktacularCount;
        }
        if (linktacularCount > 0) {
            medalChest['linktacular'] = (medalChest['linktacular'] || 0) + linktacularCount;
        }

        // Find weapon of choice (weapon with most kills)
        const weaponKillsArray = Object.entries(weaponKills)
            .map(([killType, count]) => ({ killType: parseInt(killType), count }))
            .sort((a, b) => b.count - a.count);
        const weaponOfChoice = weaponKillsArray.length > 0 ? weaponKillsArray[0] : null;

        return {
            gameTypes: Object.entries(gameTypeCounts)
                .filter(([_, count]) => count > 0)
                .map(([name, value]) => ({ name, value })),
            killsDeaths: [
                { name: "Kills", value: totalKills },
                { name: "Deaths", value: totalDeaths },
            ].filter(r => r.value > 0),
            mostKilled: mostKilled,
            mostKilledBy: mostKilledBy,
            medalChest: medalChest,
            weaponKills: weaponKillsArray,
            weaponOfChoice: weaponOfChoice ? { killType: weaponOfChoice.killType, count: weaponOfChoice.count } : null,
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
                FROM "halo3"."carnage_report" cr
                WHERE EXISTS (
                    SELECT 1 FROM "halo3"."carnage_report_player" crp
                    WHERE crp.carnage_report_id = cr.id
                    AND crp.player_name = '${escapedGamertag}'
                )
                AND cr.finished = true
                AND cr.finish_time >= '${oneYearAgoStr}'
                UNION ALL
                SELECT finish_time
                FROM "halo3"."campaign_carnage_report" ccr
                WHERE EXISTS (
                    SELECT 1 FROM "halo3"."campaign_carnage_report_player" ccrp
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