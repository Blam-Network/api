-- Alter reach.file_share_file id from UUID to DECIMAL(20,0) u64-style identifier.
ALTER TABLE "reach"."file_share_file"
ADD COLUMN "id_new" DECIMAL(20,0);

-- Backfill existing rows with random signed 64-bit values (stored as decimal).
UPDATE "reach"."file_share_file"
SET "id_new" = ABS((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))::bit(64)::bigint))::numeric;

ALTER TABLE "reach"."file_share_file"
ALTER COLUMN "id_new" SET NOT NULL;

ALTER TABLE "reach"."file_share_file"
DROP CONSTRAINT "file_share_file_pkey";

ALTER TABLE "reach"."file_share_file"
DROP COLUMN "id";

ALTER TABLE "reach"."file_share_file"
RENAME COLUMN "id_new" TO "id";

ALTER TABLE "reach"."file_share_file"
ADD CONSTRAINT "file_share_file_pkey" PRIMARY KEY ("id");
