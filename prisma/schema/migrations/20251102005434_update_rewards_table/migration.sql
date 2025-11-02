-- AlterTable
ALTER TABLE "reach"."player_rewards" ADD COLUMN     "credits_award" INTEGER,
ADD COLUMN     "reset_rewards" BOOLEAN NOT NULL DEFAULT false;
