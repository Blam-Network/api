-- CreateTable
CREATE TABLE "reach"."file_share" (
    "share_id" DECIMAL(20,0) NOT NULL,
    "quota_slots" SMALLINT,
    "quota_bytes" INTEGER,
    "message" TEXT,
    "lastHash" INTEGER NOT NULL DEFAULT 0,
    "unsubscribe_stage" SMALLINT,

    CONSTRAINT "file_share_pkey" PRIMARY KEY ("share_id")
);
