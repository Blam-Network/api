-- CreateTable
CREATE TABLE "reach"."player_challenge_progress" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "challenge_set" INTEGER NOT NULL,
    "challenge_index" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_challenge_progress_pkey" PRIMARY KEY ("player_xuid","challenge_set","challenge_index")
);

-- CreateIndex
CREATE INDEX "player_challenge_progress_player_xuid_idx" ON "reach"."player_challenge_progress"("player_xuid");
