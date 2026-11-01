import { c } from '@craftycodie/cstruct';
import { blf, BlfError, CStructBLFChunk } from '@blamnetwork/blf';

const k_hopper_directory_size = 32;

/** Ares user player data (`fupd` 3.1), little-endian. A new chunk is blf_lib's default. */
export class s_blf_chunk_player_data extends CStructBLFChunk(
  c.struct(
    {
      hopper_access: c.u32(),
      /** Bit 0 registered, 1 pro, 2 staff (bungie), 3 community (recon). */
      bungie_user_role: c.u32().default(1),
      highest_skill: c.u32(),
      /** UTF-8, NUL-padded, up to 32 bytes. */
      hopper_directory: c
        .string(k_hopper_directory_size)
        .default('default_hoppers'),
    },
    { endian: 'little' },
  ),
) {
  static create(
    fields: Partial<
      Pick<
        s_blf_chunk_player_data,
        | 'hopper_access'
        | 'bungie_user_role'
        | 'highest_skill'
        | 'hopper_directory'
      >
    > = {},
  ): s_blf_chunk_player_data {
    return Object.assign(new s_blf_chunk_player_data(), fields);
  }

  write_body(endian: c.Endian): Uint8Array {
    // blf_lib rejects a hopper_directory longer than the slot rather than truncating it.
    if (
      new TextEncoder().encode(this.hopper_directory).length >
      k_hopper_directory_size
    ) {
      throw new BlfError(
        `fupd hopper_directory is longer than ${k_hopper_directory_size} bytes: "${this.hopper_directory}"`,
      );
    }
    return super.write_body(endian);
  }
}

// Applied by call: web_private compiles with legacy experimentalDecorators, which rejects blf-ts's
// TC39 decorator signature.
blf.chunk('fupd', 3.1)(s_blf_chunk_player_data, {} as ClassDecoratorContext);
