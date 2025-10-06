import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";

@Injectable()
export class AresUserService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    public getUserFile = async (xuid: string) => {
        const player_xuid = parseXuid(xuid).toString();
        // If the DB is too slow, or data isn't present, we'll return a file without player data or a service record.
        let fupd: undefined | BLF.ares_untracked.s_blf_chunk_player_data = undefined;

        const playerDataPromise = this.prisma.$transaction(async (prisma) => {
            const playerData = await prisma.ares_player_data.findUnique({ where: { player_xuid } });

            if (playerData) {
                let bungie_user_role = 0;
                bungie_user_role |= (1 << 0); // give everyone the seventh column
                if (playerData.is_pro) bungie_user_role |= (1 << 1);
                /*if (playerData.is_bungie)*/ bungie_user_role |= (1 << 2);
                /*if (playerData.has_recon)*/ bungie_user_role |= (1 << 3);
                fupd = {
                    hopper_access: playerData.hopper_access ?? 0,
                    highest_skill: playerData.highest_skill ?? 0,
                    bungie_user_role,
                    // Don't make this "default_hoppers", we use that to update the port range.
                    hopper_directory: playerData.hopper_directory_override || 'default_hoppers'
                }
            }
        })

        if (!fupd) {
            fupd = {
                bungie_user_role: 0xffffffff,
                highest_skill: 1,
                hopper_access: 0xffffffff,
                hopper_directory: 'default_hoppers'
            }
        }

        await Promise.allSettled([playerDataPromise]);

        this.logger.log(`[USER] ares user file requested for user ${xuid}`)

        return BLF.ares_untracked.build_user_file(
            fupd,
            undefined,
        );
    }

    public getRecentPlayersFile = async (playerXuid: BigInt) => {
        return BLF.ares_untracked.build_recent_players_file({
            players: []
        })
    }

    public updateHighestSkill = async (xuid: BigInt, highestSkill: number) => {
        if (highestSkill > 50 || highestSkill < 0) {
            throw new BadRequestException("Invalid highest skill.")
        }

        this.logger.log(`[USER] Updating highest skill for user ${xuid} to ${highestSkill}`)
        
        await this.prisma.ares_player_data.upsert({
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
