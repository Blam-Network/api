import { find_chunk } from '@blamnetwork/blf';
import {
  build_hopper_statistics_file,
  build_recent_players_file,
  build_user_file,
  s_blf_chunk_matchmaking_hopper_statistics,
  s_blf_chunk_player_data,
  s_blf_chunk_user_recent_players,
} from '.';

// Golden files written by @blam-network/blf_lsp 1.10.10 (ares_untracked) for the same inputs.
const START_OF_FILE = (name: string) =>
  `5f626c660000003000010002fffe${Buffer.from(name, 'latin1')
    .toString('hex')
    .padEnd(64, '0')}0000`;
const AUTHOR =
  '617468720000005000030001' +
  '626c665f6c69622076312e31352e3134' + // "blf_lib v1.15.14"
  '00000001ffffffff' + // build_number_sequence 1, build_number -1
  `${Buffer.from('untracked').toString('hex').padEnd(56, '0')}${'00'.repeat(
    16,
  )}`;
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const fromHex = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));

const USER_FILE =
  START_OF_FILE('ares user') +
  AUTHOR +
  '667570640000003800030001' +
  '44332211' +
  '0b000000' +
  '2a000000' +
  Buffer.from('custom_hoppers').toString('hex').padEnd(64, '0') +
  '5f656f660000001100010001b800000000';

const DEFAULT_USER_FILE =
  START_OF_FILE('ares user') +
  AUTHOR +
  '667570640000003800030001' +
  '00000000' +
  '01000000' +
  '00000000' +
  Buffer.from('default_hoppers').toString('hex').padEnd(64, '0') +
  '5f656f660000001100010001b800000000';

const RECENT_PLAYERS_FILE =
  START_OF_FILE('ares recent players') +
  AUTHOR +
  '6675727000000024000200010200000034124433221100000900ffff1032547698badcfe' +
  '5f656f660000001100010001a400000000';

const HOPPER_STATISTICS_FILE =
  START_OF_FILE('') +
  '6d6d687300000110000300010903000000000100f40100000000feff040302010000ff7f01000000' +
  '00'.repeat(29 * 8) +
  '5f656f6600000011000100014001000000';

describe('Ares BLF files', () => {
  test('build_user_file matches blf_lsp', () => {
    const fupd = s_blf_chunk_player_data.create({
      hopper_access: 0x11223344,
      bungie_user_role: 0b1011,
      highest_skill: 42,
      hopper_directory: 'custom_hoppers',
    });
    expect(hex(build_user_file(fupd))).toBe(USER_FILE);
  });

  test("build_user_file without fupd writes blf_lib's default", () => {
    expect(hex(build_user_file())).toBe(DEFAULT_USER_FILE);
  });

  test('fupd reads back', () => {
    const fupd = new s_blf_chunk_player_data();
    expect(find_chunk(fromHex(USER_FILE), fupd, 'big')).toBe(true);
    expect({ ...fupd }).toEqual({
      hopper_access: 0x11223344,
      bungie_user_role: 0b1011,
      highest_skill: 42,
      hopper_directory: 'custom_hoppers',
    });
  });

  test('fupd rejects a hopper_directory over 32 bytes', () => {
    expect(() =>
      build_user_file(
        s_blf_chunk_player_data.create({ hopper_directory: 'a'.repeat(33) }),
      ),
    ).toThrow();
  });

  test('build_recent_players_file matches blf_lsp and reads back', () => {
    const players = [
      { hopper_identifier: 0x1234, xuid: 0x0009000011223344n },
      { hopper_identifier: 0xffff, xuid: 0xfedcba9876543210n },
    ];
    expect(
      hex(
        build_recent_players_file(
          s_blf_chunk_user_recent_players.create(players),
        ),
      ),
    ).toBe(RECENT_PLAYERS_FILE);

    const furp = new s_blf_chunk_user_recent_players();
    expect(find_chunk(fromHex(RECENT_PLAYERS_FILE), furp, 'big')).toBe(true);
    expect(furp.players).toEqual(players);
  });

  test('build_hopper_statistics_file pads to 32 hoppers, matches blf_lsp and reads back', () => {
    const data = [
      { hopper_identifier: 1, player_count: 500 },
      { hopper_identifier: -2, player_count: 0x01020304 },
      { hopper_identifier: 0x7fff, player_count: 1 },
    ];
    expect(
      hex(
        build_hopper_statistics_file(
          s_blf_chunk_matchmaking_hopper_statistics.create(777, data),
        ),
      ),
    ).toBe(HOPPER_STATISTICS_FILE);

    const mmhs = new s_blf_chunk_matchmaking_hopper_statistics();
    expect(find_chunk(fromHex(HOPPER_STATISTICS_FILE), mmhs, 'big')).toBe(true);
    expect(mmhs.player_count).toBe(777);
    expect(mmhs.data).toHaveLength(32);
    expect(mmhs.data.slice(0, 3)).toEqual(data);
    expect(mmhs.data[31]).toEqual({ hopper_identifier: 0, player_count: 0 });
  });

  test('mmhs rejects more than 32 hoppers', () => {
    const data = Array(33).fill({ hopper_identifier: 1, player_count: 2 });
    expect(() =>
      build_hopper_statistics_file(
        s_blf_chunk_matchmaking_hopper_statistics.create(1, data),
      ),
    ).toThrow();
  });
});
