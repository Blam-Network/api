import { type BLFChunk, write_blffile } from '@blamnetwork/blf';
import { s_blf_chunk_start_of_file } from '@blamnetwork/blf/halo3/v12070_08_09_05_2031_halo3_ship';
import { s_blf_chunk_author } from './s_blf_chunk_author';
import { s_blf_chunk_end_of_file } from './s_blf_chunk_end_of_file';
import type { s_blf_chunk_matchmaking_hopper_statistics } from './s_blf_chunk_matchmaking_hopper_statistics';
import { s_blf_chunk_player_data } from './s_blf_chunk_player_data';
import type { s_blf_chunk_user_recent_players } from './s_blf_chunk_user_recent_players';

// Ares files mix byte orders: `_blf` and `athr` are Halo 3's (big-endian), while the Ares chunks pin
// little-endian in their own schemas. So the files are written "big" and each Ares chunk overrides it.
const k_ares_file_endian = 'big' as const;

/**
 * Ares user file: `_blf "ares user"`, `athr`, `fupd`, optional `srid`, `_eof`.
 * Port of blf_lsp `ares_untracked::build_user_file`. A missing `fupd` writes the default
 * (hopper_access 0, bungie_user_role 1, highest_skill 0, "default_hoppers").
 * `srid` is blf_lib's Halo 3 ship service record chunk (big-endian), written as-is when given.
 */
export function build_user_file(
  fupd?: s_blf_chunk_player_data,
  srid?: BLFChunk,
  author: s_blf_chunk_author = s_blf_chunk_author.for_ares(),
): Uint8Array {
  const chunks: BLFChunk[] = [
    s_blf_chunk_start_of_file.create('ares user'),
    author,
    fupd ?? new s_blf_chunk_player_data(),
  ];
  if (srid) {
    chunks.push(srid);
  }
  chunks.push(new s_blf_chunk_end_of_file());
  return write_blffile(k_ares_file_endian, chunks);
}

/**
 * Ares recent players file: `_blf "ares recent players"`, `athr`, `furp`, `_eof`.
 * Port of blf_lsp `ares_untracked::build_recent_players_file`.
 */
export function build_recent_players_file(
  furp: s_blf_chunk_user_recent_players,
  author: s_blf_chunk_author = s_blf_chunk_author.for_ares(),
): Uint8Array {
  return write_blffile(k_ares_file_endian, [
    s_blf_chunk_start_of_file.create('ares recent players'),
    author,
    furp,
    new s_blf_chunk_end_of_file(),
  ]);
}

/**
 * Ares hopper statistics file: `_blf` (empty name), `mmhs`, `_eof`.
 * Port of blf_lsp `ares_untracked::build_hopper_statistics_file`.
 */
export function build_hopper_statistics_file(
  mmhs: s_blf_chunk_matchmaking_hopper_statistics,
): Uint8Array {
  return write_blffile(k_ares_file_endian, [
    new s_blf_chunk_start_of_file(),
    mmhs,
    new s_blf_chunk_end_of_file(),
  ]);
}
