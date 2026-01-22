/*
  Warnings:

  - Added the required column `is_guest` to the `carnage_report_player` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ares"."carnage_report_player" ADD COLUMN     "is_guest" BOOLEAN NOT NULL;
