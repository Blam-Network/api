-- CreateTable
CREATE TABLE "reach"."game" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_instance" DECIMAL(20,0) NOT NULL,
    "build_string" VARCHAR(32) NOT NULL,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gui_game_mode" SMALLINT NOT NULL,
    "game_engine" SMALLINT NOT NULL,
    "game_engine_category" SMALLINT NOT NULL,
    "game_mode" SMALLINT NOT NULL,
    "team_game" BOOLEAN NOT NULL,
    "started" BOOLEAN NOT NULL,
    "start_time" TIMESTAMP(6) NOT NULL,
    "finished" BOOLEAN NOT NULL,
    "finish_time" TIMESTAMP(6) NOT NULL,
    "game_end_reason" SMALLINT NOT NULL,
    "map_id" INTEGER NOT NULL,
    "map_variant_name" VARCHAR(32) NOT NULL,
    "map_variant_unique_id" DECIMAL(20,0) NOT NULL,
    "scenario_path" VARCHAR(260) NOT NULL,
    "game_variant_name" VARCHAR(128) NOT NULL,
    "game_variant_description" VARCHAR(256) NOT NULL,
    "game_variant_unique_id" DECIMAL(20,0) NOT NULL,
    "game_variant_icon_index" SMALLINT NOT NULL,
    "custom_statistic_names" TEXT[],
    "custom_statistic_formats" INTEGER[],
    "campaign_difficulty" SMALLINT NOT NULL,
    "initial_skulls" DECIMAL(10,0) NOT NULL,
    "round_time_limit_seconds" INTEGER NOT NULL,
    "score_to_win_round" INTEGER NOT NULL,
    "number_of_rounds" INTEGER NOT NULL,
    "hopper_identifier" INTEGER,
    "hopper_name" VARCHAR(32),
    "hopper_ranked" BOOLEAN,
    "survival_sets_completed" INTEGER NOT NULL,
    "survival_full_rounds_completed" INTEGER NOT NULL,
    "survival_waves_completed" INTEGER NOT NULL,

    CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reach"."game_team" (
    "game_id" UUID NOT NULL,
    "team_index" SMALLINT NOT NULL,
    "standing" SMALLINT NOT NULL,
    "score" INTEGER NOT NULL,
    "statistics" INTEGER[],

    CONSTRAINT "game_team_pkey" PRIMARY KEY ("game_id","team_index")
);

-- CreateTable
CREATE TABLE "reach"."game_player" (
    "game_id" UUID NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "player_name" VARCHAR(16) NOT NULL,
    "service_tag" VARCHAR(5) NOT NULL,
    "team" SMALLINT NOT NULL,
    "standing" SMALLINT NOT NULL,
    "score" INTEGER NOT NULL,
    "player_rating" INTEGER NOT NULL,
    "ticks_played" INTEGER NOT NULL,
    "grade" SMALLINT NOT NULL,
    "sub_grade" SMALLINT NOT NULL,
    "is_elite" BOOLEAN NOT NULL,
    "primary_color" SMALLINT NOT NULL,
    "secondary_color" SMALLINT NOT NULL,
    "tertiary_color" SMALLINT NOT NULL,
    "foreground_emblem" SMALLINT NOT NULL,
    "background_emblem" SMALLINT NOT NULL,
    "emblem_flags" SMALLINT NOT NULL,
    "emblem_primary_color" SMALLINT NOT NULL,
    "emblem_secondary_color" SMALLINT NOT NULL,
    "emblem_background_color" SMALLINT NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "betrayals" INTEGER NOT NULL,
    "suicides" INTEGER NOT NULL,
    "most_kills_in_a_row" INTEGER NOT NULL,
    "seconds_alive" INTEGER NOT NULL,
    "statistics" INTEGER[],
    "medals" INTEGER[],
    "reward_statistics" INTEGER[],
    "campaign_metagame_final_score" INTEGER NOT NULL,

    CONSTRAINT "game_player_pkey" PRIMARY KEY ("game_id","player_index")
);

