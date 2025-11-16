/*
  Warnings:

  - The primary key for the `bnet_user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `player_xuid` on the `bnet_user` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."bnet_user" DROP CONSTRAINT "bnet_user_pkey",
DROP COLUMN "player_xuid",
ADD COLUMN     "player_xuid" DECIMAL(20,0) NOT NULL,
ADD CONSTRAINT "bnet_user_pkey" PRIMARY KEY ("player_xuid");
