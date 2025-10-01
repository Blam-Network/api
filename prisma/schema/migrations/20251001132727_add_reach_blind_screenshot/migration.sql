-- CreateTable
CREATE TABLE "reach"."blind_screenshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unique_id" DECIMAL(20,0),
    "parent_unique_id" DECIMAL(20,0),
    "root_unique_id" DECIMAL(20,0),
    "name" VARCHAR(16) NOT NULL,
    "description" VARCHAR(128) NOT NULL,
    "author" VARCHAR(16) NOT NULL,
    "file_type" INTEGER NOT NULL,
    "activity" INTEGER NOT NULL,
    "author_is_xuid_online" BOOLEAN NOT NULL,
    "author_id" DECIMAL(20,0) NOT NULL,
    "size_in_bytes" DECIMAL(20,0) NOT NULL,
    "date" TIMESTAMP(6) NOT NULL,
    "length_seconds" INTEGER NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "map_id" INTEGER NOT NULL,
    "game_mode" INTEGER NOT NULL,
    "game_engine_type" INTEGER NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "hopper_id" SMALLINT NOT NULL,
    "game_id" DECIMAL(20,0) NOT NULL,
    "game_tick" INTEGER NOT NULL,
    "film_tick" INTEGER NOT NULL,
    "jpeg_length" INTEGER NOT NULL,
    "camera_position" DOUBLE PRECISION[],
    "pixel_width" SMALLINT NOT NULL,
    "pixel_height" SMALLINT NOT NULL,

    CONSTRAINT "blind_screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_unique_id_date" ON "reach"."blind_screenshot"("unique_id", "date", "game_id");