-- CreateTable
CREATE TABLE "reach"."game_player_weapon" (
    "game_id" UUID NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "damage_type" SMALLINT NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "betrayals" INTEGER NOT NULL,
    "suicides" INTEGER NOT NULL,
    "headshots" INTEGER NOT NULL,

    CONSTRAINT "game_player_weapon_pkey" PRIMARY KEY ("game_id","player_index","damage_type")
);

-- CreateTable
CREATE TABLE "reach"."game_player_versus" (
    "game_id" UUID NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "opponent_index" SMALLINT NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,

    CONSTRAINT "game_player_versus_pkey" PRIMARY KEY ("game_id","player_index","opponent_index")
);

-- CreateTable
CREATE TABLE "reach"."game_player_ai" (
    "game_id" UUID NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "bucket_type" SMALLINT NOT NULL,
    "bucket_class" SMALLINT NOT NULL,
    "kills" INTEGER NOT NULL,
    "betrayals" INTEGER NOT NULL,

    CONSTRAINT "game_player_ai_pkey" PRIMARY KEY ("game_id","player_index","bucket_type","bucket_class")
);

-- CreateTable
CREATE TABLE "reach"."game_event" (
    "game_id" UUID NOT NULL,
    "event_index" SMALLINT NOT NULL,
    "time" INTEGER NOT NULL,
    "event_type" SMALLINT NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "victim_index_or_bucket_type" SMALLINT NOT NULL,
    "bucket_class" SMALLINT NOT NULL,
    "damage_type" SMALLINT NOT NULL,
    "victim_damage_type" SMALLINT NOT NULL,
    "points" SMALLINT NOT NULL,
    "player_position" DOUBLE PRECISION[],
    "victim_position" DOUBLE PRECISION[],

    CONSTRAINT "game_event_pkey" PRIMARY KEY ("game_id","event_index")
);

-- CreateTable
CREATE TABLE "reach"."game_medal_event" (
    "game_id" UUID NOT NULL,
    "event_index" SMALLINT NOT NULL,
    "time" INTEGER NOT NULL,
    "player_index" SMALLINT NOT NULL,
    "medal" SMALLINT NOT NULL,
    "player_position" DOUBLE PRECISION[],

    CONSTRAINT "game_medal_event_pkey" PRIMARY KEY ("game_id","event_index")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_game_instance_key" ON "reach"."game"("game_instance");

-- CreateIndex
CREATE INDEX "game_start_time_idx" ON "reach"."game"("start_time");

-- CreateIndex
CREATE INDEX "game_finish_time_idx" ON "reach"."game"("finish_time");

-- CreateIndex
CREATE INDEX "game_map_id_idx" ON "reach"."game"("map_id");

-- CreateIndex
CREATE INDEX "game_player_player_xuid_idx" ON "reach"."game_player"("player_xuid");

-- CreateIndex
CREATE INDEX "game_player_player_name_idx" ON "reach"."game_player"("player_name");

-- AddForeignKey
ALTER TABLE "reach"."game_team" ADD CONSTRAINT "game_team_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "reach"."game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reach"."game_player" ADD CONSTRAINT "game_player_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "reach"."game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reach"."game_player_weapon" ADD CONSTRAINT "game_player_weapon_game_id_player_index_fkey" FOREIGN KEY ("game_id", "player_index") REFERENCES "reach"."game_player"("game_id", "player_index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reach"."game_player_versus" ADD CONSTRAINT "game_player_versus_game_id_player_index_fkey" FOREIGN KEY ("game_id", "player_index") REFERENCES "reach"."game_player"("game_id", "player_index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reach"."game_player_ai" ADD CONSTRAINT "game_player_ai_game_id_player_index_fkey" FOREIGN KEY ("game_id", "player_index") REFERENCES "reach"."game_player"("game_id", "player_index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reach"."game_event" ADD CONSTRAINT "game_event_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "reach"."game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reach"."game_medal_event" ADD CONSTRAINT "game_medal_event_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "reach"."game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

