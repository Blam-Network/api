import { Inject } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { CompressionService } from "../services/compression.service";
import { DiscordWebhookService } from "../services/discordwebhook.service";
import { isGuestXuid } from "src/xbox/xuid";
import { find_chunk } from "@blamnetwork/blf";
import {
  s_blf_chunk_author,
  s_blf_chunk_multiplayer_players,
} from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";

// We turn this on for debugging but turn it off for security in prod.
const ALLOW_UNCOMPRESSED_CARNAGE_REPORTS = false;

const VALID_GAMERTAG_REGEX = /[a-zA-Z0-9 ,\(\)]{1,15}/;

export class HaloReachCarnageReportService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly compressionService: CompressionService,
        private readonly discordWebhookService: DiscordWebhookService,
    ) {}

    private isValidCarnageReport = (
        athr: s_blf_chunk_author,
        mppl: s_blf_chunk_multiplayer_players,
    ) => {
        if (athr.build_string !== '12065.11.08.24.1738.tu1actu') {
            this.logger.warn(`[UPLOAD] Received carnage report from unsupported build '${athr.build_string}', skipping.`)
            return false;
        }

        if (!mppl.players
            .filter(player => player.player_exists)
            .every(player => VALID_GAMERTAG_REGEX.test(player.player_configuration_from_client.desired_name))
        ) {
            this.logger.warn(`[UPLOAD] Received carnage report with an invalid gamertag, skipping.`)
            return false;
        }

        return true;
    }

    // This function is only partly implemented, it only updates Service Records currently.
    public handleHaloReachResultsUpload = async (upload: Express.Multer.File) => {
        const buffer = ALLOW_UNCOMPRESSED_CARNAGE_REPORTS 
            ? this.compressionService.inflateIfCompressed(upload)
            : this.compressionService.inflate(upload);

        const athr = new s_blf_chunk_author();
        const mppl = new s_blf_chunk_multiplayer_players();

        const found_athr = find_chunk(buffer, athr, "big");
        const found_mppl = find_chunk(buffer, mppl, "big");

        if (!found_athr || !found_mppl) {
            return;
        }

        if (!this.isValidCarnageReport(athr, mppl)) {
            return;
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.reach_service_record.deleteMany({
                where: {
                    player_xuid: {
                        in: mppl.players
                            .filter(player => player.player_exists)
                            .map(player => player.player_configuration_from_client.xuid.toString())
                    }
                }
            })

            await tx.reach_service_record.createMany({
                data: mppl.players
                    .filter(player => player.player_exists)
                    .filter(player => !isGuestXuid(player.player_configuration_from_client.xuid))
                    .map(player => {
                        const config = player.player_configuration_from_client;
                        return {
                            player_xuid: config.xuid.toString(),
                            player_name: config.desired_name,
                            appearance_flags: config.appearance.voice,
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
                            model_permutations_1: config.appearance.model_permutations[0],
                            model_permutations_2: config.appearance.model_permutations[1],
                            model_permutations_3: config.appearance.model_permutations[2],
                            model_permutations_4: config.appearance.model_permutations[3],
                            model_permutations_5: config.appearance.model_permutations[4],
                            model_permutations_6: config.appearance.model_permutations[5],
                            model_permutations_7: config.appearance.model_permutations[6],
                            model_permutations_8: config.appearance.model_permutations[7],
                            non_model_customization_1: config.appearance.non_model_customization[0],
                            non_model_customization_2: config.appearance.non_model_customization[1],
                            non_model_customization_3: config.appearance.non_model_customization[2],
                            non_model_customization_4: config.appearance.non_model_customization[3],
                            service_tag: config.appearance.service_tag,
                            campaign_progress: config.campaign_highest_difficulty,
                            supply_depot_pct: config.supply_depot_pct,
                            commendation_unlock_pct: config.commendation_unlock_pct,
                            grade: config.grade,
                            sub_grade: config.sub_grade,
                            cheat_flags: config.cheat_flags,
                            ban_flags: config.ban_flags,
                            matchmade_games_played: config.hopper_stats.games_played,
                        };
                    }
                )
            });
        }, { timeout: 15_000 });
    }
}