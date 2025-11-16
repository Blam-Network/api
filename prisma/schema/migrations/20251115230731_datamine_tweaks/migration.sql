/*
  Warnings:

  - Made the column `string_value` on table `datamine_event_parameter` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."datamine_event_parameter" ALTER COLUMN "string_value" SET NOT NULL;
