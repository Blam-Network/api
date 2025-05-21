-- CreateTable
CREATE TABLE "halo3"."file_share_slot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "share_id" DECIMAL(20,0) NOT NULL,
    "slot" SMALLINT NOT NULL,
    "unique_id" DECIMAL(20,0) NOT NULL,
    "name" VARCHAR(16) NOT NULL,
    "description" VARCHAR(128) NOT NULL,
    "author" VARCHAR(16) NOT NULL,
    "file_type" INTEGER NOT NULL,
    "author_is_xuid_online" BOOLEAN NOT NULL,
    "author_id" DECIMAL(20,0) NOT NULL,
    "size_in_bytes" DECIMAL(20,0) NOT NULL,
    "date" TIMESTAMP(6) NOT NULL,
    "length_seconds" INTEGER NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "map_id" INTEGER NOT NULL,
    "game_engine_type" INTEGER NOT NULL,
    "campaign_difficulty" INTEGER NOT NULL,
    "hopper_id" SMALLINT NOT NULL,
    "game_id" DECIMAL(20,0) NOT NULL,

    CONSTRAINT "file_share_slot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_share_id_slot" ON "halo3"."file_share_slot"("share_id", "slot");
