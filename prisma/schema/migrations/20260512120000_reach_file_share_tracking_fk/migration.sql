-- Remove rows that reference missing files so FK creation cannot fail.
DELETE FROM "reach"."file_share_file_download" d
WHERE NOT EXISTS (
  SELECT 1 FROM "reach"."file_share_file" f WHERE f."id" = d."file_id"
);

DELETE FROM "reach"."file_share_file_recommendation" r
WHERE NOT EXISTS (
  SELECT 1 FROM "reach"."file_share_file" f WHERE f."id" = r."file_id"
);

-- Foreign keys so download/recommendation rows are removed when a file is deleted.
ALTER TABLE "reach"."file_share_file_download"
ADD CONSTRAINT "file_share_file_download_file_id_fkey"
FOREIGN KEY ("file_id") REFERENCES "reach"."file_share_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reach"."file_share_file_recommendation"
ADD CONSTRAINT "file_share_file_recommendation_file_id_fkey"
FOREIGN KEY ("file_id") REFERENCES "reach"."file_share_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;
