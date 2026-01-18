import { blf, s_blf_chunk_end_of_file } from "src/blf";
import { c } from "src/cstruct";

// Hardcoded version to avoid any runtime memory issues
// Can be overridden via APP_VERSION environment variable if needed
const getVersion = (): string => {
    return (typeof process !== 'undefined' && process.env?.APP_VERSION) || '2.0.0';
};

export const DEFAULT_BLF_CHUNK: s_blf_chunk_start_of_file = {
    bom: 0xFEFF,
    fileName: '',
};

export const ARES_LIVE_AUTHOR: s_blf_chunk_author = {
    programName: 'web_private',
    buildNumberSequence: 1,
    buildNumber: 0,
    buildString: getVersion(),
    authorName: 'Blam Network',
};

export const DEFAULT_EOF_CHUNK: s_blf_chunk_end_of_file = {
    authenticationType: 0,
    totalFileSize: 0,
};

// BLF file chunk schemas (start_of_file, author, end_of_file)
export const SBlfChunkStartOfFileSchema = blf.createChunkSchema({
    name: '_blf',
    majorVersion: 1,
    minorVersion: 2,
    endian: 'big',
    fields: [
        { name: 'bom', type: new c.MagicNumber(0xFEFF, 'u16') }, // chunk is BE except the BOM
        { name: 'fileName', type: new c.String(32) },
        { name: 'padding', type: 'padding', count: 2 },
    ],
});

export type s_blf_chunk_start_of_file = blf.infer<typeof SBlfChunkStartOfFileSchema, false>;

export const SBlfChunkAuthorSchema = blf.createChunkSchema({
    name: 'athr',
    majorVersion: 3,
    minorVersion: 1,
    endian: 'big',
    fields: [
        { name: 'programName', type: new c.String(16) },
        { name: 'buildNumberSequence', type: 'u32' },
        { name: 'buildNumber', type: 'u32' },
        { name: 'buildString', type: new c.String(28) },
        { name: 'authorName', type: new c.String(16) },
    ],
});

export type s_blf_chunk_author = blf.infer<typeof SBlfChunkAuthorSchema, false>;

// Online Data Schema (used by session search and stats query response)
// C++ struct has: type (1 byte) + padding (7 bytes) + union (16 bytes) = 24 bytes total
// The union contains various types, largest member is 16 bytes (string/binary structs)
// Pack alignment will automatically add 7 bytes of padding after 'type' to align 'data' to offset 8
export const OnlineDataSchema = c.createCStruct({
    endian: 'little',
    pack: 8,
    fields: [
        { name: 'type', type: new c.Enum({
            context: 0,
            integer: 1,
            qword: 2,
            double: 3,
            unicode: 4,
            float: 5,
            binary: 6,
            date_time: 7,
            null: 255,
        } satisfies Record<string, number>, 'u8') },
        { name: 'data', type: new c.Union({
            data_as_long: c.createCStruct({
                endian: 'little',
                pack: 8,
                fields: [
                    { name: 'data', type: 'u64' },
                ],
            }),
            data_as_qword: c.createCStruct({
                endian: 'little',
                pack: 8,
                fields: [
                    { name: 'data', type: 'u64' },
                ],
            }),
            data_as_double: c.createCStruct({
                endian: 'little',
                pack: 8,
                fields: [
                    { name: 'data', type: 'f64' },
                ],
            }),
            data_as_float: c.createCStruct({
                endian: 'little',
                pack: 8,
                fields: [
                    { name: 'data', type: 'f32' },
                ],
            }),
            data_as_binary: c.createCStruct({
                endian: 'little',
                pack: 8,
                fields: [
                    { name: 'data', type: 'u8', count: 16 },
                ],
            }),
            data_as_date_time: c.createCStruct({
                endian: 'little',
                pack: 8,
                fields: [
                    { name: 'data', type: 'u64' },
                ],
            }),
            data_as_null: c.createCStruct({
                endian: 'little',
                pack: 8,
                fields: [
                    { name: 'padding', type: 'padding', count: 16 },
                ],
            }),
        }) },
    ],
});

export type s_online_data = c.infer<typeof OnlineDataSchema>;