/*
  Warnings:

  - Added the required column `is_odst` to the `file_share_transfer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "halo3"."file_share_transfer" ADD COLUMN     "is_odst" BOOLEAN NOT NULL;
