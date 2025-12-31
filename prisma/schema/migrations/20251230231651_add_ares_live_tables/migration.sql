-- CreateTable
CREATE TABLE "ares"."sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "secure_address" BYTEA NOT NULL,
    "identifier" BYTEA NOT NULL,
    "key" BYTEA NOT NULL,
    "nonce" DECIMAL(20,0) NOT NULL,
    "usable_address" VARCHAR(15) NOT NULL,
    "uses_presence" BOOLEAN NOT NULL,
    "uses_stats" BOOLEAN NOT NULL,
    "uses_matchmaking" BOOLEAN NOT NULL,
    "uses_arbitration" BOOLEAN NOT NULL,
    "multiplayer" BOOLEAN NOT NULL,
    "invites_disabled" BOOLEAN NOT NULL,
    "join_via_presence_disabled" BOOLEAN NOT NULL,
    "join_in_progress_disabled" BOOLEAN NOT NULL,
    "join_via_presence_friends_only" BOOLEAN NOT NULL,
    "max_public_slots" INTEGER NOT NULL,
    "max_private_slots" INTEGER NOT NULL,
    "creator_xuid" DECIMAL(20,0) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ares"."session_players" (
    "xuid" DECIMAL(20,0) NOT NULL,
    "session_id" VARCHAR(16) NOT NULL,
    "secure_address" VARCHAR(640) NOT NULL,
    "joined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_players_pkey" PRIMARY KEY ("secure_address")
);

-- CreateTable
CREATE TABLE "ares"."player_stats_hopper" (
    "leaderboard_id" DECIMAL(20,0) NOT NULL,
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "skill" INTEGER NOT NULL,
    "games_completed" INTEGER NOT NULL,
    "games_played" INTEGER NOT NULL,
    "games_won" INTEGER NOT NULL,
    "exp_base" INTEGER NOT NULL,
    "exp_penalty" INTEGER NOT NULL,

    CONSTRAINT "player_stats_hopper_pkey" PRIMARY KEY ("leaderboard_id","player_xuid")
);

-- CreateTable
CREATE TABLE "ares"."player_stats_hopper_skill" (
    "leaderboard_id" DECIMAL(20,0) NOT NULL,
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "mu" DOUBLE PRECISION NOT NULL,
    "sigma" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "player_stats_hopper_skill_pkey" PRIMARY KEY ("leaderboard_id","player_xuid")
);

-- CreateTable
CREATE TABLE "ares"."player_stats_global" (
    "leaderboard_id" DECIMAL(20,0) NOT NULL,
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "custom_games_completed" INTEGER,
    "custom_games_won" INTEGER,
    "experience_base" INTEGER,
    "experience_penalty" INTEGER,
    "highest_skill_level_attained" INTEGER,
    "matchmade_ranked_games_completed" INTEGER,
    "matchmade_ranked_games_played" INTEGER,
    "matchmade_ranked_games_won" INTEGER,
    "matchmade_unranked_games_completed" INTEGER,
    "matchmade_unranked_games_played" INTEGER,
    "matchmade_unranked_games_won" INTEGER,
    "first_game_played_date" DECIMAL(20,0),
    "last_game_played_date" DECIMAL(20,0),

    CONSTRAINT "player_stats_global_pkey" PRIMARY KEY ("leaderboard_id","player_xuid")
);

-- CreateIndex
CREATE INDEX "sessions_uses_matchmaking_created_at_idx" ON "ares"."sessions"("uses_matchmaking", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "session_players_xuid_session_id_key" ON "ares"."session_players"("xuid", "session_id");
