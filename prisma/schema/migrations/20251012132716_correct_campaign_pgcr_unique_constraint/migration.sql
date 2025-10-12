/*
  Warnings:

  - A unique constraint covering the columns `[game_id,map_id,total_elapsed_tick_count]` on the table `campaign_carnage_report` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "halo3"."campaign_carnage_report_start_time_finish_time_game_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "campaign_carnage_report_game_id_map_id_total_elapsed_tick_c_key" ON "halo3"."campaign_carnage_report"("game_id", "map_id", "total_elapsed_tick_count");
