-- AlterTable
ALTER TABLE "halo3"."blind_screenshot" ALTER COLUMN "game_tick" DROP NOT NULL,
ALTER COLUMN "film_tick" DROP NOT NULL,
ALTER COLUMN "jpeg_length" DROP NOT NULL,
ALTER COLUMN "pixel_width" DROP NOT NULL,
ALTER COLUMN "pixel_height" DROP NOT NULL;
