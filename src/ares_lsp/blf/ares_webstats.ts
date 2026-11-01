import { c } from '@craftycodie/cstruct';
import {
  type BLFChunk,
  BLFChunkBase,
  BlfError,
  blf,
  CStructBLFChunk,
  getBlfChunkMeta,
  s_blf_header,
  write_blffile,
} from '@blamnetwork/blf';
import { s_blf_chunk_author } from './s_blf_chunk_author';
import { s_blf_chunk_end_of_file } from './s_blf_chunk_end_of_file';
import { s_blf_chunk_game_local_players } from './ares_webstats_game_local_players';
import {
  c_game_variant,
  s_blf_chunk_multiplayer_events as h3_multiplayer_events,
  s_blf_chunk_start_of_file,
  s_player_configuration_from_client,
  s_player_configuration_from_host,
  real_point3d,
} from '@blamnetwork/blf/halo3/v12070_08_09_05_2031_halo3_ship';

/*
 * Ares (`ares_untracked`) multiplayer game results ("webstats"), ported from
 * blf_lsp `ares_untracked::read_webstats` / blf_lib-private
 * (blf/chunks/ares/v_untracked_ares, blf/files/ares/v_untracked_ares/multi.rs).
 *
 * Ares mixes byte orders: `_blf` and `athr` are Halo 3's (big-endian), the Ares
 * chunks are little-endian with a few big-endian fields, and `mpma` is
 * big-endian. Each chunk pins its own byte order, as blf_lib does.
 */

export const k_maximum_players = 16;
export const k_maximum_teams = 16;
export const k_maximum_machines = 16;

/** `time32_t` pinned big-endian (Ares stores `mpgd` times big-endian). */
const time32_be = () =>
  c
    .u32()
    .be()
    .transform(
      (seconds) => new Date(seconds * 1000),
      (date: Date) => Math.floor(date.getTime() / 1000),
    );

/**
 * A 16-bit statistic with its low bit cleared (blf_lib's Ares `#[br(map = |x: i16| x & -2)]`).
 * Unlike Halo 3, which shifts the bit out (`raw >> 1`), Ares drops it. Writes the value as-is.
 */
const masked_i16 = () =>
  c.i16().transform(
    (raw) => raw & -2,
    (value: number) => value,
  );

// ---- mpgd

const k_scenario_path_length = 260;

/** `char[260]` scenario path; the first byte's top bit marks a DLC map and is cleared from `path`. */
export interface s_scenario_path {
  is_dlc: boolean;
  path: string;
}

const utf8_decoder = new TextDecoder('utf-8');
const utf8_encoder = new TextEncoder();

export const s_scenario_path = () =>
  c.bytes(k_scenario_path_length).transform(
    (raw): s_scenario_path => {
      const bytes = Uint8Array.from(raw);
      const is_dlc = (bytes[0] & 0x80) !== 0;
      bytes[0] &= 0x7f;
      const end = bytes.indexOf(0);
      return {
        is_dlc,
        path: utf8_decoder.decode(
          bytes.subarray(0, end === -1 ? bytes.length : end),
        ),
      };
    },
    (value: s_scenario_path) => {
      const encoded = utf8_encoder.encode(value.path);
      if (encoded.length > k_scenario_path_length) {
        throw new Error(
          `Scenario path is too long (${encoded.length} > ${k_scenario_path_length} bytes)`,
        );
      }
      const bytes = new Uint8Array(k_scenario_path_length);
      bytes.set(encoded);
      if (value.is_dlc) {
        bytes[0] |= 0x80;
      }
      return bytes;
    },
  );

/** Ares game results game description (`mpgd` 2.1, 0x174 bytes). */
export class s_blf_chunk_multiplayer_game_description extends CStructBLFChunk(
  c.struct(
    {
      team_game: c.bool(),
      game_id: c.u64(),
      map_id: c.u32().be(),
      scenario_path: s_scenario_path(),
      map_variant_name: c.wstring(0x20),
      game_variant_unique_id: c.u64(),
      map_variant_unique_id: c.u64(),
      started: c.bool(),
      start_time: time32_be(),
      finished: c.bool(),
      finish_time: time32_be(),
      migrated_to_group: c.bool(),
      migrated_solo: c.bool(),
      simulation_aborted: c.bool().padAfter(6),
    },
    { endian: 'little' },
  ),
) {}

// ---- mpmo

