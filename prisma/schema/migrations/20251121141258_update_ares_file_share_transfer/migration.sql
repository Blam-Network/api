/*
  Warnings:

  - You are about to drop the column `is_odst` on the `file_share_transfer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[start_time,game_id,map_id,total_elapsed_tick_count]` on the table `campaign_carnage_report` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "halo3"."campaign_carnage_report_game_id_map_id_total_elapsed_tick_c_key";

-- AlterTable
ALTER TABLE "ares"."file_share_transfer" DROP COLUMN "is_odst";

-- CreateIndex
CREATE UNIQUE INDEX "campaign_carnage_report_start_time_game_id_map_id_total_ela_key" ON "halo3"."campaign_carnage_report"("start_time", "game_id", "map_id", "total_elapsed_tick_count");
