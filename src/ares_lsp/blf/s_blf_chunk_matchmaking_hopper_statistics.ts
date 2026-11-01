import { c } from '@craftycodie/cstruct';
import { BLFChunkBase, blf, BlfError } from '@blamnetwork/blf';

export const k_hopper_statistics_count = 32;

/** Per-hopper population entry in Ares `mmhs` 3.1, little-endian. */
export const hopper_population = c.struct(
  {
    hopper_identifier: c.i16().padBefore(2),
    player_count: c.u32(),
  },
  { endian: 'little' },
);
export type hopper_population = c.infer<typeof hopper_population>;

const s_matchmaking_hopper_statistics = c.struct(
  {
    player_count: c.u32(),
    data: c.array(hopper_population, k_hopper_statistics_count),
  },
  { endian: 'little' },
);

/**
 * Ares matchmaking hopper statistics (`mmhs` 3.1), little-endian, 32 fixed entries.
 * `data` may hold fewer than 32 entries; the rest are written as zeros (as blf_lsp does). More than 32 throws.
 * Reading always yields 32 entries.
 */
export class s_blf_chunk_matchmaking_hopper_statistics extends BLFChunkBase {
  player_count = 0;
  data: hopper_population[] = [];

  static create(
    player_count: number,
    data: hopper_population[],
  ): s_blf_chunk_matchmaking_hopper_statistics {
    const chunk = new s_blf_chunk_matchmaking_hopper_statistics();
    chunk.player_count = player_count;
    chunk.data = data;
    return chunk;
  }

  read_body(payload: Uint8Array, _endian: c.Endian): void {
    const size = c.sizeof(s_matchmaking_hopper_statistics);
    if (payload.length < size) {
      throw new BlfError(
        `mmhs payload too short: need ${size} bytes, got ${payload.length}`,
      );
    }
    const value = c.read(s_matchmaking_hopper_statistics, payload);
    this.player_count = value.player_count;
    this.data = [...value.data];
  }

  write_body(_endian: c.Endian): Uint8Array {
    if (this.data.length > k_hopper_statistics_count) {
      throw new BlfError(
        `mmhs holds at most ${k_hopper_statistics_count} hoppers, got ${this.data.length}`,
      );
    }
    const data = [...this.data];
    while (data.length < k_hopper_statistics_count) {
      data.push(hopper_population.zero());
    }
    return c.write(s_matchmaking_hopper_statistics, {
      player_count: this.player_count,
      data: data as c.infer<typeof s_matchmaking_hopper_statistics>['data'],
    });
  }
}

// Applied by call: web_private compiles with legacy experimentalDecorators, which rejects blf-ts's
// TC39 decorator signature.
blf.chunk('mmhs', 3.1)(
  s_blf_chunk_matchmaking_hopper_statistics,
  {} as ClassDecoratorContext,
);
