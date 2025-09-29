-- CreateEnum
CREATE TYPE "reach"."reach_player_data_nameplate" AS ENUM ('none', 'seventh_column', 'dmr', 'bungie', 'marathon', 'halo1', 'halo2', 'halo3', 'odst', 'assault_rifle', 'mk4_helmet', 'halo', 'allstar');

-- AlterTable
ALTER TABLE "reach"."player_data" ADD COLUMN     "is_bungie" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_pro" BOOLEAN NOT NULL DEFAULT false;
