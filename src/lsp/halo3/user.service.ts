import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import { z } from "zod";
import { clamp_to_byte, i32_to_u32 } from "../datatypes";

@Injectable()
export class Halo3UserService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    public getUserFile = async (xuid: BigInt) => {
        const player_xuid = xuid.toString();
        // If the DB is too slow, or data isn't present, we'll return a file without player data or a service record.
        let srid: undefined | BLF.halo3_12070_08_09_05_2031_halo3_ship.s_blf_chunk_service_record = undefined;
        let fupd: undefined | BLF.halo3_12070_08_09_05_2031_halo3_ship.s_blf_chunk_player_data = undefined;
        let osri: undefined | BLF.halo3odst_13895_09_04_27_2201_atlas_release.s_blf_chunk_odst_service_record = undefined;
        let filq: undefined | BLF.halo3_12070_08_09_05_2031_halo3_ship.s_blf_chunk_file_transfers = undefined;
        
        const serviceRecordPromise = this.prisma.$transaction(async (prisma) => {
            const serviceRecord = await prisma.halo3_service_record.findUnique({
                where: { player_xuid }, select: {
                    player_name: true,
                    appearance_flags: true,
                    primary_color: true,
                    secondary_color: true,
                    tertiary_color: true,
                    emblem_background_color: true,
                    emblem_primary_color: true,
                    emblem_secondary_color: true,
                    elite_body: true,
                    elite_helmet: true,
                    elite_left_shoulder: true,
                    elite_right_shoulder: true,
                    emblem_flags: true,
                    is_elite: true,
                    total_exp: true,
                    foreground_emblem: true,
                    background_emblem: true,
                    spartan_body: true,
                    service_tag: true,
                    spartan_helmet: true,
                    spartan_left_shoulder: true,
                    spartan_right_shoulder: true,
                    campaign_progress: true,
                    games_completed: true,
                    experience_base: true,
                    rank: true,
                    grade: true,
                    highest_skill: true,
                }
            });

            srid = serviceRecord ? serviceRecord : undefined;
        }, {timeout: 5000});

        const playerDataPromise = this.prisma.$transaction(async (prisma) => {
            const playerData = await prisma.halo3_player_data.findUnique({ where: { player_xuid } });

            if (playerData) {
                let bungie_user_role = 0;
                bungie_user_role |= (1 << 0); // give everyone the seventh column
                if (playerData.is_pro) bungie_user_role |= (1 << 1);
                if (playerData.is_bungie) bungie_user_role |= (1 << 2);
                if (playerData.has_recon || playerData.road_to_recon_completed) bungie_user_role |= (1 << 3);
                fupd = {
                    hopper_access: playerData.hopper_access ?? 0,
                    highest_skill: playerData.highest_skill ?? 0,
                    bungie_user_role,
                    hopper_directory: playerData.hopper_directory_override || 'default_hoppers'
                }
            }
        })

        const odstServiceRecordPromise = this.prisma.$transaction(async (prisma) => {
            const playerData = await prisma.halo3_player_data.findUnique({ where: { player_xuid } });

            if (playerData) {
                osri = {
                    extras_portal_debug: playerData.odst_extras_portal_debug ?? false,
                    vidmaster: clamp_to_byte(i32_to_u32(playerData.odst_vidmaster_flag)) ?? 0,
                    
                    // This is stubbed until we implement odst carnage reports
                    appearance_flags: 0,
                    background_emblem: 0,
                    campaign_progress: 0,
                    elite_body: 0,
                    elite_helmet: 0,
                    elite_left_shoulder: 0,
                    elite_right_shoulder: 0,
                    emblem_background_color: 0,
                    emblem_flags: 0,
                    emblem_primary_color: 0,
                    emblem_secondary_color: 0,
                    experience_base: 0,
                    foreground_emblem: 0,
                    games_completed: 0,
                    grade: 0,
                    highest_skill: 0,
                    is_elite: 0,
                    player_name: '',
                    primary_color: 0,
                    secondary_color: 0,
                    tertiary_color: 0,
                    rank: 0,
                    spartan_body: 0,
                    spartan_helmet: 0,
                    spartan_left_shoulder: 0,
                    spartan_right_shoulder: 0,
                    service_tag: '',
                    total_exp: 0,
                }
            }
        })

