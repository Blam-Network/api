import { c } from '@craftycodie/cstruct';
import { BLFChunkBase, blf, BlfError } from '@blamnetwork/blf';

/** One `furp` entry: packed, 10 bytes, little-endian. */
export const s_files_user_recent_players_entry = c.struct(
  {
    hopper_identifier: c.u16(),
    xuid: c.u64(),
  },
  { endian: 'little', pack: 1 },
);
export type s_files_user_recent_players_entry = c.infer<
  typeof s_files_user_recent_players_entry
>;

const k_player_count_size = 4;

/** Ares user recent players (`furp` 2.1): u32 count, then `count` entries. Little-endian. */
export class s_blf_chunk_user_recent_players extends BLFChunkBase {
  players: s_files_user_recent_players_entry[] = [];

  static create(
    players: s_files_user_recent_players_entry[] = [],
  ): s_blf_chunk_user_recent_players {
    const chunk = new s_blf_chunk_user_recent_players();
    chunk.players = players;
    return chunk;
  }

  read_body(payload: Uint8Array, _endian: c.Endian): void {
    if (payload.length < k_player_count_size) {
      throw new BlfError(
        `furp payload too short: need ${k_player_count_size} bytes, got ${payload.length}`,
      );
    }
    const view = new DataView(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength,
    );
    const player_count = view.getUint32(0, true);
    const entry_size = c.sizeof(s_files_user_recent_players_entry);
    const expected = k_player_count_size + player_count * entry_size;
    if (payload.length < expected) {
      throw new BlfError(
        `furp payload too short for ${player_count} players: need ${expected} bytes, got ${payload.length}`,
      );
    }

    this.players = [];
    for (let i = 0; i < player_count; i++) {
      this.players.push(
        c.read(
          s_files_user_recent_players_entry,
          payload,
          k_player_count_size + i * entry_size,
        ),
      );
    }
  }

  write_body(_endian: c.Endian): Uint8Array {
    const entry_size = c.sizeof(s_files_user_recent_players_entry);
    const out = new Uint8Array(
      k_player_count_size + this.players.length * entry_size,
    );
    new DataView(out.buffer).setUint32(0, this.players.length, true);
    this.players.forEach((player, i) => {
      c.write(s_files_user_recent_players_entry, player, {
        into: out,
        offset: k_player_count_size + i * entry_size,
      });
    });
    return out;
  }
}

// Applied by call: web_private compiles with legacy experimentalDecorators, which rejects blf-ts's
// TC39 decorator signature.
blf.chunk('furp', 2.1)(
  s_blf_chunk_user_recent_players,
  {} as ClassDecoratorContext,
);
