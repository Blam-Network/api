-- CreateEnum
CREATE TYPE "reach"."commendation" AS ENUM ('matchmaking_oneshot', 'matchmaking_multikill', 'matchmaking_anyspree', 'matchmaking_assistant', 'matchmaking_crackshot', 'matchmaking_closequarters', 'matchmaking_downshift', 'matchmaking_triggerman', 'matchmaking_sidearm', 'matchmaking_heavyweapon', 'matchmaking_mobileasset', 'matchmaking_grenadier', 'matchmaking_rearadmiral', 'matchmaking_jackofalltrades', 'matchmaking_domeinspector', 'matchmaking_numbersgame', 'firefight_targetpractice', 'firefight_specialized', 'firefight_incommand', 'firefight_longshot', 'firefight_riflinthrough', 'firefight_triggerhappy', 'firefight_pullthepin', 'firefight_getloud', 'firefight_methodical', 'firefight_backup', 'firefight_vehicular', 'firefight_grounded', 'firefight_perfectionist', 'campaign_pinpoint', 'campaign_demon', 'campaign_cannonfodder', 'campaign_specops', 'campaign_leadershipelement', 'campaign_walkingtank', 'campaign_precisely', 'campaign_standardissue', 'campaign_smallarms', 'campaign_nicearm', 'campaign_warmachine', 'campaign_splashdamage', 'campaign_supersoldier', 'campaign_supportrole', 'campaign_rightofway', 'campaign_flawlesscowboy');

-- CreateTable
CREATE TABLE "reach"."player_rewards_commendations" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "commendation" "reach"."commendation" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_rewards_commendations_pkey" PRIMARY KEY ("player_xuid","commendation")
);

-- CreateIndex
CREATE INDEX "player_rewards_commendations_player_xuid_idx" ON "reach"."player_rewards_commendations"("player_xuid");
