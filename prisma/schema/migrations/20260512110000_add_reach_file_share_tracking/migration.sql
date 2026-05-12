/*
  Warnings:

  - You are about to drop the column `recommended_to_friends_at` on the `file_share_file` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "reach"."file_share_file" DROP COLUMN "recommended_to_friends_at",
ADD COLUMN     "uploaded_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "reach"."file_share_file_recommendation" (
    "file_id" DECIMAL(20,0) NOT NULL,
    "player_id" DECIMAL(20,0) NOT NULL,
    "recommended_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_share_file_recommendation_pkey" PRIMARY KEY ("file_id","player_id")
);

-- CreateTable
CREATE TABLE "reach"."file_share_file_download" (
    "file_id" DECIMAL(20,0) NOT NULL,
    "player_id" DECIMAL(20,0) NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_share_file_download_pkey" PRIMARY KEY ("file_id","player_id")
);
