-- DropForeignKey
ALTER TABLE "halo3"."file_share_transfer" DROP CONSTRAINT "file_share_transfer_file_id_fkey";

-- AddForeignKey
ALTER TABLE "halo3"."file_share_transfer" ADD CONSTRAINT "file_share_transfer_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "halo3"."file_share_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