/** Ares game results matchmaking options (`mpmo` 2.1, 0x5C bytes). */
export class s_blf_chunk_multiplayer_matchmaking_options extends CStructBLFChunk(
  c.struct(
    {
      hopper_identifier: c.i16(),
      hopper_name: c.wstring(0x20),
      hopper_ranked: c.bool(),
      hopper_team_based: c.bool(),
      xlast_index: c.u8(),
      draw_probability: c.u32(),
      beta: c.f32(),
      tau: c.f32(),
      experience_base_increment: c.u32(),
      experience_penalty_decrement: c.u32().padAfter(3),
    },
    { endian: 'little' },
  ),
) {}

// ---- mpvr

/** Ares game variant (`mpvr` 3.1, 0x264 bytes): Halo 3's unpacked `c_game_variant`, little-endian. */
export class s_blf_chunk_game_variant extends CStructBLFChunk(
  c.struct(
    {
      game_variant: c_game_variant(),
    },
    { endian: 'little' },
  ),
) {}

// ---- mppl

/** 0x11E bytes. */
export const s_blf_chunk_multiplayer_players_player = c.struct({
  player_exists: c.bool(),
  machine_index: c.i8(),
  player_identifier: c.u64(),
  player_configuration_from_client: s_player_configuration_from_client,
  player_configuration_from_host: s_player_configuration_from_host,
  standing: c.i8(),
  result: c.i8(),
  score: c.i16().be(),
});
export type s_blf_chunk_multiplayer_players_player = c.infer<
  typeof s_blf_chunk_multiplayer_players_player
>;

/** Ares game results players (`mppl` 2.1, 0x11E4 bytes). */
export class s_blf_chunk_multiplayer_players extends CStructBLFChunk(
  c.struct(
    {
      players: s_blf_chunk_multiplayer_players_player
        .array(k_maximum_players)
        .padBefore(4),
    },
    { endian: 'little' },
  ),
) {}

// ---- mptm

export const s_blf_chunk_multiplayer_teams_team = c.struct({
  exists: c.bool(),
  standing: c.i8(),
  score: c.i16().be(),
});
export type s_blf_chunk_multiplayer_teams_team = c.infer<
  typeof s_blf_chunk_multiplayer_teams_team
>;

/** Ares game results teams (`mptm` 1.1, 0x44 bytes). */
export class s_blf_chunk_multiplayer_teams extends CStructBLFChunk(
  c.struct(
    {
      teams: s_blf_chunk_multiplayer_teams_team
        .array(k_maximum_teams)
        .padBefore(4),
    },
    { endian: 'little' },
  ),
) {}

// ---- mpma

export enum e_online_nat_type {
  Unknown = 0,
  Open = 1,
  Moderate = 2,
  Strict = 3,
}

export const s_machine_identifier = c.struct({
  identifier: c.u8().array(6),
});
export type s_machine_identifier = c.infer<typeof s_machine_identifier>;

/** 0x16 bytes. */
export const s_game_results_machine_data = c.struct({
  identifier: s_machine_identifier,
  exists: c.bool(),
  connected_to_host: c.bool(),
  host: c.bool(),
  initial_host: c.bool(),
  voluntary_quit: c.bool(),
  bandwidth_events: c.i16().array(5).padBefore(1),
});
export type s_game_results_machine_data = c.infer<
  typeof s_game_results_machine_data
>;

/** Ares secure address: 320 opaque bytes (no `ina`/`ina_online` unlike Halo 3). */
export const s_transport_secure_address = c.struct({
  data: c.u8().array(320),
});
export type s_transport_secure_address = c.infer<
  typeof s_transport_secure_address
>;

/** 0x15E bytes. */
export const s_machine_session_info = c.struct({
  exists: c.bool(),
  has_hard_drive: c.bool(),
  party_nonce: c.u64(),
  secure_address: s_transport_secure_address,
  network_version_number: c.i32(),
  peer_estimated_downstream_bandwidth_bps: c.i32(),
  peer_estimated_upstream_bandwidth_bps: c.i32(),
  peer_nat_type: c.enum(e_online_nat_type, c.i32()),
  peer_to_peer_connectivity_mask: c.u16(),
  peer_to_peer_probed_mask: c.u16(),
});
export type s_machine_session_info = c.infer<typeof s_machine_session_info>;

