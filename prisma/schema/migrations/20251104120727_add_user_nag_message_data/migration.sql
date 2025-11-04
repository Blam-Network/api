-- AlterTable
ALTER TABLE "reach"."player_data" ADD COLUMN     "nag_message" INTEGER,
ADD COLUMN     "nag_message_expires_at" TIMESTAMP(3);
