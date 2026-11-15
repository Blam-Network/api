-- CreateIndex
CREATE UNIQUE INDEX "unique_share_id_unique_id" ON "reach"."file_share_file"("share_id", "unique_id");