/** 0x174 bytes. */
export const s_blf_chunk_multiplayer_machines_machine = c.struct({
  machine_data: s_game_results_machine_data,
  session_info: s_machine_session_info,
});
export type s_blf_chunk_multiplayer_machines_machine = c.infer<
  typeof s_blf_chunk_multiplayer_machines_machine
>;

/** Ares game results machines (`mpma` 2.1, 0x1744 bytes). Big-endian, unlike the other Ares chunks. */
export class s_blf_chunk_multiplayer_machines extends CStructBLFChunk(
  c.struct(
    {
      in_squad_session: c.bool(),
      in_group_session: c.bool(),
      machines: s_blf_chunk_multiplayer_machines_machine
        .array(k_maximum_machines)
        .padBefore(2),
    },
    { endian: 'big' },
  ),
) {}

// ---- mps1

/** 0x66 bytes. Also the per-team statistics in `mps3`. */
export const s_game_results_statistics = c.struct({
  games_played: masked_i16(),
  games_completed: masked_i16(),
  games_won: masked_i16(),
  games_tied: masked_i16(),
  rounds_completed: masked_i16(),
  rounds_won: masked_i16(),
  in_round_score: masked_i16(),
  in_game_total_score: masked_i16(),
  kills: masked_i16(),
  assists: masked_i16(),
  deaths: masked_i16(),
  betrayals: masked_i16(),
  suicides: masked_i16(),
  most_kills_in_a_row: masked_i16(),
  seconds_alive: masked_i16(),
  ctf_flag_scores: masked_i16(),
  ctf_flag_grabs: masked_i16(),
  ctf_flag_carrier_kills: masked_i16(),
  ctf_flag_returns: masked_i16(),
  assault_bomb_arms: masked_i16(),
  assault_bomb_grabs: masked_i16(),
  assault_bomb_disarms: masked_i16(),
  assault_bomb_detonations: masked_i16(),
  oddball_time_with_ball: masked_i16(),
  oddball_unused: masked_i16(),
  oddball_kills_as_carrier: masked_i16(),
  oddball_ball_carrier_kills: masked_i16(),
  king_time_on_hill: masked_i16(),
  king_total_control_time: masked_i16(),
  king_unused0: masked_i16(),
  king_unused1: masked_i16(),
  unused0: masked_i16(),
  unused1: masked_i16(),
  unused2: masked_i16(),
  vip_takedowns: masked_i16(),
  vip_kills_as_vip: masked_i16(),
  vip_guard_time: masked_i16(),
  vip_time_as_vip: masked_i16(),
  vip_lives_as_vip: masked_i16(),
  juggernaut_kills: masked_i16(),
  juggernaut_kills_as_juggernaut: masked_i16(),
  juggernaut_total_control_time: masked_i16(),
  total_wp: masked_i16(),
  juggernaut_unused: masked_i16(),
  territories_owned: masked_i16(),
  territories_captures: masked_i16(),
  territories_ousts: masked_i16(),
  territories_time_in_territory: masked_i16(),
  infection_zombie_kills: masked_i16(),
  infection_infections: masked_i16(),
  infection_time_as_human: masked_i16(),
});
export type s_game_results_statistics = c.infer<
  typeof s_game_results_statistics
>;

