-- Live Halo: Reach population from LSP presence heartbeats.
CREATE TABLE "reach"."active_players" (
    "player_xuid" DECIMAL(20,0) NOT NULL,
    "session_id" DECIMAL(20,0),
    "gui_game_mode" SMALLINT,
    "session_game_mode" SMALLINT,
    "hopper_id" SMALLINT,
    "team" SMALLINT,
    "session_privacy" SMALLINT,
    "session_closed" SMALLINT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_players_pkey" PRIMARY KEY ("player_xuid")
);

CREATE INDEX "active_players_session_id_idx" ON "reach"."active_players"("session_id");
CREATE INDEX "active_players_hopper_id_idx" ON "reach"."active_players"("hopper_id");
CREATE INDEX "active_players_updated_at_idx" ON "reach"."active_players"("updated_at");
