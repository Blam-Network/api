/*
  Warnings:

  - The primary key for the `campaign_carnage_report_player` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `machine_index` on the `campaign_carnage_report_player` table. All the data in the column will be lost.
  - You are about to drop the column `player_index` on the `campaign_carnage_report_player` table. All the data in the column will be lost.
  - You are about to drop the column `halo3_campaign_carnage_report_playerCarnage_report_id` on the `campaign_carnage_report_player_kills` table. All the data in the column will be lost.
  - You are about to drop the column `halo3_campaign_carnage_report_playerPlayer_index` on the `campaign_carnage_report_player_kills` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "halo3"."campaign_carnage_report_player_kills" DROP CONSTRAINT "campaign_carnage_report_player_kills_halo3_campaign_carnag_fkey";

-- AlterTable
ALTER TABLE "halo3"."campaign_carnage_report_player" DROP CONSTRAINT "campaign_carnage_report_player_pkey",
DROP COLUMN "machine_index",
DROP COLUMN "player_index",
ADD CONSTRAINT "campaign_carnage_report_player_pkey" PRIMARY KEY ("carnage_report_id", "player_xuid");

-- AlterTable
ALTER TABLE "halo3"."campaign_carnage_report_player_kills" DROP COLUMN "halo3_campaign_carnage_report_playerCarnage_report_id",
DROP COLUMN "halo3_campaign_carnage_report_playerPlayer_index";

-- AddForeignKey
ALTER TABLE "halo3"."campaign_carnage_report_player_kills" ADD CONSTRAINT "campaign_carnage_report_player_kills_carnage_report_id_pla_fkey" FOREIGN KEY ("carnage_report_id", "player_xuid") REFERENCES "halo3"."campaign_carnage_report_player"("carnage_report_id", "player_xuid") ON DELETE RESTRICT ON UPDATE CASCADE;