/** 0x78 bytes. */
export const s_game_results_player_statistics_medals = c.struct({
  extermination: masked_i16(),
  perfection: masked_i16(),
  multiple_kill_2: masked_i16(),
  multiple_kill_3: masked_i16(),
  multiple_kill_4: masked_i16(),
  multiple_kill_5: masked_i16(),
  multiple_kill_6: masked_i16(),
  multiple_kill_7: masked_i16(),
  multiple_kill_8: masked_i16(),
  multiple_kill_9: masked_i16(),
  multiple_kill_10: masked_i16(),
  kills_in_a_row_5: masked_i16(),
  kills_in_a_row_10: masked_i16(),
  kills_in_a_row_15: masked_i16(),
  kills_in_a_row_20: masked_i16(),
  kills_in_a_row_25: masked_i16(),
  kills_in_a_row_30: masked_i16(),
  sniper_kill_5: masked_i16(),
  sniper_kill_10: masked_i16(),
  shotgun_kill_5: masked_i16(),
  shotgun_kill_10: masked_i16(),
  collision_kill_5: masked_i16(),
  collision_kill_10: masked_i16(),
  sword_kill_5: masked_i16(),
  sword_kill_10: masked_i16(),
  juggernaut_kill_5: masked_i16(),
  juggernaut_kill_10: masked_i16(),
  zombie_kill_5: masked_i16(),
  zombie_kill_10: masked_i16(),
  human_kill_5: masked_i16(),
  human_kill_10: masked_i16(),
  human_kill_15: masked_i16(),
  koth_kill_5: masked_i16(),
  shotgun_kill_sword: masked_i16(),
  vehicle_impact_kill: masked_i16(),
  vehicle_hijack: masked_i16(),
  aircraft_hijack: masked_i16(),
  deadplayer_kill: masked_i16(),
  player_kill_spreeplayer: masked_i16(),
  spartanlaser_kill: masked_i16(),
  stickygrenade_kill: masked_i16(),
  sniper_kill: masked_i16(),
  bashbehind_kill: masked_i16(),
  bash_kill: masked_i16(),
  flame_kill: masked_i16(),
  driver_assist_gunner: masked_i16(),
  assault_bomb_planted: masked_i16(),
  assault_player_kill_carrier: masked_i16(),
  vip_player_kill_vip: masked_i16(),
  juggernaut_player_kill_juggernaut: masked_i16(),
  oddball_carrier_kill_player: masked_i16(),
  ctf_flag_captured: masked_i16(),
  ctf_flag_player_kill_carrier: masked_i16(),
  ctf_flag_carrier_kill_player: masked_i16(),
  infection_survive: masked_i16(),
  nemesis: masked_i16(),
  avenger: masked_i16(),
  unused3: masked_i16(),
  unknown1: masked_i16(),
  unknown2: masked_i16(),
});
export type s_game_results_player_statistics_medals = c.infer<
  typeof s_game_results_player_statistics_medals
>;

/** 0x62 bytes. */
export const s_game_results_player_statistics_achievements = c.struct({
  landfall: masked_i16(),
  holdout: masked_i16(),
  the_road: masked_i16(),
  assault: masked_i16(),
  cleansing: masked_i16(),
  refuge: masked_i16(),
  last_stand: masked_i16(),
  the_key: masked_i16(),
  _return: masked_i16(),
  campaign_complete_normal: masked_i16(),
  campaign_complete_heroic: masked_i16(),
  campaign_complete_legendary: masked_i16(),
  iron: masked_i16(),
  black_eye: masked_i16(),
  tough_luck: masked_i16(),
  catch: masked_i16(),
  fog: masked_i16(),
  famine: masked_i16(),
  thunderstorm: masked_i16(),
  tilt: masked_i16(),
  mythic: masked_i16(),
  marathon_man: masked_i16(),
  guerilla: masked_i16(),
  demon: masked_i16(),
  cavalier: masked_i16(),
  askar: masked_i16(),
  exterminator: masked_i16(),
  ranger: masked_i16(),
  vanguard: masked_i16(),
  orpheus: masked_i16(),
  reclaimer: masked_i16(),
  graduate: masked_i16(),
  unsc_spartan: masked_i16(),
  spartan_officer: masked_i16(),
  two_for_one: masked_i16(),
  triple_kill: masked_i16(),
  overkill: masked_i16(),
  lee_r_wilson_memorial: masked_i16(),
  killing_frenzy: masked_i16(),
  steppin_razor: masked_i16(),
  mongoose_mowdown: masked_i16(),
  up_close_and_personal: masked_i16(),
  mvp: masked_i16(),
  maybe_next_time_buddy: masked_i16(),
  too_close_to_the_sun: masked_i16(),
  we_re_in_for_some_chop: masked_i16(),
  fear_the_pink_mist: masked_i16(),
  headshot_honcho: masked_i16(),
  used_car_salesman: masked_i16(),
});
export type s_game_results_player_statistics_achievements = c.infer<
  typeof s_game_results_player_statistics_achievements
>;

/** 0xC bytes. */
export const s_game_results_damage_statistics = c.struct({
  valid: c.i8(),
  kills: masked_i16().padBefore(1),
  deaths: masked_i16(),
  betrayals: masked_i16(),
  suicides: masked_i16(),
  headshots: masked_i16(),
});
export type s_game_results_damage_statistics = c.infer<
  typeof s_game_results_damage_statistics
>;

