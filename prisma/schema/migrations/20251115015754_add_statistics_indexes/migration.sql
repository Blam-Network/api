BEGIN;

-- Composite index on carnage_report_player for queries filtering by carnage_report_id AND player_name
-- This is used frequently in the statistics endpoint to find players in specific games
CREATE INDEX IF NOT EXISTS "idx_carnage_report_player_carnage_report_id_player_name" 
ON "halo3"."carnage_report_player" ("carnage_report_id", "player_name");

-- Index on carnage_report_event_kill for queries filtering by carnage_report_id
-- Used to fetch all kill events for a set of games
CREATE INDEX IF NOT EXISTS "idx_carnage_report_event_kill_carnage_report_id" 
ON "halo3"."carnage_report_event_kill" ("carnage_report_id");

-- Index on carnage_report_player_statistics for queries filtering by carnage_report_id
-- Used to fetch statistics for all players in a set of games
CREATE INDEX IF NOT EXISTS "idx_carnage_report_player_statistics_carnage_report_id" 
ON "halo3"."carnage_report_player_statistics" ("carnage_report_id");

-- Index on carnage_report.start_time for activity heatmap queries
-- Used to filter games by start_time >= date
CREATE INDEX IF NOT EXISTS "idx_carnage_report_start_time" 
ON "halo3"."carnage_report" ("start_time");

-- Index on campaign_carnage_report.start_time for activity heatmap queries
CREATE INDEX IF NOT EXISTS "idx_campaign_carnage_report_start_time" 
ON "halo3"."campaign_carnage_report" ("start_time");

-- Same indexes for ares schema
CREATE INDEX IF NOT EXISTS "idx_carnage_report_player_carnage_report_id_player_name" 
ON "ares"."carnage_report_player" ("carnage_report_id", "player_name");

CREATE INDEX IF NOT EXISTS "idx_carnage_report_event_kill_carnage_report_id" 
ON "ares"."carnage_report_event_kill" ("carnage_report_id");

CREATE INDEX IF NOT EXISTS "idx_carnage_report_player_statistics_carnage_report_id" 
ON "ares"."carnage_report_player_statistics" ("carnage_report_id");

CREATE INDEX IF NOT EXISTS "idx_carnage_report_start_time" 
ON "ares"."carnage_report" ("start_time");

COMMIT;

