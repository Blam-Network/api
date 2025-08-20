-- CreateTable
CREATE TABLE "ares"."carnage_report" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_game" BOOLEAN NOT NULL,
    "game_id" DECIMAL(20,0) NOT NULL,
    "map_id" INTEGER NOT NULL,
    "scenario_path" TEXT NOT NULL,
    "map_variant_name" VARCHAR(32) NOT NULL,
    "game_variant_unique_id" DECIMAL(20,0) NOT NULL,
    "map_variant_unique_id" DECIMAL(20,0) NOT NULL,
    "started" BOOLEAN NOT NULL,
    "start_time" TIMESTAMP(6) NOT NULL,
    "finished" BOOLEAN NOT NULL,
    "finish_time" TIMESTAMP(6) NOT NULL,
    "migrated_to_group" BOOLEAN NOT NULL,
    "migrated_solo" BOOLEAN NOT NULL,
    "simulation_aborted" BOOLEAN NOT NULL,
    "in_group_session" BOOLEAN NOT NULL DEFAULT false,
    "in_squad_session" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "carnage_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_event_carry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "carnage_report_id" UUID,
    "time" DECIMAL(20,0) NOT NULL,
    "carry_player_index" SMALLINT NOT NULL,
    "position" DOUBLE PRECISION[],
    "weapon_index" INTEGER NOT NULL,
    "carry_type" INTEGER NOT NULL,

    CONSTRAINT "carnage_report_event_carry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_event_kill" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "carnage_report_id" UUID,
    "time" DECIMAL(20,0) NOT NULL,
    "killer_player_index" SMALLINT NOT NULL,
    "dead_player_index" SMALLINT NOT NULL,
    "killer_position" DOUBLE PRECISION[],
    "dead_position" DOUBLE PRECISION[],
    "kill_type" INTEGER NOT NULL,

    CONSTRAINT "carnage_report_event_kill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_event_score" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "carnage_report_id" UUID,
    "time" DECIMAL(20,0) NOT NULL,
    "score_player_index" SMALLINT NOT NULL,
    "position" DOUBLE PRECISION[],
    "weapon_index" INTEGER NOT NULL,
    "score_type" INTEGER NOT NULL,

    CONSTRAINT "carnage_report_event_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_game_variant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_engine" SMALLINT NOT NULL,
    "unique_id" DECIMAL(20,0) NOT NULL,
    "name" VARCHAR(16) NOT NULL,
    "description" VARCHAR(128) NOT NULL,
    "author" VARCHAR(16) NOT NULL,
    "file_type" INTEGER NOT NULL,
    "author_is_xuid_online" BOOLEAN NOT NULL,
    "author_id" DECIMAL(20,0) NOT NULL,
    "size_in_bytes" DECIMAL(20,0) NOT NULL,
    "date" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "carnage_report_game_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_machine" (
    "carnage_report_id" UUID NOT NULL,
    "machine_index" SMALLINT NOT NULL,
    "machine_identifier" BYTEA NOT NULL,
    "machine_exists" BOOLEAN,
    "machine_connected_to_host" BOOLEAN,
    "machine_host" BOOLEAN,
    "machine_initial_host" BOOLEAN,
    "machine_voluntary_quit" BOOLEAN,
    "machine_bandwidth_events_0" INTEGER,
    "machine_bandwidth_events_1" INTEGER,
    "machine_bandwidth_events_2" INTEGER,
    "machine_bandwidth_events_3" INTEGER,
    "machine_bandwidth_events_4" INTEGER,
    "session_exists" BOOLEAN,
    "session_has_hard_drive" BOOLEAN,
    "session_party_nonce" DECIMAL(20,0),
    "session_secure_address" BYTEA,
    "session_network_version_number" INTEGER,
    "session_peer_estimated_downstream_bandwidth_bps" INTEGER,
    "session_peer_estimated_upstream_bandwidth_bps" INTEGER,
    "session_peer_nat_type" INTEGER,
    "session_peer_to_peer_connectivity_mask" INTEGER,
    "session_peer_to_peer_probed_mask" INTEGER,
    "inaddr" TEXT,
    "inaddr_online" TEXT,

    CONSTRAINT "carnage_report_machine_pkey" PRIMARY KEY ("carnage_report_id","machine_index")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_matchmaking_options" (
    "id" UUID NOT NULL,
    "hopper_identifier" INTEGER NOT NULL,
    "hopper_name" VARCHAR(32) NOT NULL,
    "hopper_ranked" BOOLEAN NOT NULL,
    "hopper_team_based" BOOLEAN NOT NULL,
    "xlast_index" INTEGER NOT NULL,
    "draw_probability" DECIMAL(20,0) NOT NULL,
    "beta" DOUBLE PRECISION NOT NULL,
    "tau" DOUBLE PRECISION NOT NULL,
    "experience_base_increment" DECIMAL(20,0) NOT NULL,
    "experience_penalty_decrement" DECIMAL(20,0) NOT NULL,

    CONSTRAINT "pk_carnage_report_matchmaking_options" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_player" (
    "carnage_report_id" UUID NOT NULL,
    "player_identifier" DECIMAL(20,0) NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "machine_index" SMALLINT,
    "player_name" VARCHAR(16) NOT NULL,
    "appearance_flags" INTEGER NOT NULL,
    "primary_color" INTEGER NOT NULL,
    "secondary_color" INTEGER NOT NULL,
    "tertiary_color" INTEGER NOT NULL,
    "player_model_choice" INTEGER NOT NULL,
    "foreground_emblem" INTEGER NOT NULL,
    "background_emblem" INTEGER NOT NULL,
    "emblem_flags" INTEGER NOT NULL,
    "emblem_primary_color" INTEGER NOT NULL,
    "emblem_secondary_color" INTEGER NOT NULL,
    "emblem_background_color" INTEGER NOT NULL,
    "spartan_model_area_0" INTEGER NOT NULL,
    "spartan_model_area_1" INTEGER NOT NULL,
    "spartan_model_area_2" INTEGER NOT NULL,
    "spartan_model_area_3" INTEGER NOT NULL,
    "elite_model_area_0" INTEGER NOT NULL,
    "elite_model_area_1" INTEGER NOT NULL,
    "elite_model_area_2" INTEGER NOT NULL,
    "elite_model_area_3" INTEGER NOT NULL,
    "service_tag" VARCHAR(4) NOT NULL,
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "is_silver_or_gold_live" BOOLEAN NOT NULL,
    "is_online_enabled" BOOLEAN NOT NULL,
    "is_controller_attached" BOOLEAN NOT NULL,
    "user_selected_team_index" INTEGER NOT NULL,
    "desires_veto" BOOLEAN NOT NULL,
    "desires_rematch" BOOLEAN NOT NULL,
    "hopper_access_flags" INTEGER NOT NULL,
    "is_free_live_gold_account" BOOLEAN NOT NULL,
    "is_user_created_content_allowed" BOOLEAN NOT NULL,
    "is_friend_created_content_allowed" BOOLEAN NOT NULL,
    "is_griefer" SMALLINT NOT NULL,
    "campaign_difficulty_completed" INTEGER NOT NULL,
    "bungienet_user_flags" DECIMAL(20,0) NOT NULL,
    "gamer_region" INTEGER NOT NULL,
    "gamer_zone" INTEGER NOT NULL,
    "cheat_flags" DECIMAL(20,0) NOT NULL,
    "ban_flags" DECIMAL(20,0) NOT NULL,
    "repeated_play_coefficient" INTEGER NOT NULL,
    "experience_growth_banned" BOOLEAN NOT NULL,
    "matchmade_ranked_games_played" DECIMAL(20,0) NOT NULL,
    "matchmade_ranked_games_completed" DECIMAL(20,0) NOT NULL,
    "matchmade_ranked_games_won" DECIMAL(20,0) NOT NULL,
    "matchmade_unranked_games_played" DECIMAL(20,0) NOT NULL,
    "matchmade_unranked_games_completed" DECIMAL(20,0) NOT NULL,
    "hopper_experience_base" DECIMAL(20,0) NOT NULL,
    "custom_games_completed" DECIMAL(20,0) NOT NULL,
    "hopper_experience_penalty" DECIMAL(20,0) NOT NULL,
    "first_played" TIMESTAMP(6) NOT NULL,
    "last_played" TIMESTAMP(6) NOT NULL,
    "global_statistics_valid" SMALLINT NOT NULL,
    "global_statistics_highest_skill" DECIMAL(20,0) NOT NULL,
    "global_statistics_experience_base" DECIMAL(20,0) NOT NULL,
    "global_statistics_experience_penalty" DECIMAL(20,0) NOT NULL,
    "hopper_statistics_valid" SMALLINT NOT NULL,
    "hopper_statistics_identifier" INTEGER NOT NULL,
    "hopper_statistics_hopper_skill" DECIMAL(20,0) NOT NULL,
    "hopper_statistics_games_won" DECIMAL(20,0) NOT NULL,
    "hopper_statistics_games_played" DECIMAL(20,0) NOT NULL,
    "hopper_statistics_games_completed" DECIMAL(20,0) NOT NULL,
    "hopper_statistics_mu" DOUBLE PRECISION,
    "hopper_statistics_sigma" DOUBLE PRECISION,
    "player_team" INTEGER NOT NULL,
    "player_assigned_team" INTEGER NOT NULL,
    "host_stats_global_valid" BOOLEAN NOT NULL,
    "host_stats_global_experience" INTEGER NOT NULL,
    "host_stats_global_rank" INTEGER NOT NULL,
    "host_stats_global_grade" INTEGER NOT NULL,
    "host_stats_hopper_valid" BOOLEAN NOT NULL,
    "host_stats_hopper_skill" INTEGER NOT NULL,
    "host_stats_hopper_skill_display" INTEGER NOT NULL,
    "host_stats_hopper_skill_update_weight" INTEGER NOT NULL,
    "standing" SMALLINT NOT NULL,
    "result" SMALLINT NOT NULL,
    "score" SMALLINT NOT NULL,

    CONSTRAINT "carnage_report_player_pkey" PRIMARY KEY ("carnage_report_id","player_index")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_player_achievements" (
    "carnage_report_id" UUID NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "landfall" SMALLINT NOT NULL,
    "holdout" SMALLINT NOT NULL,
    "the_road" SMALLINT NOT NULL,
    "assault" SMALLINT NOT NULL,
    "cleansing" SMALLINT NOT NULL,
    "refuge" SMALLINT NOT NULL,
    "last_stand" SMALLINT NOT NULL,
    "the_key" SMALLINT NOT NULL,
    "_return" SMALLINT NOT NULL,
    "campaign_complete_normal" SMALLINT NOT NULL,
    "campaign_complete_heroic" SMALLINT NOT NULL,
    "campaign_complete_legendary" SMALLINT NOT NULL,
    "iron" SMALLINT NOT NULL,
    "black_eye" SMALLINT NOT NULL,
    "tough_luck" SMALLINT NOT NULL,
    "catch" SMALLINT NOT NULL,
    "fog" SMALLINT NOT NULL,
    "famine" SMALLINT NOT NULL,
    "thunderstorm" SMALLINT NOT NULL,
    "tilt" SMALLINT NOT NULL,
    "mythic" SMALLINT NOT NULL,
    "marathon_man" SMALLINT NOT NULL,
    "guerilla" SMALLINT NOT NULL,
    "demon" SMALLINT NOT NULL,
    "cavalier" SMALLINT NOT NULL,
    "askar" SMALLINT NOT NULL,
    "exterminator" SMALLINT NOT NULL,
    "ranger" SMALLINT NOT NULL,
    "vanguard" SMALLINT NOT NULL,
    "orpheus" SMALLINT NOT NULL,
    "reclaimer" SMALLINT NOT NULL,
    "graduate" SMALLINT NOT NULL,
    "unsc_spartan" SMALLINT NOT NULL,
    "spartan_officer" SMALLINT NOT NULL,
    "two_for_one" SMALLINT NOT NULL,
    "triple_kill" SMALLINT NOT NULL,
    "overkill" SMALLINT NOT NULL,
    "lee_r_wilson_memorial" SMALLINT NOT NULL,
    "killing_frenzy" SMALLINT NOT NULL,
    "steppin_razor" SMALLINT NOT NULL,
    "mongoose_mowdown" SMALLINT NOT NULL,
    "up_close_and_personal" SMALLINT NOT NULL,
    "mvp" SMALLINT NOT NULL,
    "maybe_next_time_buddy" SMALLINT NOT NULL,
    "too_close_to_the_sun" SMALLINT NOT NULL,
    "we_re_in_for_some_chop" SMALLINT NOT NULL,
    "fear_the_pink_mist" SMALLINT NOT NULL,
    "headshot_honcho" SMALLINT NOT NULL,
    "used_car_salesman" SMALLINT NOT NULL,

    CONSTRAINT "carnage_report_player_achievements_pkey" PRIMARY KEY ("carnage_report_id","player_index")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_player_damage_statistics" (
    "carnage_report_id" UUID NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "damage_source" VARCHAR NOT NULL,
    "kills" SMALLINT NOT NULL,
    "deaths" SMALLINT NOT NULL,
    "betrayals" SMALLINT NOT NULL,
    "suicides" SMALLINT NOT NULL,
    "headshots" SMALLINT NOT NULL,

    CONSTRAINT "carnage_report_player_damage_statistics_pkey" PRIMARY KEY ("carnage_report_id","player_index","damage_source")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_player_interaction" (
    "carnage_report_id" UUID NOT NULL,
    "left_player_index" SMALLINT NOT NULL,
    "right_player_index" SMALLINT NOT NULL,
    "killed" SMALLINT NOT NULL,
    "killed_by" SMALLINT NOT NULL,

    CONSTRAINT "carnage_report_player_interaction_pkey" PRIMARY KEY ("carnage_report_id","left_player_index","right_player_index")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_player_medals" (
    "carnage_report_id" UUID NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "extermination" SMALLINT NOT NULL,
    "perfection" SMALLINT NOT NULL,
    "multiple_kill_2" SMALLINT NOT NULL,
    "multiple_kill_3" SMALLINT NOT NULL,
    "multiple_kill_4" SMALLINT NOT NULL,
    "multiple_kill_5" SMALLINT NOT NULL,
    "multiple_kill_6" SMALLINT NOT NULL,
    "multiple_kill_7" SMALLINT NOT NULL,
    "multiple_kill_8" SMALLINT NOT NULL,
    "multiple_kill_9" SMALLINT NOT NULL,
    "multiple_kill_10" SMALLINT NOT NULL,
    "kills_in_a_row_5" SMALLINT NOT NULL,
    "kills_in_a_row_10" SMALLINT NOT NULL,
    "kills_in_a_row_15" SMALLINT NOT NULL,
    "kills_in_a_row_20" SMALLINT NOT NULL,
    "kills_in_a_row_25" SMALLINT NOT NULL,
    "kills_in_a_row_30" SMALLINT NOT NULL,
    "sniper_kill_5" SMALLINT NOT NULL,
    "sniper_kill_10" SMALLINT NOT NULL,
    "shotgun_kill_5" SMALLINT NOT NULL,
    "shotgun_kill_10" SMALLINT NOT NULL,
    "collision_kill_5" SMALLINT NOT NULL,
    "collision_kill_10" SMALLINT NOT NULL,
    "sword_kill_5" SMALLINT NOT NULL,
    "sword_kill_10" SMALLINT NOT NULL,
    "juggernaut_kill_5" SMALLINT NOT NULL,
    "juggernaut_kill_10" SMALLINT NOT NULL,
    "zombie_kill_5" SMALLINT NOT NULL,
    "zombie_kill_10" SMALLINT NOT NULL,
    "human_kill_5" SMALLINT NOT NULL,
    "human_kill_10" SMALLINT NOT NULL,
    "human_kill_15" SMALLINT NOT NULL,
    "koth_kill_5" SMALLINT NOT NULL,
    "shotgun_kill_sword" SMALLINT NOT NULL,
    "vehicle_impact_kill" SMALLINT NOT NULL,
    "vehicle_hijack" SMALLINT NOT NULL,
    "aircraft_hijack" SMALLINT NOT NULL,
    "deadplayer_kill" SMALLINT NOT NULL,
    "player_kill_spreeplayer" SMALLINT NOT NULL,
    "spartanlaser_kill" SMALLINT NOT NULL,
    "stickygrenade_kill" SMALLINT NOT NULL,
    "sniper_kill" SMALLINT NOT NULL,
    "bashbehind_kill" SMALLINT NOT NULL,
    "bash_kill" SMALLINT NOT NULL,
    "flame_kill" SMALLINT NOT NULL,
    "driver_assist_gunner" SMALLINT NOT NULL,
    "assault_bomb_planted" SMALLINT NOT NULL,
    "assault_player_kill_carrier" SMALLINT NOT NULL,
    "vip_player_kill_vip" SMALLINT NOT NULL,
    "juggernaut_player_kill_juggernaut" SMALLINT NOT NULL,
    "oddball_carrier_kill_player" SMALLINT NOT NULL,
    "ctf_flag_captured" SMALLINT NOT NULL,
    "ctf_flag_player_kill_carrier" SMALLINT NOT NULL,
    "ctf_flag_carrier_kill_player" SMALLINT NOT NULL,
    "infection_survive" SMALLINT NOT NULL,
    "nemesis" SMALLINT NOT NULL,
    "avenger" SMALLINT NOT NULL,
    "unused3" SMALLINT NOT NULL,

    CONSTRAINT "carnage_report_player_medals_pkey" PRIMARY KEY ("carnage_report_id","player_index")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_player_statistics" (
    "carnage_report_id" UUID NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "games_played" SMALLINT NOT NULL,
    "games_completed" SMALLINT NOT NULL,
    "games_won" SMALLINT NOT NULL,
    "games_tied" SMALLINT NOT NULL,
    "rounds_completed" SMALLINT NOT NULL,
    "rounds_won" SMALLINT NOT NULL,
    "in_round_score" SMALLINT NOT NULL,
    "in_game_total_score" SMALLINT NOT NULL,
    "kills" SMALLINT NOT NULL,
    "assists" SMALLINT NOT NULL,
    "deaths" SMALLINT NOT NULL,
    "betrayals" SMALLINT NOT NULL,
    "suicides" SMALLINT NOT NULL,
    "most_kills_in_a_row" SMALLINT NOT NULL,
    "seconds_alive" SMALLINT NOT NULL,
    "ctf_flag_scores" SMALLINT NOT NULL,
    "ctf_flag_grabs" SMALLINT NOT NULL,
    "ctf_flag_carrier_kills" SMALLINT NOT NULL,
    "ctf_flag_returns" SMALLINT NOT NULL,
    "assault_bomb_arms" SMALLINT NOT NULL,
    "assault_bomb_grabs" SMALLINT NOT NULL,
    "assault_bomb_disarms" SMALLINT NOT NULL,
    "assault_bomb_detonations" SMALLINT NOT NULL,
    "oddball_time_with_ball" SMALLINT NOT NULL,
    "oddball_unused" SMALLINT NOT NULL,
    "oddball_kills_as_carrier" SMALLINT NOT NULL,
    "oddball_ball_carrier_kills" SMALLINT NOT NULL,
    "king_time_on_hill" SMALLINT NOT NULL,
    "king_total_control_time" SMALLINT NOT NULL,
    "king_unused0" SMALLINT NOT NULL,
    "king_unused1" SMALLINT NOT NULL,
    "unused0" SMALLINT NOT NULL,
    "unused1" SMALLINT NOT NULL,
    "unused2" SMALLINT NOT NULL,
    "vip_takedowns" SMALLINT NOT NULL,
    "vip_kills_as_vip" SMALLINT NOT NULL,
    "vip_guard_time" SMALLINT NOT NULL,
    "vip_time_as_vip" SMALLINT NOT NULL,
    "vip_lives_as_vip" SMALLINT NOT NULL,
    "juggernaut_kills" SMALLINT NOT NULL,
    "juggernaut_kills_as_juggernaut" SMALLINT NOT NULL,
    "juggernaut_total_control_time" SMALLINT NOT NULL,
    "total_wp" SMALLINT NOT NULL,
    "juggernaut_unused" SMALLINT NOT NULL,
    "territories_owned" SMALLINT NOT NULL,
    "territories_captures" SMALLINT NOT NULL,
    "territories_ousts" SMALLINT NOT NULL,
    "territories_time_in_territory" SMALLINT NOT NULL,
    "infection_zombie_kills" SMALLINT NOT NULL,
    "infection_infections" SMALLINT NOT NULL,
    "infection_time_as_human" SMALLINT NOT NULL,

    CONSTRAINT "carnage_report_player_statistics_pkey" PRIMARY KEY ("carnage_report_id","player_index")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_team" (
    "team_index" INTEGER NOT NULL,
    "carnage_report_id" UUID NOT NULL,
    "standing" SMALLINT NOT NULL,
    "score" SMALLINT NOT NULL,

    CONSTRAINT "carnage_report_team_pkey" PRIMARY KEY ("team_index","carnage_report_id")
);

