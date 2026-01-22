/*
  Warnings:

  - Added the required column `unknown1` to the `carnage_report_player_medals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unknown2` to the `carnage_report_player_medals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ares"."carnage_report_player_medals" ADD COLUMN     "unknown1" SMALLINT NOT NULL,
ADD COLUMN     "unknown2" SMALLINT NOT NULL;
