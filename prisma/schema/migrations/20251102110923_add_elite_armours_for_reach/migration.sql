-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "reach"."armour" ADD VALUE 'elitearmour_minor';
ALTER TYPE "reach"."armour" ADD VALUE 'elitearmour_specops';
ALTER TYPE "reach"."armour" ADD VALUE 'elitearmour_ranger';
ALTER TYPE "reach"."armour" ADD VALUE 'elitearmour_ultra';
ALTER TYPE "reach"."armour" ADD VALUE 'elitearmour_zealot';
ALTER TYPE "reach"."armour" ADD VALUE 'elitearmour_general';
ALTER TYPE "reach"."armour" ADD VALUE 'elitearmour_fieldmarshall';
ALTER TYPE "reach"."armour" ADD VALUE 'elitearmour_officer';
