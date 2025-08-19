/*
  Warnings:

  - The primary key for the `player_data` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `service_record` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "halo3"."blind_screenshot" ALTER COLUMN "unique_id" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "author_id" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "size_in_bytes" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "game_id" SET DATA TYPE DECIMAL(20,0);

-- AlterTable
ALTER TABLE "halo3"."carnage_report" ALTER COLUMN "game_id" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "game_variant_unique_id" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "map_variant_unique_id" SET DATA TYPE DECIMAL(20,0);

-- AlterTable
ALTER TABLE "halo3"."carnage_report_event_carry" ALTER COLUMN "time" SET DATA TYPE DECIMAL(20,0);

-- AlterTable
ALTER TABLE "halo3"."carnage_report_event_kill" ALTER COLUMN "time" SET DATA TYPE DECIMAL(20,0);

-- AlterTable
ALTER TABLE "halo3"."carnage_report_event_score" ALTER COLUMN "time" SET DATA TYPE DECIMAL(20,0);

-- AlterTable
ALTER TABLE "halo3"."carnage_report_game_variant" ALTER COLUMN "unique_id" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "author_id" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "size_in_bytes" SET DATA TYPE DECIMAL(20,0);

-- AlterTable
ALTER TABLE "halo3"."carnage_report_machine" ALTER COLUMN "session_party_nonce" SET DATA TYPE DECIMAL(20,0);

-- AlterTable
ALTER TABLE "halo3"."carnage_report_matchmaking_options" ALTER COLUMN "draw_probability" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "experience_base_increment" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "experience_penalty_decrement" SET DATA TYPE DECIMAL(20,0);

-- AlterTable
ALTER TABLE "halo3"."carnage_report_player" ALTER COLUMN "player_identifier" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "player_xuid" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "bungienet_user_flags" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "cheat_flags" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "ban_flags" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "matchmade_ranked_games_played" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "matchmade_ranked_games_completed" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "matchmade_ranked_games_won" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "matchmade_unranked_games_played" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "matchmade_unranked_games_completed" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "hopper_experience_base" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "custom_games_completed" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "hopper_experience_penalty" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "global_statistics_highest_skill" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "global_statistics_experience_base" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "global_statistics_experience_penalty" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "hopper_statistics_hopper_skill" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "hopper_statistics_games_won" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "hopper_statistics_games_played" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "hopper_statistics_games_completed" SET DATA TYPE DECIMAL(20,0);

-- AlterTable
ALTER TABLE "halo3"."player_data" DROP CONSTRAINT "player_data_pkey",
ALTER COLUMN "player_xuid" SET DATA TYPE DECIMAL(20,0),
ADD CONSTRAINT "player_data_pkey" PRIMARY KEY ("player_xuid");

-- AlterTable
ALTER TABLE "halo3"."service_record" DROP CONSTRAINT "service_record_pkey",
ALTER COLUMN "player_xuid" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "bungienet_user_flags" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "cheat_flags" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "ban_flags" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "matchmade_ranked_games_played" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "matchmade_ranked_games_completed" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "matchmade_ranked_games_won" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "matchmade_unranked_games_played" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "matchmade_unranked_games_completed" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "custom_games_completed" SET DATA TYPE DECIMAL(20,0),
ADD CONSTRAINT "service_record_pkey" PRIMARY KEY ("player_xuid");

-- AlterTable
ALTER TABLE "odst"."blind_screenshot" ALTER COLUMN "unique_id" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "author_id" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "size_in_bytes" SET DATA TYPE DECIMAL(20,0),
ALTER COLUMN "game_id" SET DATA TYPE DECIMAL(20,0);
