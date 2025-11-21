/*
  Warnings:

  - A unique constraint covering the columns `[game_id,map_id,total_elapsed_tick_count]` on the table `campaign_carnage_report` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "halo3"."campaign_carnage_report_start_time_game_id_map_id_total_ela_key";

-- AlterTable
ALTER TABLE "ares"."file_share_slot" ADD COLUMN     "is_uploaded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ares"."file_share_transfer" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "file_id" UUID NOT NULL,
    "is_odst" BOOLEAN NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "file_share_transfer_player_xuid_file_id_key" ON "ares"."file_share_transfer"("player_xuid", "file_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_carnage_report_game_id_map_id_total_elapsed_tick_c_key" ON "halo3"."campaign_carnage_report"("game_id", "map_id", "total_elapsed_tick_count");

-- AddForeignKey
ALTER TABLE "ares"."file_share_transfer" ADD CONSTRAINT "file_share_transfer_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "ares"."file_share_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
