-- AlterTable
ALTER TABLE "reach"."player_data" ADD COLUMN     "nameplate_seventh_column_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_dmr_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_bungie_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_marathon_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_halo1_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_halo2_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_halo3_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_odst_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_assault_rifle_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_mk4_helmet_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_halo_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameplate_allstar_unlocked" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: grant unlock for whichever nameplate is currently equipped
UPDATE "reach"."player_data" SET "nameplate_seventh_column_unlocked" = true WHERE "nameplate" = 'seventh_column';
UPDATE "reach"."player_data" SET "nameplate_dmr_unlocked" = true WHERE "nameplate" = 'dmr';
UPDATE "reach"."player_data" SET "nameplate_bungie_unlocked" = true WHERE "nameplate" = 'bungie';
UPDATE "reach"."player_data" SET "nameplate_marathon_unlocked" = true WHERE "nameplate" = 'marathon';
UPDATE "reach"."player_data" SET "nameplate_halo1_unlocked" = true WHERE "nameplate" = 'halo1';
UPDATE "reach"."player_data" SET "nameplate_halo2_unlocked" = true WHERE "nameplate" = 'halo2';
UPDATE "reach"."player_data" SET "nameplate_halo3_unlocked" = true WHERE "nameplate" = 'halo3';
UPDATE "reach"."player_data" SET "nameplate_odst_unlocked" = true WHERE "nameplate" = 'odst';
UPDATE "reach"."player_data" SET "nameplate_assault_rifle_unlocked" = true WHERE "nameplate" = 'assault_rifle';
UPDATE "reach"."player_data" SET "nameplate_mk4_helmet_unlocked" = true WHERE "nameplate" = 'mk4_helmet';
UPDATE "reach"."player_data" SET "nameplate_halo_unlocked" = true WHERE "nameplate" = 'halo';
UPDATE "reach"."player_data" SET "nameplate_allstar_unlocked" = true WHERE "nameplate" = 'allstar';
