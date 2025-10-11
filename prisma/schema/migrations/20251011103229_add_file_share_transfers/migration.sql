-- CreateTable
CREATE TABLE "halo3"."file_share_transfer" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "file_id" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "file_share_transfer_player_xuid_file_id_key" ON "halo3"."file_share_transfer"("player_xuid", "file_id");
