/*
  Warnings:

  - You are about to drop the column `Message` on the `file_share` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "halo3"."file_share" DROP COLUMN "Message",
ADD COLUMN     "message" TEXT;
