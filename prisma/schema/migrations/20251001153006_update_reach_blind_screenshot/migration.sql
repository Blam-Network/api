/*
  Warnings:

  - You are about to drop the column `camera_position` on the `blind_screenshot` table. All the data in the column will be lost.
  - You are about to drop the column `film_tick` on the `blind_screenshot` table. All the data in the column will be lost.
  - You are about to drop the column `game_tick` on the `blind_screenshot` table. All the data in the column will be lost.
  - You are about to drop the column `pixel_height` on the `blind_screenshot` table. All the data in the column will be lost.
  - You are about to drop the column `pixel_width` on the `blind_screenshot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "reach"."blind_screenshot" DROP COLUMN "camera_position",
DROP COLUMN "film_tick",
DROP COLUMN "game_tick",
DROP COLUMN "pixel_height",
DROP COLUMN "pixel_width",
ALTER COLUMN "length_seconds" DROP NOT NULL,
ALTER COLUMN "campaign_id" DROP NOT NULL,
ALTER COLUMN "difficulty" DROP NOT NULL,
ALTER COLUMN "hopper_id" DROP NOT NULL;
