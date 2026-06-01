import { s_blf_chunk_network_lsp_heartbeat_data } from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import { isGuestXuid } from "src/xbox/xuid";

/** Session roster slot: 8-byte XUID in big-endian order (see blf-ts heartbeat fixture). */
export function xuidFromSessionPlayerBytes(bytes: number[]): bigint {
  let xuid = 0n;
  for (const byte of bytes) {
    xuid = (xuid << 8n) | BigInt(byte);
  }
  return xuid;
}

export type ReachPresencePlayerSnapshot = {
  playerXuid: bigint;
  team?: number;
};

/**
 * Collects unique non-guest XUIDs from a presence heartbeat.
 * Local slots always carry full XUIDs; when the host reports a session,
 * `session_players[].unknown0` is the same 8-byte XUID encoding.
 */
export function extractReachPresencePlayers(
  chunk: s_blf_chunk_network_lsp_heartbeat_data,
): ReachPresencePlayerSnapshot[] {
  const byXuid = new Map<string, ReachPresencePlayerSnapshot>();

  const merge = (snapshot: ReachPresencePlayerSnapshot) => {
    if (snapshot.playerXuid === 0n || isGuestXuid(snapshot.playerXuid)) {
      return;
    }
    const key = snapshot.playerXuid.toString();
    const existing = byXuid.get(key);
    if (!existing) {
      byXuid.set(key, snapshot);
      return;
    }
    byXuid.set(key, {
      playerXuid: snapshot.playerXuid,
      team: snapshot.team ?? existing.team,
    });
  };

  for (
    let i = 0;
    i < chunk.local_player_count && i < chunk.players.length;
    i++
  ) {
    const local = chunk.players[i];
    merge({ playerXuid: local.player_xuid });
  }

  if (chunk.has_players) {
    const session = chunk.session_data;
    for (
      let i = 0;
      i < session.player_count && i < session.session_players.length;
      i++
    ) {
      const sessionPlayer = session.session_players[i];
      merge({
        playerXuid: xuidFromSessionPlayerBytes(sessionPlayer.unknown0),
        team: sessionPlayer.team,
      });
    }
  }

  return [...byXuid.values()];
}