/** Damage statistics per damage source (0x2DC bytes). */
export const s_game_results_player_damage_source_statistics = c.struct({
  unknown: s_game_results_damage_statistics,
  falling_damage: s_game_results_damage_statistics,
  collision_damage: s_game_results_damage_statistics,
  melee: s_game_results_damage_statistics,
  explosion: s_game_results_damage_statistics,
  magnum_pistol: s_game_results_damage_statistics,
  plasma_pistol: s_game_results_damage_statistics,
  needler: s_game_results_damage_statistics,
  excavator: s_game_results_damage_statistics,
  smg: s_game_results_damage_statistics,
  plasma_rifle: s_game_results_damage_statistics,
  battle_rifle: s_game_results_damage_statistics,
  carbine: s_game_results_damage_statistics,
  shotgun: s_game_results_damage_statistics,
  sniper_rifle: s_game_results_damage_statistics,
  beam_rifle: s_game_results_damage_statistics,
  assault_rifle: s_game_results_damage_statistics,
  spike_rifle: s_game_results_damage_statistics,
  flak_cannon: s_game_results_damage_statistics,
  missile_launcher: s_game_results_damage_statistics,
  rocket_launcher: s_game_results_damage_statistics,
  spartan_laser: s_game_results_damage_statistics,
  brute_shot: s_game_results_damage_statistics,
  flame_thrower: s_game_results_damage_statistics,
  sentinal_gun: s_game_results_damage_statistics,
  energy_sword: s_game_results_damage_statistics,
  gravity_hammer: s_game_results_damage_statistics,
  frag_grenade: s_game_results_damage_statistics,
  plasma_grenade: s_game_results_damage_statistics,
  claymore_grenade: s_game_results_damage_statistics,
  firebomb_grenade: s_game_results_damage_statistics,
  flag: s_game_results_damage_statistics,
  bomb: s_game_results_damage_statistics,
  bomb_explosion: s_game_results_damage_statistics,
  ball: s_game_results_damage_statistics,
  human_turret: s_game_results_damage_statistics,
  plasma_cannon: s_game_results_damage_statistics,
  plasma_mortar: s_game_results_damage_statistics,
  plasma_turret: s_game_results_damage_statistics,
  banshee: s_game_results_damage_statistics,
  ghost: s_game_results_damage_statistics,
  mongoose: s_game_results_damage_statistics,
  scorpion: s_game_results_damage_statistics,
  scorpion_gunner: s_game_results_damage_statistics,
  spectre_driver: s_game_results_damage_statistics,
  spectre_gunner: s_game_results_damage_statistics,
  warthog_driver: s_game_results_damage_statistics,
  warthog_gunner: s_game_results_damage_statistics,
  warthog_gunner_gauss: s_game_results_damage_statistics,
  wraith: s_game_results_damage_statistics,
  wraith_anti_infantry: s_game_results_damage_statistics,
  tank: s_game_results_damage_statistics,
  chopper: s_game_results_damage_statistics,
  hornet: s_game_results_damage_statistics,
  mantis: s_game_results_damage_statistics,
  mauler: s_game_results_damage_statistics,
  sentinel_beam: s_game_results_damage_statistics,
  sentinel_rpg: s_game_results_damage_statistics,
  teleporter: s_game_results_damage_statistics,
  proximity_mine: s_game_results_damage_statistics,
  elephant_turret: s_game_results_damage_statistics,
});
export type s_game_results_player_damage_source_statistics = c.infer<
  typeof s_game_results_player_damage_source_statistics
>;

/** 0x446 bytes. */
export const s_game_results_player_statistics = c.struct({
  statistics: s_game_results_statistics,
  interest_statistics: c.i16().array(11),
  medals: s_game_results_player_statistics_medals,
  achievements: s_game_results_player_statistics_achievements,
  vehicles_used: c.i16().array(10),
  damage_statistics: s_game_results_player_damage_source_statistics,
});
export type s_game_results_player_statistics = c.infer<
  typeof s_game_results_player_statistics
>;

/** Ares per-player statistics (`mps1` 2.1, 0x4464 bytes), nested in `_par`. */
export class s_blf_chunk_multiplayer_player_statistics extends CStructBLFChunk(
  c.struct(
    {
      players: s_game_results_player_statistics
        .array(k_maximum_players)
        .padBefore(4),
    },
    { endian: 'little' },
  ),
) {}

// ---- mps2

export const s_blf_chunk_multiplayer_player_vs_player_statistic = c.struct({
  kills: c.i16(),
  deaths: c.i16(),
});
export type s_blf_chunk_multiplayer_player_vs_player_statistic = c.infer<
  typeof s_blf_chunk_multiplayer_player_vs_player_statistic
