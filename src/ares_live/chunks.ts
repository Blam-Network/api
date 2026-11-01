import { c } from "@craftycodie/cstruct";
import {
    e_byte_order_mark,
    s_blf_chunk_author,
    s_blf_chunk_end_of_file,
    s_blf_chunk_start_of_file,
} from "@blamnetwork/blf/halo3/v12070_08_09_05_2031_halo3_ship";
import type { chunk_fields } from "./blf_file";

// Ares Live files frame their chunks with Halo 3's `_blf`, `athr` and `_eof`.
export { s_blf_chunk_author, s_blf_chunk_end_of_file, s_blf_chunk_start_of_file };

// Hardcoded version to avoid any runtime memory issues
// Can be overridden via APP_VERSION environment variable if needed
const getVersion = (): string => {
    return (typeof process !== 'undefined' && process.env?.APP_VERSION) || '2.0.0';
};

export const DEFAULT_BLF_CHUNK: chunk_fields<s_blf_chunk_start_of_file> = {
    byte_order_mark: e_byte_order_mark.big_endian,
    name: '',
};

export const ARES_LIVE_AUTHOR: chunk_fields<s_blf_chunk_author> = {
    program_name: 'web_private',
    build_number_sequence: 1,
    build_number: 0,
    build_string: getVersion(),
    author_name: 'Blam Network',
};

export const DEFAULT_EOF_CHUNK: chunk_fields<s_blf_chunk_end_of_file> = {
    authentication_type: 0,
    file_size: 0,
};

/** `OnlineDataSchema.type`: which member of `data` holds the value. */
export const e_online_data_type = {
    context: 0,
    integer: 1,
    qword: 2,
    double: 3,
    unicode: 4,
    float: 5,
    binary: 6,
    date_time: 7,
    null: 255,
} as const;

// Online Data Schema (used by session search and stats query response)
// C++ struct has: type (1 byte) + padding (7 bytes) + union (16 bytes) = 24 bytes total
// The union contains various types, largest member is 16 bytes (string/binary structs)
export const OnlineDataSchema = c.struct({
  type: c.enum(e_online_data_type, c.u8()),
  // align union 'data' to offset 8
  pad: c.pad(7),
  data: c.union({
            data_as_long: c.struct({
              data: c.u64(),
            }, { endian: 'little', pack: 8 }),
            data_as_qword: c.struct({
              data: c.u64(),
            }, { endian: 'little', pack: 8 }),
            data_as_double: c.struct({
              data: c.f64(),
            }, { endian: 'little', pack: 8 }),
            data_as_float: c.struct({
              data: c.f32(),
            }, { endian: 'little', pack: 8 }),
            data_as_binary: c.struct({
              data: c.u8().array(16),
            }, { endian: 'little', pack: 8 }),
            data_as_date_time: c.struct({
              data: c.u64(),
            }, { endian: 'little', pack: 8 }),
            data_as_null: c.struct({
              pad: c.pad(16),
            }, { endian: 'little', pack: 8 }),
        }),
}, { endian: 'little', pack: 8 });

export type s_online_data = c.infer<typeof OnlineDataSchema>;