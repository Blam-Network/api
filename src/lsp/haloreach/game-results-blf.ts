import { find_chunk } from '@blamnetwork/blf';
import * as HR from '@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual';
import type { Prisma } from '@prisma/client';

export const REACH_TU1_BUILD_STRING = '12065.11.08.24.1738.tu1actu';

const k_game_results_statistic = {
    games_played: 0,
    games_completed: 1,
    games_won: 2,
    games_tied: 3,
    rounds_completed: 4,
    rounds_won: 5,
    in_round_score: 6,
    in_game_total_score: 7,
    kills: 8,
    assists: 9,
    deaths: 10,
    betrayals: 11,
    suicides: 12,
    most_kills_in_a_row: 13,
    seconds_alive: 14,
} as const;

const k_event_type_none = 0;

/**
 * Multiplayer, campaign and firefight game results ("webstats") uploaded after a game:
 * `_blf athr mpgd mpmo mppl mptm mpma _par(mps1 mps2 mps3 mps4) mpev glcp clif chrt _eof`.
 */
export function read_reach_game_results(buffer: Uint8Array) {
    const chunks = {
        athr: new HR.s_blf_chunk_author(),
        mpgd: new HR.s_blf_chunk_game_results_game_description(),
        mpmo: new HR.s_blf_chunk_game_results_matchmaking_options(),
        mppl: new HR.s_blf_chunk_multiplayer_players(),
        mptm: new HR.s_blf_chunk_game_results_teams(),
        stats: new HR.s_blf_chunk_game_results_statistics(),
        mpev: new HR.s_blf_chunk_game_results_events(),
    };
    try {
        for (const chunk of Object.values(chunks)) {
            if (!find_chunk(buffer, chunk, 'big')) {
                return null;
            }
        }
    } catch {
        return null;
    }
    return chunks;
}

export type reach_game_results = NonNullable<ReturnType<typeof read_reach_game_results>>;

function bitfieldToRaw(flags: Record<string, boolean>): number {
    return Object.values(flags).reduce((raw, set, bit) => raw | (set ? 1 << bit : 0), 0);
}

const values = (statistics: readonly { value: number }[]) => statistics.map((statistic) => statistic.value);

const point = (position: { x: number; y: number; z: number }) => [position.x, position.y, position.z];

const fromUnixSeconds = (seconds: number) => new Date(seconds * 1000);

function gameVariantDetails(results: reach_game_results) {
    const variant = results.mpgd.description.game_variant;
    const custom = variant.m_custom_variant ?? variant.m_sandbox_variant?.m_custom_variant;
    const base = custom?.m_base_variant
        ?? variant.m_survival_variant?.m_base_variant
        ?? variant.m_campaign_variant;
    const metadata = base?.m_metadata;

    const customStatisticCount = Math.max(0, results.mpgd.description.custom_statistic_count);
    const customStatistics = custom?.m_game_engine.m_statistics.slice(0, customStatisticCount) ?? [];

    const iconIndex = metadata?.file_type_data && 'icon_index' in metadata.file_type_data
        ? Number(metadata.file_type_data.icon_index)
        : -1;

    return {
        game_engine: variant.m_game_engine,
        name: metadata?.name ?? '',
        description: metadata?.description ?? '',
        icon_index: iconIndex,
        custom_statistic_names: customStatistics.map(
            (statistic) => custom?.m_script_strings.strings[0]?.[statistic.m_name_string_index] ?? '',
        ),
        custom_statistic_formats: customStatistics.map((statistic) => statistic.m_format),
    };
}

/** The players who were in the game, by their game results index. */
export function reachGamePlayers(results: reach_game_results) {
    return results.mppl.players
        .map((player, index) => ({ player, index }))
        .filter(({ player }) => player.player_exists);
}