>;

/** Ares player-vs-player kills and deaths (`mps2` 2.1, 0x404 bytes), nested in `_par`. */
export class s_blf_chunk_multiplayer_player_vs_player_statistics extends CStructBLFChunk(
  c.struct(
    {
      players: s_blf_chunk_multiplayer_player_vs_player_statistic
        .array(k_maximum_players)
        .array(k_maximum_players)
        .padBefore(4),
    },
    { endian: 'little' },
  ),
) {}

// ---- mps3

/** Ares per-team statistics (`mps3` 2.1, 0x664 bytes), nested in `_par`. */
export class s_blf_chunk_multiplayer_team_statistics extends CStructBLFChunk(
  c.struct(
    {
      teams: s_game_results_statistics.array(k_maximum_teams).padBefore(4),
    },
    { endian: 'little' },
  ),
) {}

// ---- clif

/** Ares local display info (`clif` 1.1, 12 bytes). */
export class s_blf_chunk_local_info extends CStructBLFChunk(
  c.struct(
    {
      display_mode: c.i32(),
      screen_width: c.i32(),
      screen_height: c.i32(),
    },
    { endian: 'little' },
  ),
) {}

// ---- file reading

const k_header_size = c.sizeof(s_blf_header);

/**
 * Read `chunks` in order from the start of `buffer`, like blf_lib's `BlfFile::read`: every chunk
 * must be present, in order, with a matching signature and version; an `_eof`'s `file_size` must
 * equal the bytes before it. Trailing bytes are ignored.
 */
function read_chunks_in_order(
  buffer: Uint8Array,
  endian: c.Endian,
  chunks: readonly BLFChunk[],
): void {
  let offset = 0;
  for (const chunk of chunks) {
    const meta = getBlfChunkMeta(chunk);
    if (offset + k_header_size > buffer.length) {
      throw new BlfError(
        `${meta.signature} Chunk not found: file ends at offset ${offset}`,
      );
    }
    const header = c.read(
      s_blf_header,
      buffer.subarray(offset, offset + k_header_size),
      'big',
    );
    if (
      header.signature !== meta.signature ||
      header.major !== meta.major ||
      header.minor !== meta.minor
    ) {
      throw new BlfError(
        `${meta.signature} Chunk not found: got ${header.signature} ${header.major}.${header.minor} at offset ${offset}`,
      );
    }
    if (
      header.chunk_length < k_header_size ||
      offset + header.chunk_length > buffer.length
    ) {
      throw new BlfError(
        `${meta.signature} chunk at offset ${offset} has invalid chunk_length ${header.chunk_length}`,
      );
    }
    chunk.read_body(
      buffer.subarray(offset + k_header_size, offset + header.chunk_length),
      endian,
    );
    const file_size = (chunk as { file_size?: unknown }).file_size;
    if (
      meta.signature === '_eof' &&
      typeof file_size === 'number' &&
      file_size !== offset
    ) {
      throw new BlfError(
        `_eof has an invalid size: file_size ${file_size}, expected ${offset}`,
      );
    }
    offset += header.chunk_length;
  }
}

// ---- _par

/**
 * Ares game results statistics (`_par` 1.1): a chunk count, then nested `mps1`, `mps2`, `mps3`.
 */
export class s_blf_chunk_multiplayer_statistics extends BLFChunkBase {
  mps1 = new s_blf_chunk_multiplayer_player_statistics();
  mps2 = new s_blf_chunk_multiplayer_player_vs_player_statistics();
  mps3 = new s_blf_chunk_multiplayer_team_statistics();

  read_body(payload: Uint8Array, endian: c.Endian): void {
    if (payload.length < 4) {
      throw new BlfError(
        `Cannot read _par chunk: need at least 4 bytes, got ${payload.length}`,
      );
    }
    // Skip the chunk count, as blf_lib does.
    read_chunks_in_order(payload.subarray(4), endian, [
      this.mps1,
      this.mps2,
      this.mps3,
    ]);
  }

  write_body(endian: c.Endian): Uint8Array {
    const chunks = write_blffile(endian, [this.mps1, this.mps2, this.mps3]);
    const out = new Uint8Array(4 + chunks.length);
    new DataView(out.buffer).setUint32(0, 3, false);
    out.set(chunks, 4);
    return out;
  }
}

// ---- mpev

