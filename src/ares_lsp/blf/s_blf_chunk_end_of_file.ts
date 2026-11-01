import { c } from '@craftycodie/cstruct';
import { blf, CStructBLFChunk } from '@blamnetwork/blf';

/**
 * Ares end-of-file chunk (`_eof` 1.1).
 * Same layout as Halo 3's, but the payload is pinned little-endian (blf_lib `ares::v_untracked_ares`).
 * `file_size` is filled in by `write_blffile` with the bytes written before this chunk.
 */
export class s_blf_chunk_end_of_file extends CStructBLFChunk(
  c.struct(
    {
      file_size: c.u32(),
      authentication_type: c.u8(),
    },
    { endian: 'little' },
  ),
) {}

// Applied by call: web_private compiles with legacy experimentalDecorators, which rejects blf-ts's
// TC39 decorator signature.
blf.chunk('_eof', 1.1)(s_blf_chunk_end_of_file, {} as ClassDecoratorContext);