export function buildReachGameCreateInput(results: reach_game_results): Prisma.reach_gameCreateInput {
    const { mpgd, mpmo, mptm, stats, mpev, athr } = results;
    const description = mpgd.description;
    const variant = gameVariantDetails(results);
    const players = reachGamePlayers(results);
    const playerIndices = new Set(players.map(({ index }) => index));
    const hasHopper = mpmo.hopper_name.length > 0;

    return {
        game_instance: description.game_instance.toString(),
        build_string: athr.build_string,
        gui_game_mode: mpgd.ui_game_mode,
        game_engine: variant.game_engine,
        game_engine_category: mpgd.game_engine_category,
        game_mode: description.game_mode,
        team_game: description.team_game,
        started: mpgd.started,
        start_time: fromUnixSeconds(mpgd.start_time),
        finished: mpgd.finished,
        finish_time: fromUnixSeconds(mpgd.finish_time),
        game_end_reason: mpgd.game_end_reason,
        map_id: description.map_id,
        map_variant_name: description.map_variant_name,
        map_variant_unique_id: description.map_variant_unique_id.toString(),
        scenario_path: description.scenario_path,
        game_variant_name: variant.name,
        game_variant_description: variant.description,
        game_variant_unique_id: description.game_variant_unique_id.toString(),
        game_variant_icon_index: variant.icon_index,
        custom_statistic_names: variant.custom_statistic_names,
        custom_statistic_formats: variant.custom_statistic_formats,
        campaign_difficulty: description.campaign_difficulty,
        initial_skulls: description.initial_skulls,
        round_time_limit_seconds: description.round_time_limit_seconds,
        score_to_win_round: description.score_to_win_round,
        number_of_rounds: description.number_of_rounds,
        hopper_identifier: hasHopper ? mpmo.hopper_identifier : null,
        hopper_name: hasHopper ? mpmo.hopper_name : null,
        hopper_ranked: hasHopper ? mpmo.flags.ranked : null,
        survival_sets_completed: description.survival_sets_completed,
        survival_full_rounds_completed: description.survival_full_rounds_completed,
        survival_waves_completed: description.survival_waves_completed,
        teams: {
            create: mptm.teams
                .map((team, team_index) => ({ team, team_index }))
                .filter(({ team }) => team.team_exists)
                .map(({ team, team_index }) => ({
                    team_index,
                    standing: team.standing,
                    score: team.score,
                    statistics: values(stats.team_statistics.teams[team_index].statistics),
                })),
        },
        players: {
            create: players.map(({ player, index }) => {
                const client = player.configuration_from_client;
                const appearance = client.appearance;
                const statistics = stats.player_statistics.players[index];
                const statisticValues = values(statistics.statistics);
                const versus = stats.player_vs_player_statistics.players[index].opponents
                    .map((opponent, opponent_index) => ({
                        opponent_index,
                        kills: opponent.kills.value,
                        deaths: opponent.deaths.value,
                    }))
                    .filter((opponent) => playerIndices.has(opponent.opponent_index) && (opponent.kills || opponent.deaths));
                const aiStatistics = stats.player_vs_ai_statistics.players[index];
                const aiKills = (aiStatistics?.bucket_types ?? []).flatMap((bucketType, bucket_type) =>
                    bucketType.bucket_classes
                        .map((bucketClass, bucket_class) => ({
                            bucket_type,
                            bucket_class,
                            kills: bucketClass.kills.value,
                            betrayals: bucketClass.betrayals.value,
                        }))
                        .filter((bucket) => bucket.kills || bucket.betrayals),
                );
                const weapons = statistics.damage
                    .map((damage, damage_type) => {
                        const [kills, deaths, betrayals, suicides, headshots] = values(damage.statistics);
                        return { damage_type, kills, deaths, betrayals, suicides, headshots };
                    })
                    .filter((weapon) => weapon.kills || weapon.deaths || weapon.betrayals || weapon.suicides || weapon.headshots);

                return {
                    player_index: index,
                    player_xuid: client.xuid.toString(),
                    player_name: client.desired_name,
                    service_tag: appearance.service_tag,
                    team: player.configuration_from_host.team,
                    standing: player.standing,
                    score: player.score,
                    player_rating: player.player_rating,
                    ticks_played: player.ticks_played,
                    grade: client.grade,
                    sub_grade: client.sub_grade,
                    is_elite: Boolean(appearance.player_model_choice),
                    primary_color: appearance.primary_color,
                    secondary_color: appearance.secondary_color,
                    tertiary_color: appearance.tertiary_color,
                    foreground_emblem: appearance.foreground_emblem,
                    background_emblem: appearance.background_emblem,
                    emblem_flags: bitfieldToRaw(appearance.emblem_flags),
                    emblem_primary_color: appearance.emblem_primary_color,
                    emblem_secondary_color: appearance.emblem_secondary_color,
                    emblem_background_color: appearance.emblem_background_color,
                    kills: statisticValues[k_game_results_statistic.kills],
                    deaths: statisticValues[k_game_results_statistic.deaths],
                    assists: statisticValues[k_game_results_statistic.assists],
                    betrayals: statisticValues[k_game_results_statistic.betrayals],
                    suicides: statisticValues[k_game_results_statistic.suicides],
                    most_kills_in_a_row: statisticValues[k_game_results_statistic.most_kills_in_a_row],
                    seconds_alive: statisticValues[k_game_results_statistic.seconds_alive],
                    statistics: statisticValues,
                    medals: values(statistics.medals),
                    reward_statistics: values(statistics.reward_statistics),
                    campaign_metagame_final_score: player.campaign_metagame_final_score,
                    weapons: { createMany: { data: weapons } },
                    versus: { createMany: { data: versus } },
                    ai_kills: { createMany: { data: aiKills } },
                };
            }),
        },
        events: {
            createMany: {
                data: mpev.events
                    .map((event, event_index) => ({ event, event_index }))
                    .filter(({ event }) => event.event_type !== k_event_type_none)
                    .map(({ event, event_index }) => ({
                        event_index,
                        time: event.time,
                        event_type: event.event_type,
                        player_index: event.player_index,
                        victim_index_or_bucket_type: event.victim_player_index_or_bucket_type,
                        bucket_class: event.bucket_class,
                        damage_type: event.damage_reporting_type,
                        victim_damage_type: event.victim_weapon_damage_reporting_type,
                        points: event.points,
                        player_position: point(event.player_position),
                        victim_position: point(event.victim_position),
                    })),
            },
        },
        medal_events: {
            createMany: {
                data: mpev.medal_events
                    .map((event, event_index) => ({ event, event_index }))
                    .filter(({ event }) => event.event_type !== k_event_type_none)
                    .map(({ event, event_index }) => ({
                        event_index,
                        time: event.time,
                        player_index: event.player_index,
                        medal: event.medal,
                        player_position: point(event.player_position),
                    })),
            },
        },
    };
}
