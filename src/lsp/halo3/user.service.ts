import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import { z } from "zod";

@Injectable()
export class Halo3UserService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    public getUserFile = async (xuid: string) => {
        const player_xuid = parseXuid(xuid);
        const serviceRecord = await this.prisma.service_record.findUnique({
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
                unknown_insignia: true,
                unknown_insignia2: true,
                rank: true,
                grade: true,
                highest_skill: true,
            }
        });
        const playerData = await this.prisma.player_data.findUnique({ where: { player_xuid } });

        let name = serviceRecord ? serviceRecord.player_name : '<unknown>';
        this.logger.log(`[USER] user file requested for user ${xuid} / ${name}`)

        let fupd: BLF.halo3_12070_08_09_05_2031_halo3_ship.s_blf_chunk_player_data | undefined = undefined;

        if (playerData) {
            let bungie_user_role = 0;
            bungie_user_role | 1 << 1; // give everyone the seventh column
            if (playerData.is_pro) bungie_user_role | 1 << 1;
            if (playerData.is_bungie) bungie_user_role | 1 << 2;
            if (playerData.has_recon || playerData.road_to_recon_completed) bungie_user_role | 1 << 3;
            fupd = {
                hopper_access: playerData.hopper_access ?? 0,
                highest_skill: playerData.hopper_access ?? 0,
                bungie_user_role,
                hopper_directory: playerData.hopper_directory_override || 'default_hoppers'
            }
        }

        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_user_file(
            fupd,
            serviceRecord ?? undefined,
        );
    }

    public getRecentPlayersFile = (_xuid: string) => {
        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_recent_players_file({
            players: []
        })
    }

    public updateHighestSkill = (xuid: string, highestSkill: number) => {
        const highestSkillParsed = z.number().max(50).min(0).safeParse(highestSkill);
        if (!highestSkillParsed.success) {
            throw new BadRequestException("Invalid highest skill.")
        }
        const xuidParsed = parseXuid(xuid);

        this.logger.log(`[USER] Updating highest skill for user ${xuid} to ${highestSkill}`)
        
        this.prisma.player_data.upsert({
            where: { player_xuid: xuidParsed },
            create: {
                player_xuid: xuidParsed,
                highest_skill: highestSkillParsed.data,
            },
            update: {
                highest_skill: highestSkillParsed.data,
            }
        })
    }
}
