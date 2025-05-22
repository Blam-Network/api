/*
  Warnings:

  - You are about to drop the column `acknowledged_unsubscribe` on the `file_share` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "halo3"."file_share" DROP COLUMN "acknowledged_unsubscribe",
ADD COLUMN     "unsubscribe_stage" SMALLINT;