-- CreateTable
CREATE TABLE "ares"."carnage_report_team_statistics" (
    "carnage_report_id" UUID NOT NULL,
    "team_index" SMALLINT NOT NULL,
    "games_played" SMALLINT NOT NULL,
    "games_completed" SMALLINT NOT NULL,
    "games_won" SMALLINT NOT NULL,
    "games_tied" SMALLINT NOT NULL,
    "rounds_completed" SMALLINT NOT NULL,
    "rounds_won" SMALLINT NOT NULL,
    "in_round_score" SMALLINT NOT NULL,
    "in_game_total_score" SMALLINT NOT NULL,
    "kills" SMALLINT NOT NULL,
    "assists" SMALLINT NOT NULL,
    "deaths" SMALLINT NOT NULL,
    "betrayals" SMALLINT NOT NULL,
    "suicides" SMALLINT NOT NULL,
    "most_kills_in_a_row" SMALLINT NOT NULL,
    "seconds_alive" SMALLINT NOT NULL,
    "ctf_flag_scores" SMALLINT NOT NULL,
    "ctf_flag_grabs" SMALLINT NOT NULL,
    "ctf_flag_carrier_kills" SMALLINT NOT NULL,
    "ctf_flag_returns" SMALLINT NOT NULL,
    "assault_bomb_arms" SMALLINT NOT NULL,
    "assault_bomb_grabs" SMALLINT NOT NULL,
    "assault_bomb_disarms" SMALLINT NOT NULL,
    "assault_bomb_detonations" SMALLINT NOT NULL,
    "oddball_time_with_ball" SMALLINT NOT NULL,
    "oddball_unused" SMALLINT NOT NULL,
    "oddball_kills_as_carrier" SMALLINT NOT NULL,
    "oddball_ball_carrier_kills" SMALLINT NOT NULL,
    "king_time_on_hill" SMALLINT NOT NULL,
    "king_total_control_time" SMALLINT NOT NULL,
    "king_unused0" SMALLINT NOT NULL,
    "king_unused1" SMALLINT NOT NULL,
    "unused0" SMALLINT NOT NULL,
    "unused1" SMALLINT NOT NULL,
    "unused2" SMALLINT NOT NULL,
    "vip_takedowns" SMALLINT NOT NULL,
    "vip_kills_as_vip" SMALLINT NOT NULL,
    "vip_guard_time" SMALLINT NOT NULL,
    "vip_time_as_vip" SMALLINT NOT NULL,
    "vip_lives_as_vip" SMALLINT NOT NULL,
    "juggernaut_kills" SMALLINT NOT NULL,
    "juggernaut_kills_as_juggernaut" SMALLINT NOT NULL,
    "juggernaut_total_control_time" SMALLINT NOT NULL,
    "total_wp" SMALLINT NOT NULL,
    "juggernaut_unused" SMALLINT NOT NULL,
    "territories_owned" SMALLINT NOT NULL,
    "territories_captures" SMALLINT NOT NULL,
    "territories_ousts" SMALLINT NOT NULL,
    "territories_time_in_territory" SMALLINT NOT NULL,
    "infection_zombie_kills" SMALLINT NOT NULL,
    "infection_infections" SMALLINT NOT NULL,
    "infection_time_as_human" SMALLINT NOT NULL,

    CONSTRAINT "carnage_report_team_statistics_pkey" PRIMARY KEY ("carnage_report_id","team_index")
);

