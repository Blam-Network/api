import { blf, s_blf_chunk_end_of_file } from "src/blf";
import { c } from "src/cstruct";

// Use environment variable or fallback to a default version
// This avoids loading package.json at build time which can cause memory issues
const getVersion = (): string => {
    if (typeof process !== 'undefined' && process.env?.APP_VERSION) {
        return process.env.APP_VERSION;
    }
    // Fallback version - can be set via build script
    return '2.0.0';
};

export const DEFAULT_BLF_CHUNK: s_blf_chunk_start_of_file = {
    bom: 0xFFFE,
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
        { name: 'bom', type: new c.MagicNumber(0xFFFE, 'u16') },
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