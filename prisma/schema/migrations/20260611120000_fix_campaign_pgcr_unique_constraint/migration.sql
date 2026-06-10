/*
  Campaign PGCR start_time is derived from server clock at upload time, not from game data.
  The previous unique index included start_time, so concurrent uploads for the same session
  could insert duplicate rows with slightly different start_times.
*/
-- Remove duplicate campaign carnage reports, keeping the latest finish_time per session.
DELETE FROM "halo3"."campaign_carnage_report"
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY game_id, map_id, total_elapsed_tick_count
                ORDER BY finish_time DESC, id
            ) AS row_num
        FROM "halo3"."campaign_carnage_report"
    ) duplicates
    WHERE row_num > 1
);

-- DropIndex
DROP INDEX IF EXISTS "halo3"."campaign_carnage_report_start_time_game_id_map_id_total_ela_key";

-- CreateIndex
CREATE UNIQUE INDEX "campaign_carnage_report_game_id_map_id_total_elapsed_tick_c_key" ON "halo3"."campaign_carnage_report"("game_id", "map_id", "total_elapsed_tick_count");