-- CreateTable
CREATE TABLE "ares"."service_record" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "player_name" VARCHAR(16) NOT NULL,
    "appearance_flags" SMALLINT NOT NULL,
    "primary_color" SMALLINT NOT NULL,
    "secondary_color" SMALLINT NOT NULL,
    "tertiary_color" SMALLINT NOT NULL,
    "is_elite" SMALLINT NOT NULL,
    "foreground_emblem" SMALLINT NOT NULL,
    "background_emblem" SMALLINT NOT NULL,
    "emblem_flags" SMALLINT NOT NULL,
    "emblem_primary_color" SMALLINT NOT NULL,
    "emblem_secondary_color" SMALLINT NOT NULL,
    "emblem_background_color" SMALLINT NOT NULL,
    "spartan_helmet" SMALLINT NOT NULL,
    "spartan_left_shoulder" SMALLINT NOT NULL,
    "spartan_right_shoulder" SMALLINT NOT NULL,
    "spartan_body" SMALLINT NOT NULL,
    "elite_helmet" SMALLINT NOT NULL,
    "elite_left_shoulder" SMALLINT NOT NULL,
    "elite_right_shoulder" SMALLINT NOT NULL,
    "elite_body" SMALLINT NOT NULL,
    "service_tag" VARCHAR(5) NOT NULL,
    "campaign_progress" INTEGER NOT NULL,
    "highest_skill" INTEGER NOT NULL,
    "total_exp" INTEGER NOT NULL,
    "experience_base" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "grade" INTEGER NOT NULL,
    "games_completed" INTEGER NOT NULL,
    "first_played" TIMESTAMP(6) NOT NULL,
    "last_played" TIMESTAMP(6) NOT NULL,
    "bungienet_user_flags" DECIMAL(20,0) NOT NULL,
    "is_silver_or_gold_live" BOOLEAN NOT NULL,
    "is_online_enabled" BOOLEAN NOT NULL,
    "gamer_region" INTEGER NOT NULL,
    "cheat_flags" DECIMAL(20,0) NOT NULL,
    "ban_flags" DECIMAL(20,0) NOT NULL,
    "matchmade_ranked_games_played" DECIMAL(20,0) NOT NULL,
    "matchmade_ranked_games_completed" DECIMAL(20,0) NOT NULL,
    "matchmade_ranked_games_won" DECIMAL(20,0) NOT NULL,
    "matchmade_unranked_games_played" DECIMAL(20,0) NOT NULL,
    "matchmade_unranked_games_completed" DECIMAL(20,0) NOT NULL,
    "custom_games_completed" DECIMAL(20,0) NOT NULL,

    CONSTRAINT "service_record_pkey" PRIMARY KEY ("player_xuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_start_finish_game" ON "ares"."carnage_report"("start_time", "finish_time", "game_id");

-- CreateIndex
CREATE INDEX "idx_player_name" ON "ares"."carnage_report_player"("player_name");

-- CreateIndex
CREATE INDEX "idx_player_xuid" ON "ares"."carnage_report_player"("player_xuid");

-- CreateIndex
CREATE INDEX "idx_service_record_player_name" ON "ares"."service_record"("player_name");

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_event_carry" ADD CONSTRAINT "carnage_report_event_carry_carnage_report_id_carry_player__fkey" FOREIGN KEY ("carnage_report_id", "carry_player_index") REFERENCES "ares"."carnage_report_player"("carnage_report_id", "player_index") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_event_carry" ADD CONSTRAINT "carnage_report_event_carry_carnage_report_id_fkey" FOREIGN KEY ("carnage_report_id") REFERENCES "ares"."carnage_report"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_event_kill" ADD CONSTRAINT "carnage_report_event_kill_carnage_report_id_dead_player_in_fkey" FOREIGN KEY ("carnage_report_id", "dead_player_index") REFERENCES "ares"."carnage_report_player"("carnage_report_id", "player_index") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_event_kill" ADD CONSTRAINT "carnage_report_event_kill_carnage_report_id_fkey" FOREIGN KEY ("carnage_report_id") REFERENCES "ares"."carnage_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_event_kill" ADD CONSTRAINT "carnage_report_event_kill_carnage_report_id_killer_player__fkey" FOREIGN KEY ("carnage_report_id", "killer_player_index") REFERENCES "ares"."carnage_report_player"("carnage_report_id", "player_index") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_event_score" ADD CONSTRAINT "carnage_report_event_score_carnage_report_id_fkey" FOREIGN KEY ("carnage_report_id") REFERENCES "ares"."carnage_report"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_event_score" ADD CONSTRAINT "carnage_report_event_score_carnage_report_id_score_player__fkey" FOREIGN KEY ("carnage_report_id", "score_player_index") REFERENCES "ares"."carnage_report_player"("carnage_report_id", "player_index") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_game_variant" ADD CONSTRAINT "fk_carnage_report" FOREIGN KEY ("id") REFERENCES "ares"."carnage_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_machine" ADD CONSTRAINT "fk_carnage_report" FOREIGN KEY ("carnage_report_id") REFERENCES "ares"."carnage_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_matchmaking_options" ADD CONSTRAINT "carnage_report_matchmaking_options_id_fkey" FOREIGN KEY ("id") REFERENCES "ares"."carnage_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_player" ADD CONSTRAINT "carnage_report_player_carnage_report_id_fkey" FOREIGN KEY ("carnage_report_id") REFERENCES "ares"."carnage_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_player" ADD CONSTRAINT "carnage_report_player_machine_index_carnage_report_id_fkey" FOREIGN KEY ("machine_index", "carnage_report_id") REFERENCES "ares"."carnage_report_machine"("machine_index", "carnage_report_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_player_achievements" ADD CONSTRAINT "fk_achievements_carnage_report_player" FOREIGN KEY ("carnage_report_id", "player_index") REFERENCES "ares"."carnage_report_player"("carnage_report_id", "player_index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_player_damage_statistics" ADD CONSTRAINT "fk_damage_statistics_carnage_report_player" FOREIGN KEY ("carnage_report_id", "player_index") REFERENCES "ares"."carnage_report_player"("carnage_report_id", "player_index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_player_interaction" ADD CONSTRAINT "carnage_report_player_interac_left_player_index_carnage_re_fkey" FOREIGN KEY ("left_player_index", "carnage_report_id") REFERENCES "ares"."carnage_report_player"("player_index", "carnage_report_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_player_interaction" ADD CONSTRAINT "carnage_report_player_interac_right_player_index_carnage_r_fkey" FOREIGN KEY ("right_player_index", "carnage_report_id") REFERENCES "ares"."carnage_report_player"("player_index", "carnage_report_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_player_medals" ADD CONSTRAINT "carnage_report_player_medals_carnage_report_id_fkey" FOREIGN KEY ("carnage_report_id") REFERENCES "ares"."carnage_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_player_medals" ADD CONSTRAINT "carnage_report_player_medals_carnage_report_id_player_inde_fkey" FOREIGN KEY ("carnage_report_id", "player_index") REFERENCES "ares"."carnage_report_player"("carnage_report_id", "player_index") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_player_statistics" ADD CONSTRAINT "fk_statistics_carnage_report_player" FOREIGN KEY ("carnage_report_id", "player_index") REFERENCES "ares"."carnage_report_player"("carnage_report_id", "player_index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_team" ADD CONSTRAINT "carnage_report_team_carnage_report_id_fkey" FOREIGN KEY ("carnage_report_id") REFERENCES "ares"."carnage_report"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ares"."carnage_report_team_statistics" ADD CONSTRAINT "fk_statistics_carnage_report_team" FOREIGN KEY ("carnage_report_id", "team_index") REFERENCES "ares"."carnage_report_team"("carnage_report_id", "team_index") ON DELETE CASCADE ON UPDATE NO ACTION;
