/*
  Warnings:

  - A unique constraint covering the columns `[id,share_id]` on the table `file_share_file` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "reach"."file_share_file" ADD COLUMN     "tags" TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "unique_id_share_id" ON "reach"."file_share_file"("id", "share_id");
