/*
  Warnings:

  - You are about to drop the `player_data_reach` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ares";

-- DropTable
DROP TABLE "reach"."player_data_reach";

-- CreateTable
CREATE TABLE "reach"."player_data" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "hopper_access" INTEGER DEFAULT 0,
    "hopper_directory_override" VARCHAR(32),

    CONSTRAINT "player_data_pkey" PRIMARY KEY ("player_xuid")
);

-- CreateTable
CREATE TABLE "ares"."player_data" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "hopper_access" INTEGER DEFAULT 0,
    "highest_skill" INTEGER DEFAULT 0,
    "is_bungie" BOOLEAN DEFAULT false,
    "is_pro" BOOLEAN DEFAULT false,
    "has_recon" BOOLEAN DEFAULT false,
    "hopper_directory_override" VARCHAR(32),

    CONSTRAINT "player_data_pkey" PRIMARY KEY ("player_xuid")
);

-- CreateTable
CREATE TABLE "ares"."file_share" (
    "share_id" DECIMAL(20,0) NOT NULL,
    "quota_slots" SMALLINT,
    "quota_bytes" INTEGER,
    "message" TEXT,
    "lastHash" INTEGER NOT NULL DEFAULT 0,
    "unsubscribe_stage" SMALLINT,

    CONSTRAINT "file_share_pkey" PRIMARY KEY ("share_id")
);

-- CreateTable
CREATE TABLE "ares"."file_share_slot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "share_id" DECIMAL(20,0) NOT NULL,
    "slot" SMALLINT NOT NULL,
    "compressed_size" INTEGER NOT NULL,
    "unique_id" DECIMAL(20,0) NOT NULL,
    "name" VARCHAR(16),
    "description" VARCHAR(128),
    "author" VARCHAR(16),
    "file_type" INTEGER NOT NULL,
    "author_is_xuid_online" BOOLEAN,
    "author_id" DECIMAL(20,0),
    "size_in_bytes" DECIMAL(20,0) NOT NULL,
    "date" TIMESTAMP(6),
    "length_seconds" INTEGER,
    "map_id" INTEGER,
    "game_engine_type" INTEGER,
    "campaign_id" INTEGER,
    "campaign_difficulty" INTEGER,
    "campaign_insertion_point" SMALLINT,
    "hopper_id" SMALLINT,
    "game_id" DECIMAL(20,0),

    CONSTRAINT "file_share_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ares"."blind_screenshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unique_id" DECIMAL(20,0),
    "name" VARCHAR(16) NOT NULL,
    "description" VARCHAR(128) NOT NULL,
    "author" VARCHAR(16) NOT NULL,
    "file_type" INTEGER NOT NULL,
    "author_is_xuid_online" BOOLEAN NOT NULL,
    "author_id" DECIMAL(20,0) NOT NULL,
    "size_in_bytes" DECIMAL(20,0) NOT NULL,
    "date" TIMESTAMP(6) NOT NULL,
    "length_seconds" INTEGER NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "map_id" INTEGER NOT NULL,
    "game_engine_type" INTEGER NOT NULL,
    "campaign_difficulty" INTEGER NOT NULL,
    "hopper_id" SMALLINT NOT NULL,
    "game_id" DECIMAL(20,0) NOT NULL,
    "game_tick" INTEGER NOT NULL,
    "film_tick" INTEGER NOT NULL,
    "jpeg_length" INTEGER NOT NULL,
    "camera_position" DOUBLE PRECISION[],
    "pixel_width" SMALLINT NOT NULL,
    "pixel_height" SMALLINT NOT NULL,

    CONSTRAINT "blind_screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_share_id_slot" ON "ares"."file_share_slot"("share_id", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "unique_unique_id_date" ON "ares"."blind_screenshot"("unique_id", "date", "game_id");