export {
  e_game_results_data_type,
  type s_game_results_data_carry,
  type s_game_results_data_kill,
  type s_game_results_data_score,
  type s_game_results_event,
} from '@blamnetwork/blf/halo3/v12070_08_09_05_2031_halo3_ship';

/** Ares game results events: Halo 3's `mpev` 2.1, little-endian. */
export class s_blf_chunk_multiplayer_events extends h3_multiplayer_events {
  read_body(payload: Uint8Array): void {
    super.read_body(payload, 'little');
  }

  write_body(): Uint8Array {
    return super.write_body('little');
  }
}

// Applied by call: web_private compiles with legacy experimentalDecorators, which rejects blf-ts's
// TC39 decorator signature.
const ctx = {} as ClassDecoratorContext;
blf.chunk('mpgd', 2.1)(s_blf_chunk_multiplayer_game_description, ctx);
blf.chunk('mpmo', 2.1)(s_blf_chunk_multiplayer_matchmaking_options, ctx);
blf.chunk('mpvr', 3.1)(s_blf_chunk_game_variant, ctx);
blf.chunk('mppl', 2.1)(s_blf_chunk_multiplayer_players, ctx);
blf.chunk('mptm', 1.1)(s_blf_chunk_multiplayer_teams, ctx);
blf.chunk('mpma', 2.1)(s_blf_chunk_multiplayer_machines, ctx);
blf.chunk('mps1', 2.1)(s_blf_chunk_multiplayer_player_statistics, ctx);
blf.chunk('mps2', 2.1)(
  s_blf_chunk_multiplayer_player_vs_player_statistics,
  ctx,
);
blf.chunk('mps3', 2.1)(s_blf_chunk_multiplayer_team_statistics, ctx);
blf.chunk('_par', 1.1)(s_blf_chunk_multiplayer_statistics, ctx);
blf.chunk('clif', 1.1)(s_blf_chunk_local_info, ctx);

// ---- multi

/**
 * Ares multiplayer game results:
 * `_blf athr mpgd mpmo mpvr mppl mptm mpma _par mpev glcp clif _eof`.
 */
export interface multi {
  _blf: s_blf_chunk_start_of_file;
  athr: s_blf_chunk_author;
  mpgd: s_blf_chunk_multiplayer_game_description;
  mpmo: s_blf_chunk_multiplayer_matchmaking_options;
  mpvr: s_blf_chunk_game_variant;
  mppl: s_blf_chunk_multiplayer_players;
  mptm: s_blf_chunk_multiplayer_teams;
  mpma: s_blf_chunk_multiplayer_machines;
  _par: s_blf_chunk_multiplayer_statistics;
  mpev: s_blf_chunk_multiplayer_events;
  glcp: s_blf_chunk_game_local_players;
  clif: s_blf_chunk_local_info;
  _eof: s_blf_chunk_end_of_file;
}

/** Read Ares multiplayer game results, or `null` if `buffer` isn't a valid one. Port of blf_lsp `ares_untracked.read_webstats`. */
export function read_webstats(buffer: Uint8Array): multi | null {
  const file: multi = {
    _blf: new s_blf_chunk_start_of_file(),
    athr: new s_blf_chunk_author(),
    mpgd: new s_blf_chunk_multiplayer_game_description(),
    mpmo: new s_blf_chunk_multiplayer_matchmaking_options(),
    mpvr: new s_blf_chunk_game_variant(),
    mppl: new s_blf_chunk_multiplayer_players(),
    mptm: new s_blf_chunk_multiplayer_teams(),
    mpma: new s_blf_chunk_multiplayer_machines(),
    _par: new s_blf_chunk_multiplayer_statistics(),
    mpev: new s_blf_chunk_multiplayer_events(),
    glcp: new s_blf_chunk_game_local_players(),
    clif: new s_blf_chunk_local_info(),
    _eof: new s_blf_chunk_end_of_file(),
  };

  try {
    // "big" is for `_blf` (Halo 3's, unpinned); every Ares chunk pins its own byte order.
    read_chunks_in_order(buffer, 'big', [
      file._blf,
      file.athr,
      file.mpgd,
      file.mpmo,
      file.mpvr,
      file.mppl,
      file.mptm,
      file.mpma,
      file._par,
      file.mpev,
      file.glcp,
      file.clif,
      file._eof,
    ]);
  } catch {
    return null;
  }

  return file;
}
