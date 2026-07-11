import { search_for_chunk, write_blffile } from "@blamnetwork/blf";
import {
  s_blf_chunk_challenge_progress,
  s_blf_chunk_challenge_state,
  s_blf_chunk_end_of_file,
  s_blf_chunk_reward_persistence_upload_to_lsp,
  s_blf_chunk_rewards_persistance,
  s_blf_chunk_start_of_file,
} from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import { s_blf_chunk_rewards_persistance as s_blf_chunk_rewards_persistance_beta } from "@blamnetwork/blf/haloreach/v09730_10_04_09_1309_omaha_delta";

/** BLF file with `_blf`, `rpdl` 2.1, beta `rpdl` 1.1, optional `dcha`, and `_eof`. */
export function build_user_rewards_file(
  rdpl: s_blf_chunk_rewards_persistance,
  dcha?: s_blf_chunk_challenge_state | null,
): Uint8Array {
  const beta_rdpl = new s_blf_chunk_rewards_persistance_beta();
  beta_rdpl.unknown1 = rdpl.credits;
  beta_rdpl.unknown2 = Array.from({ length: 0x180 }, () => 1);

  return write_blffile("big", [
    s_blf_chunk_start_of_file.create("omaha rewards"),
    rdpl,
    beta_rdpl,
    dcha ?? new s_blf_chunk_challenge_state(),
    new s_blf_chunk_end_of_file(),
  ]);
}

/** Locate `rpul` / `chpr` chunks in a rewards upload BLF. */
export function read_rewards_upload(buffer: Uint8Array): {
  rupl: s_blf_chunk_reward_persistence_upload_to_lsp | undefined;
  chpr: s_blf_chunk_challenge_progress | undefined;
} {
  const rupl = new s_blf_chunk_reward_persistence_upload_to_lsp();
  const chpr = new s_blf_chunk_challenge_progress();

  return {
    rupl: search_for_chunk(buffer, rupl, "big") ? rupl : undefined,
    chpr: search_for_chunk(buffer, chpr, "big") ? chpr : undefined,
  };
}
