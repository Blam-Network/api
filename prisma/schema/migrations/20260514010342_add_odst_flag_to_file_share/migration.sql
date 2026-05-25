-- AlterTable: backfill only; no column default
ALTER TABLE "halo3"."file_share_slot" ADD COLUMN "is_odst" BOOLEAN;

UPDATE "halo3"."file_share_slot" SET "is_odst" = false WHERE "is_odst" IS NULL;

ALTER TABLE "halo3"."file_share_slot" ALTER COLUMN "is_odst" SET NOT NULL;
