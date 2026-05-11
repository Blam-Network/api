-- CreateTable
CREATE TABLE "reach"."service_record" (
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
    "model_permutations_1" SMALLINT NOT NULL,
    "model_permutations_2" SMALLINT NOT NULL,
    "model_permutations_3" SMALLINT NOT NULL,
    "model_permutations_4" SMALLINT NOT NULL,
    "model_permutations_5" SMALLINT NOT NULL,
    "model_permutations_6" SMALLINT NOT NULL,
    "model_permutations_7" SMALLINT NOT NULL,
    "model_permutations_8" SMALLINT NOT NULL,
    "non_model_customization_1" SMALLINT NOT NULL,
    "non_model_customization_2" SMALLINT NOT NULL,
    "non_model_customization_3" SMALLINT NOT NULL,
    "non_model_customization_4" SMALLINT NOT NULL,
    "service_tag" VARCHAR(5) NOT NULL,
    "campaign_progress" INTEGER NOT NULL,
    "supply_depot_pct" SMALLINT NOT NULL,
    "commendation_unlock_pct" SMALLINT NOT NULL,
    "grade" SMALLINT NOT NULL,
    "sub_grade" SMALLINT NOT NULL,
    "cheat_flags" DECIMAL(20,0) NOT NULL,
    "ban_flags" DECIMAL(20,0) NOT NULL,
    "matchmade_games_played" INTEGER NOT NULL,

    CONSTRAINT "service_record_pkey" PRIMARY KEY ("player_xuid")
);

-- CreateIndex
CREATE INDEX "idx_service_record_player_name" ON "reach"."service_record"("player_name");
