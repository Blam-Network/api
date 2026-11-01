import { type BLFChunk, write_blffile } from '@blamnetwork/blf';
import { s_blf_chunk_start_of_file } from '@blamnetwork/blf/halo3/v12070_08_09_05_2031_halo3_ship';
import { s_blf_chunk_author } from './s_blf_chunk_author';
import { s_blf_chunk_end_of_file } from './s_blf_chunk_end_of_file';
import { s_blf_chunk_game_local_players } from './ares_webstats_game_local_players';
import {
  e_game_results_data_type,
  read_webstats,
  s_blf_chunk_game_variant,
  s_blf_chunk_local_info,
  s_blf_chunk_multiplayer_events,
  s_blf_chunk_multiplayer_game_description,
  s_blf_chunk_multiplayer_machines,
  s_blf_chunk_multiplayer_matchmaking_options,
  s_blf_chunk_multiplayer_players,
  s_blf_chunk_multiplayer_statistics,
  s_blf_chunk_multiplayer_teams,
} from './ares_webstats';

function payloadOffset(bytes: Uint8Array, signature: string): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 12 <= bytes.length) {
    if (
      String.fromCharCode(...bytes.subarray(offset, offset + 4)) === signature
    ) {
      return offset + 12;
    }
    offset += view.getUint32(offset + 4, false);
  }
  throw new Error(`no ${signature} chunk`);
}

function writeMulti(): Uint8Array {
  const mpgd = new s_blf_chunk_multiplayer_game_description();
  mpgd.team_game = true;
  mpgd.game_id = 0x0102_0304_0506_0708n;
  mpgd.map_id = 0x1234_5678;
  mpgd.map_variant_name = 'Guardian';
  mpgd.start_time = new Date(1_700_000_000_000);

  const mppl = new s_blf_chunk_multiplayer_players();
  mppl.players[0].player_exists = true;
  mppl.players[0].player_configuration_from_client.player_name = 'Player One';
  mppl.players[0].score = 0x0102;

  const mptm = new s_blf_chunk_multiplayer_teams();
  mptm.teams[0] = { exists: true, standing: 0, score: 0x0304 };

  const mpma = new s_blf_chunk_multiplayer_machines();
  mpma.machines[0].session_info.network_version_number = 0x0a0b_0c0d;

  const par = new s_blf_chunk_multiplayer_statistics();
  par.mps1.players[0].statistics.kills = 24;
  par.mps1.players[0].interest_statistics[0] = 7;
  par.mps1.players[0].damage_statistics.proximity_mine.kills = 4;

  const mpev = new s_blf_chunk_multiplayer_events();
  mpev.events[0] = {
    type_: e_game_results_data_type._score,
    player_references: [0, -1],
    score_data: {
      position: { x: 1, y: 2, z: 3 },
      weapon_index: 4,
      score_type: 5,
    },
    time: 60,
  };

  const chunks: BLFChunk[] = [
    s_blf_chunk_start_of_file.create(''),
    s_blf_chunk_author.for_ares(),
    mpgd,
    new s_blf_chunk_multiplayer_matchmaking_options(),
    new s_blf_chunk_game_variant(),
    mppl,
    mptm,
    mpma,
    par,
    mpev,
    new s_blf_chunk_game_local_players(),
    new s_blf_chunk_local_info(),
    new s_blf_chunk_end_of_file(),
  ];
  return write_blffile('big', chunks);
}

describe('ares read_webstats', () => {
  it('has blf_lib sizes', () => {
    const sizes: [BLFChunk, number][] = [
      [new s_blf_chunk_multiplayer_game_description(), 0x174],
      [new s_blf_chunk_multiplayer_matchmaking_options(), 0x5c],
      [new s_blf_chunk_game_variant(), 0x264],
      [new s_blf_chunk_multiplayer_players(), 0x11e4],
      [new s_blf_chunk_multiplayer_teams(), 0x44],
      [new s_blf_chunk_multiplayer_machines(), 0x1744],
      [new s_blf_chunk_multiplayer_events(), 0x8ca4],
      [new s_blf_chunk_game_local_players(), 0x2f04],
      [new s_blf_chunk_local_info(), 12],
    ];
    for (const [chunk, size] of sizes) {
      expect(chunk.write_body('big').length).toBe(size);
    }
    expect(
      new s_blf_chunk_multiplayer_statistics().mps1.write_body('big').length,
    ).toBe(17508);
  });

  it('reads back what it writes', () => {
    const multi = read_webstats(writeMulti());
    expect(multi).not.toBeNull();
    expect(multi!.mpgd.game_id).toBe(0x0102_0304_0506_0708n);
    expect(multi!.mpgd.map_id).toBe(0x1234_5678);
    expect(multi!.mpgd.start_time).toEqual(new Date(1_700_000_000_000));
    expect(
      multi!.mppl.players[0].player_configuration_from_client.player_name,
    ).toBe('Player One');
    expect(multi!.mppl.players[0].score).toBe(0x0102);
    expect(multi!.mptm.teams[0].score).toBe(0x0304);
    expect(multi!.mpma.machines[0].session_info.network_version_number).toBe(
      0x0a0b_0c0d,
    );
    expect(multi!._par.mps1.players[0].statistics.kills).toBe(24);
    expect(multi!._par.mps1.players[0].interest_statistics[0]).toBe(7);
    expect(
      multi!._par.mps1.players[0].damage_statistics.proximity_mine.kills,
    ).toBe(4);
    expect(multi!.mpev.events[0].score_data?.score_type).toBe(5);
  });

  it('mixes byte orders as blf_lib does', () => {
    const bytes = writeMulti();
    const view = new DataView(bytes.buffer);
    const mpgd = payloadOffset(bytes, 'mpgd');
    expect(view.getBigUint64(mpgd + 1, true)).toBe(0x0102_0304_0506_0708n); // game_id: little
    expect(view.getUint32(mpgd + 9, false)).toBe(0x1234_5678); // map_id: big
    const mptm = payloadOffset(bytes, 'mptm');
    expect(view.getInt16(mptm + 4 + 2, false)).toBe(0x0304); // score: big
    const mpev = payloadOffset(bytes, 'mpev');
    expect(view.getUint32(mpev + 4 + 32, true)).toBe(60); // time: little
  });

  it('rejects truncated files', () => {
    const bytes = writeMulti();
    expect(read_webstats(bytes.subarray(0, bytes.length - 1))).toBeNull();
    expect(read_webstats(bytes.subarray(0, 100))).toBeNull();
  });
});
