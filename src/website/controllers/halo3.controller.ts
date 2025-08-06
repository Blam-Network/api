import { Controller, Get, Header, Headers, Inject, Param, Post, UnauthorizedException } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import axios from "axios";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { EXAMPLE_XUID } from "src/lsp/constants";
import { z } from "zod";
import { AchievementsService } from "../services/achievements.service";
import { parseXuid } from "src/xbox/xuid";
import { PrismaService } from "src/db/prisma.service";

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
    ) { }

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
            0x4D5307E6,
            true,
            79
        )

        
        const halo3ODSTAchieevements = await this.achievementsService.getAchievements(
            authorization,
            player_xuid,
            0x4D530877,
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
            select: {
                map_variant_unique_id: true,
                game_variant_unique_id: true,
                carnage_report_matchmaking_options: true,
                carnage_report_team: true,
                carnage_report_player: {
                    include: {
                        carnage_report_player_statistics: true,
                        carnage_report_player_medals: true,
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
            ...carnageReport,
            player_interactions: playerInterractions,
        }
    }
}