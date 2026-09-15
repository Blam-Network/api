-- AlterTable
-- A host migration mints a new session row; the old row is stamped with the row it migrated to,
-- hidden from search, and dropped by the cleanup service shortly after.
ALTER TABLE "ares"."sessions" ADD COLUMN "migrated_to" VARCHAR(16);
ALTER TABLE "ares"."sessions" ADD COLUMN "migrated_at" TIMESTAMP(6);
