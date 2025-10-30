-- CreateTable
CREATE TABLE "reach"."player_rewards" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "credits" INTEGER NOT NULL,

    CONSTRAINT "player_rewards_pkey" PRIMARY KEY ("player_xuid")
);
