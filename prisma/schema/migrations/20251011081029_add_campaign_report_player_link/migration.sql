-- AddForeignKey
ALTER TABLE "halo3"."campaign_carnage_report_player" ADD CONSTRAINT "campaign_carnage_report_player_carnage_report_id_fkey" FOREIGN KEY ("carnage_report_id") REFERENCES "halo3"."campaign_carnage_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
