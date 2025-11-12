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
import { HALO3_UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA, HALO3_UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA } from "src/constants";
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

        // Create or update transfer (upsert to handle duplicates)
        await this.prisma.halo3_file_share_transfer.upsert({
            where: {
                player_xuid_file_id: {
                    player_xuid: playerXuid,
                    file_id: fileId,
                }
            },
            create: {
                player_xuid: playerXuid,
                file_id: fileId,
                is_odst: false, // Default to Halo 3, could be determined from file metadata if needed
            },
            update: {
                // No-op if already exists - just keep the existing record
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

        return transfers.map(t => ({
            fileId: t.file_id,
            fileName: t.file.name,
            fileDescription: t.file.description,
            fileAuthor: t.file.author,
            fileType: t.file.file_type,
            fileDate: t.file.date,
            shareId: t.file.share_id.toString(),
            slot: t.file.slot,
            gameEngineType: t.file.game_engine_type ?? null,
        }));
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
        description: 'Returns paginated games across all users, optionally filtered by gamertag.',
    })
    async listGames(
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 48,
        @Query('gamertag') gamertag?: string,
    ) {
        const skip = (page - 1) * pageSize;
        
        let whereClause: any = {};
        let playerJoin: any = {};
        
        if (gamertag) {
            // Filter by gamertag - need to join with players
            playerJoin = {
                carnage_report_player: {
                    some: {
                        player_name: {
                            equals: gamertag,
                            mode: 'insensitive',
                        }
                    }
                }
            };
        }
        
        const [reports, total] = await Promise.all([
            this.prisma.halo3_carnage_report.findMany({
                where: playerJoin,
                orderBy: {
                    finish_time: 'desc'
                },
                skip,
                take: pageSize,
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
            }),
            this.prisma.halo3_carnage_report.count({
                where: playerJoin,
            }),
        ]);

        return {
            data: reports.map(r => ({
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
            })),
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
}