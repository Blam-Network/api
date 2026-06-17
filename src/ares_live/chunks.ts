import { blf, s_blf_chunk_end_of_file } from "src/blf";
import { c } from "src/cstruct";

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

export const SBlfChunkStartOfFileSchema = blf.createChunkSchema({
    name: '_blf',
    majorVersion: 1,
    minorVersion: 2,
    endian: 'big',
    fields: {
        bom: c.MagicNumber(0xFEFF, c.u16()),
        fileName: c.String(32, 'utf8', { padAfter: 2 }),
    },
});

export type s_blf_chunk_start_of_file = blf.infer<typeof SBlfChunkStartOfFileSchema, false>;

export const SBlfChunkAuthorSchema = blf.createChunkSchema({
    name: 'athr',
    majorVersion: 3,
    minorVersion: 1,
    endian: 'big',
    fields: {
        programName: c.String(16),
        buildNumberSequence: c.u32(),
        buildNumber: c.u32(),
        buildString: c.String(28),
        authorName: c.String(16),
    },
});

export type s_blf_chunk_author = blf.infer<typeof SBlfChunkAuthorSchema, false>;

// C++ struct: type (1 byte) + padding (7 bytes) + union (16 bytes) = 24 bytes
export const OnlineDataSchema = c.struct({
    type: c.Enum({
        context: 0,
        integer: 1,
        qword: 2,
        double: 3,
        unicode: 4,
        float: 5,
        binary: 6,
        date_time: 7,
        null: 255,
    } satisfies Record<string, number>, c.u8(), { padAfter: 7 }),
    data: c.Union({
        data_as_long: c.struct({ data: c.u64() }),
        data_as_qword: c.struct({ data: c.u64() }),
        data_as_double: c.struct({ data: c.f64() }),
        data_as_float: c.struct({ data: c.f32() }),
        data_as_binary: c.struct({ data: c.array(c.u8(), 16) }),
        data_as_date_time: c.struct({ data: c.u64() }),
        data_as_null: c.struct({ padding: c.pad(16) }),
    }),
});

export type s_online_data = c.infer<typeof OnlineDataSchema>;