        const activeTransfersPromise = this.prisma.$transaction(async (prisma) => {
            const transfers = await prisma.halo3_file_share_transfer.findMany({
                where: {
                    player_xuid,
                    file: {
                        is_uploaded: true,
                    }
                },
                include: {
                    file: {
                        select: {
                            slot: true,
                            share_id: true,
                            name: true,
                            description: true,
                            file_type: true,
                            campaign_id: true,
                            map_id: true,
                            game_engine_type: true,
                            size_in_bytes: true
                        }
                    }
                },
                take: 8, // max filq can handle.
            })

            if (transfers.length > 0) {
                filq = {
                    transfers: transfers.map(transfer => ({
                        share_id: BigInt(transfer.file.share_id.toFixed(0)),
                        slot: transfer.file.slot,
                        title_index: transfer.is_odst ? 3 : 0,
                        server_id: 1n,
                        file_name: transfer.file.name ?? '',
                        file_type: transfer.file.file_type,
                        campaign_id: transfer.file.campaign_id ?? 0,
                        map_id: transfer.file.map_id ?? 0,
                        game_engine_type: transfer.file.game_engine_type ?? 0,
                        size_bytes: BigInt(transfer.file.size_in_bytes.toFixed(0)),
                    } satisfies BLF.halo3_12070_08_09_05_2031_halo3_ship.s_blf_chunk_file_transfers['transfers'][0]))
                }
            }
        })

        await Promise.allSettled([serviceRecordPromise, playerDataPromise, odstServiceRecordPromise, activeTransfersPromise]);

        // Typescript is dumb
        // @ts-ignore
        let name = srid ? srid.player_name : '<unknown>';
        this.logger.log(`[USER] user file requested for user ${xuid} / ${name}`)

        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_user_file(
            fupd,
            srid,
            filq,
            osri
        );
    }

    public getRecentPlayersFile = async (playerXuid: BigInt) => {
        const carnageReports = await this.prisma.halo3_carnage_report.findMany({
            where: {
                carnage_report_player: {
                    some: {
                        player_xuid: playerXuid.toString()
                    }
                },
                NOT: {
                    carnage_report_matchmaking_options: null
                }
            },
            select: {
                carnage_report_player: {
                    select: {
                        player_xuid: true,
                    }
                },
                carnage_report_matchmaking_options: {
                    select: {
                        hopper_identifier: true,
                    }
                }
            },
            take: 100,
            orderBy: {
                finish_time: 'desc'
            }
        })

        let players: BLF.halo3_12070_08_09_05_2031_halo3_ship.s_blf_chunk_user_recent_players['players'] = [];

        if (carnageReports) {
            for (const carnageReport of carnageReports) {
                if (players.length >= 100) break;
                if (!carnageReport.carnage_report_matchmaking_options?.hopper_identifier) continue;

                for (const player of carnageReport.carnage_report_player) {
                    players.push({
                        hopper_identifier: carnageReport.carnage_report_matchmaking_options.hopper_identifier,
                        xuid: BigInt(player.player_xuid.toString())
                    })
                }
            }
        }

        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_recent_players_file({
            players
        })
    }

    public updateHighestSkill = async (xuid: BigInt, highestSkill: number) => {
        if (highestSkill > 50 || highestSkill < 0) {
            throw new BadRequestException("Invalid highest skill.")
        }

        this.logger.log(`[USER] Updating highest skill for user ${xuid} to ${highestSkill}`)
        
        await this.prisma.halo3_player_data.upsert({
            where: { player_xuid: xuid.toString() },
            create: {
                player_xuid: xuid.toString(),
                highest_skill: highestSkill,
            },
            update: {
                highest_skill: highestSkill,
            }
        })
    }
}
