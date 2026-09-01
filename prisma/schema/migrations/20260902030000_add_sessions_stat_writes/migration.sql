-- CreateTable
CREATE TABLE "ares"."sessions_stat_writes" (
    "id" BIGSERIAL NOT NULL,
    "session_id" VARCHAR(17) NOT NULL,
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "leaderboard_id" DECIMAL(20,0) NOT NULL,
    "properties" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_stat_writes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_stat_writes_session_id_idx" ON "ares"."sessions_stat_writes"("session_id");
