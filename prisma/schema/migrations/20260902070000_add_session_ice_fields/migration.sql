-- AlterTable
ALTER TABLE "ares"."sessions" ADD COLUMN "ice_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ares"."sessions" ADD COLUMN "host_peer_id" VARCHAR(128) NOT NULL DEFAULT '';
