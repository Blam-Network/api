-- Reach active fileshare download queue (mirrors halo3.file_share_transfer).
CREATE TABLE "reach"."file_share_transfer" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "file_id" DECIMAL(20,0) NOT NULL
);

CREATE UNIQUE INDEX "file_share_transfer_player_xuid_file_id_key" ON "reach"."file_share_transfer"("player_xuid", "file_id");

ALTER TABLE "reach"."file_share_transfer" ADD CONSTRAINT "file_share_transfer_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "reach"."file_share_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;
