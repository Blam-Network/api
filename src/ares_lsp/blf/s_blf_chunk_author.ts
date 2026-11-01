import { c } from '@craftycodie/cstruct';
import { blf, CStructBLFChunk } from '@blamnetwork/blf';

/**
 * Author chunk (`athr` 3.1), Halo 3 ship layout, pinned big-endian.
 * Ares files reuse Halo 3's `athr` (blf_lib `versions::ares::v_untracked_ares`).
 * TODO: replace with the Halo 3 ship `s_blf_chunk_author` once blf-ts exports it.
 */
export class s_blf_chunk_author extends CStructBLFChunk(
  c.struct(
    {
      program_name: c.string(16),
      build_number_sequence: c.i32(),
      build_number: c.i32(),
      build_string: c.string(28),
      author_name: c.string(16),
    },
    { endian: 'big' },
  ),
) {
  /**
   * The `athr` chunk blf_lsp writes into Ares files: `s_blf_chunk_author::for_build::<v_untracked_ares>()`.
   * The build string is `"untracked"`, so blf_lib's build number parse fails and gives -1.
   * blf_lsp's program name is `"blf_lib v<blf_lib version>"`; the default matches blf_lsp 1.10.10.
   */
  static for_ares(program_name = 'blf_lib v1.15.14'): s_blf_chunk_author {
    const chunk = new s_blf_chunk_author();
    chunk.program_name = program_name;
    chunk.build_number_sequence = 1;
    chunk.build_number = -1;
    chunk.build_string = 'untracked';
    chunk.author_name = '';
    return chunk;
  }
}

// Applied by call: web_private compiles with legacy experimentalDecorators, which rejects blf-ts's
// TC39 decorator signature.
blf.chunk('athr', 3.1)(s_blf_chunk_author, {} as ClassDecoratorContext);
