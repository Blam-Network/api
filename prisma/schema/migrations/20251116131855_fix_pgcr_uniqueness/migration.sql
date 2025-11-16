/*
  Warnings:

  - A unique constraint covering the columns `[start_time,game_id,map_id,total_elapsed_tick_count]` on the table `campaign_carnage_report` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[start_time,map_id,game_id]` on the table `carnage_report` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "halo3"."campaign_carnage_report_game_id_map_id_total_elapsed_tick_c_key";

-- DropIndex
DROP INDEX "halo3"."unique_start_finish_game";

-- CreateIndex
CREATE UNIQUE INDEX "campaign_carnage_report_start_time_game_id_map_id_total_ela_key" ON "halo3"."campaign_carnage_report"("start_time", "game_id", "map_id", "total_elapsed_tick_count");

-- CreateIndex
CREATE UNIQUE INDEX "unique_start_map_game" ON "halo3"."carnage_report"("start_time", "map_id", "game_id");
