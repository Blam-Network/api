/*
  Warnings:

  - Added the required column `compressed_size` to the `file_share_slot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "halo3"."file_share_slot" ADD COLUMN     "compressed_size" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "halo3"."file_share" (
    "share_id" DECIMAL(20,0) NOT NULL,
    "quota_slots" SMALLINT,
    "quota_bytes" SMALLINT,
    "Message" TEXT,

    CONSTRAINT "file_share_pkey" PRIMARY KEY ("share_id")
);
