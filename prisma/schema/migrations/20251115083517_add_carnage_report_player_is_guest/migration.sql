BEGIN;

ALTER TABLE "halo3"."carnage_report_player" 
ADD COLUMN "is_guest" BOOLEAN;

ALTER TABLE "ares"."carnage_report_player" 
ADD COLUMN "is_guest" BOOLEAN;

ALTER TABLE "halo3"."campaign_carnage_report_player" 
ADD COLUMN "is_guest" BOOLEAN;

-- Update existing rows in halo3.carnage_report_player
-- Guest mask: 0x00C0000000000000 = 54043195528445952 in decimal
-- A player is a guest if (player_xuid & 54043195528445952) != 0
-- Check if the value in the mask range is non-zero by dividing and checking remainder
UPDATE "halo3"."carnage_report_player"
SET is_guest = (mod(trunc(player_xuid / 18014398509481984), 4) <> 0);

UPDATE "ares"."carnage_report_player"
SET is_guest = (mod(trunc(player_xuid / 18014398509481984), 4) <> 0);

UPDATE "halo3"."campaign_carnage_report_player"
SET is_guest = (mod(trunc(player_xuid / 18014398509481984), 4) <> 0);

ALTER TABLE "halo3"."carnage_report_player" 
ALTER COLUMN "is_guest" SET NOT NULL;

ALTER TABLE "ares"."carnage_report_player" 
ALTER COLUMN "is_guest" SET NOT NULL;

ALTER TABLE "halo3"."campaign_carnage_report_player" 
ALTER COLUMN "is_guest" SET NOT NULL;

COMMIT;