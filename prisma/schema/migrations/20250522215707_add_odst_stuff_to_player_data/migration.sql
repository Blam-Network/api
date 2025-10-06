/*
  Warnings:

  - You are about to drop the column `unknown_insignia` on the `service_record` table. All the data in the column will be lost.
  - You are about to drop the column `unknown_insignia2` on the `service_record` table. All the data in the column will be lost.
  - Added the required column `experience_base` to the `service_record` table without a default value. This is not possible if the table is not empty.
  - Added the required column `games_completed` to the `service_record` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "halo3"."player_data" ADD COLUMN     "odst_extras_portal_debug" BOOLEAN DEFAULT false,
ADD COLUMN     "odst_vidmaster_flag" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "halo3"."service_record"
    DROP COLUMN "unknown_insignia",
    DROP COLUMN "unknown_insignia2",
    ADD COLUMN "experience_base" INTEGER,
    ADD COLUMN "games_completed" INTEGER;

UPDATE "halo3"."service_record"
SET "experience_base" = 0,
    "games_completed" = 0;

ALTER TABLE "halo3"."service_record"
    ALTER COLUMN "experience_base" SET NOT NULL,
    ALTER COLUMN "games_completed" SET NOT NULL;