import { Inject } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { CompressionService } from "../services/compression.service";
import { DiscordWebhookService } from "../services/discordwebhook.service";
import { isGuestXuid } from "src/xbox/xuid";
import {
  buildReachGameCreateInput,
  read_reach_game_results,
  REACH_TU1_BUILD_STRING,
  type reach_game_results,
} from "./game-results-blf";

/** A decoded `c.Bitfield` as its storage integer; the keys are in bit order. */
function bitfieldToRaw(flags: Record<string, boolean>): number {
    return Object.values(flags).reduce((raw, set, bit) => raw | (set ? 1 << bit : 0), 0);
}

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

    private isValidCarnageReport = ({ athr, mppl }: reach_game_results) => {
        if (athr.build_string !== REACH_TU1_BUILD_STRING) {
            this.logger.warn(`[UPLOAD] Received carnage report from unsupported build '${athr.build_string}', skipping.`)
            return false;
        }

        if (!mppl.players
            .filter(player => player.player_exists)
            .every(player => VALID_GAMERTAG_REGEX.test(player.configuration_from_client.desired_name))
        ) {
            this.logger.warn(`[UPLOAD] Received carnage report with an invalid gamertag, skipping.`)
            return false;
        }

        return true;
    }

    public handleHaloReachResultsUpload = async (upload: Express.Multer.File) => {
        const buffer = ALLOW_UNCOMPRESSED_CARNAGE_REPORTS 
            ? this.compressionService.inflateIfCompressed(upload)
            : this.compressionService.inflate(upload);

        const results = read_reach_game_results(buffer);
        if (!results) {
            this.logger.warn(`[UPLOAD] Received unreadable Halo: Reach game results, skipping.`)
            return;
        }

        if (!this.isValidCarnageReport(results)) {
            return;
        }

        await this.storeGameResults(results);
    }

    public storeGameResults = async (results: reach_game_results) => {
        await this.storeGame(results);
        await this.updateServiceRecords(results);
    }

    private storeGame = async (results: reach_game_results) => {
        const game = buildReachGameCreateInput(results);
        try {
            // Every console in the game uploads its own copy of the results; keep the latest one.
            await this.prisma.$transaction([
                this.prisma.reach_game.deleteMany({
                    where: { game_instance: game.game_instance },
                }),
                this.prisma.reach_game.create({ data: game, select: { id: true } }),
            ]);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                this.logger.debug(`[UPLOAD] Halo: Reach game ${game.game_instance} was stored by another upload, skipping.`)
                return;
            }
            this.logger.error(`[UPLOAD] Failed to store Halo: Reach game ${game.game_instance}: ${error}`)
        }
    }

    private updateServiceRecords = async ({ mppl }: reach_game_results) => {
        await this.prisma.$transaction([
            this.prisma.reach_service_record.deleteMany({
                where: {
                    player_xuid: {
                        in: mppl.players
                            .filter(player => player.player_exists)
                            .map(player => player.configuration_from_client.xuid.toString())
                    }
                }
            }),

            this.prisma.reach_service_record.createMany({
                data: mppl.players
                    .filter(player => player.player_exists)
                    .filter(player => !isGuestXuid(player.configuration_from_client.xuid))
                    .map(player => {
                        const config = player.configuration_from_client;
                        return {
                            player_xuid: config.xuid.toString(),
                            player_name: config.desired_name,
                            appearance_flags: bitfieldToRaw(config.appearance.flags),
                            primary_color: config.appearance.primary_color,
                            secondary_color: config.appearance.secondary_color,
                            tertiary_color: config.appearance.tertiary_color,
                            is_elite: config.appearance.player_model_choice,
                            foreground_emblem: config.appearance.foreground_emblem,
                            background_emblem: config.appearance.background_emblem,
                            emblem_flags: bitfieldToRaw(config.appearance.emblem_flags),
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
                            cheat_flags: bitfieldToRaw(config.cheat_flags),
                            ban_flags: bitfieldToRaw(config.ban_flags),
                            matchmade_games_played: config.hopper_stats.games_played,
                        };
                    }
                )
            }),
        ]);
    }
}