import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blamnetwork/blf_lsp';
import { parseXuid } from "src/xbox/xuid";
import { z } from "zod";

@Injectable()
export class Halo3PopulationService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }


    public getHopperStatistics = async () => {
        const hopperPopulationResponse = await this.prisma.$queryRaw`
            SELECT COUNT(player_xuid) AS player_count, hopper_identifier
            FROM (
                SELECT DISTINCT ON (crp.player_xuid)
                    crp.player_xuid,
                    crmo.hopper_identifier
                FROM "halo3"."carnage_report_player" crp
                INNER JOIN "halo3"."carnage_report" cr ON cr.id = crp.carnage_report_id
                INNER JOIN "halo3"."carnage_report_matchmaking_options" crmo ON crmo.id = crp.carnage_report_id
                WHERE cr.finish_time >= NOW() - INTERVAL '1 hour'
                ORDER BY crp.player_xuid, cr.finish_time DESC
            ) AS hopper_players
            GROUP BY hopper_identifier
            ORDER BY COUNT(player_xuid) DESC
            LIMIT 32;
        `;

        const hopperPopulation = z.object({
            player_count: z.number(),
            hopper_identifier: z.number()
        }).array().parse(hopperPopulationResponse);

        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_hopper_statistics_file({
            data: hopperPopulation.concat(Array(32 - hopperPopulation.length).fill({ hopper_identifier: 0, player_count: 0 })),
            player_count: hopperPopulation.reduce((count, hp) => count + hp.player_count, 0)
        })
    }

}
