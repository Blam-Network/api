-- player_kills blocked report deletes via ON DELETE RESTRICT on the player FK
ALTER TABLE "halo3"."campaign_carnage_report_player_kills" DROP CONSTRAINT "campaign_carnage_report_player_kills_carnage_report_id_pla_fkey";

ALTER TABLE "halo3"."campaign_carnage_report_player_kills" ADD CONSTRAINT "campaign_carnage_report_player_kills_carnage_report_id_pla_fkey" FOREIGN KEY ("carnage_report_id", "player_xuid") REFERENCES "halo3"."campaign_carnage_report_player"("carnage_report_id", "player_xuid") ON DELETE CASCADE ON UPDATE CASCADE;
