-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "reach";

-- CreateTable
CREATE TABLE "reach"."player_data_reach" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "hopper_access" INTEGER DEFAULT 0,
    "hopper_directory_override" VARCHAR(32),

    CONSTRAINT "player_data_reach_pkey" PRIMARY KEY ("player_xuid")
);
