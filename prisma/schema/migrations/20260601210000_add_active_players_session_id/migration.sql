-- For databases that already applied 20260601200000 without session_id.
ALTER TABLE "reach"."active_players" ADD COLUMN IF NOT EXISTS "session_id" DECIMAL(20,0);

CREATE INDEX IF NOT EXISTS "active_players_session_id_idx" ON "reach"."active_players"("session_id");
