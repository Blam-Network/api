import { c } from "../../cstruct";
import { blf, SBlfChunkEndOfFileSchema } from "../../blf";
import { SBlfChunkAuthorSchema, SBlfChunkStartOfFileSchema, OnlineDataSchema } from "../chunks";
import { TransportSessionIdSchema } from "../sessions/session.chunks";

/**
 * BLF Chunk Schemas for Ares Statistics API
 * These schemas define the binary structure of BLF chunks used for statistics operations
 */

// Stats Query Spec Schema
const StatsQuerySpecSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'viewId', type: 'u32' },
        { name: 'numColumnIds', type: 'u32' },
        { name: 'columnIds', type: 'u16', count: 64 }, // Max 64 column IDs
    ],
});

// Stats Query Chunk Schema
export const SBlfChunkStatsQuerySchema = blf.createChunkSchema({
    name: 'xsqq',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'xuidCount', type: 'u32' },
        { name: 'xuids', type: 'u64', count: 16 }, // Max 16 xuids
        { name: 'specCount', type: 'u32' },
        { name: 'specs', type: StatsQuerySpecSchema, count: 4 }, // Max 4 specs
    ],
});

// Stats Query Response Column Schema
const StatsQueryResponseColumnSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'id', type: 'u32' },
        { name: 'padding', type: 'padding', count: 4 }, // Padding to align data to 8-byte boundary
        { name: 'data', type: OnlineDataSchema },
    ],
});

// Stats Query Response Row Schema
const StatsQueryResponseRowSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'xuid', type: 'u64' },
        { name: 'gamertag', type: new c.String(16) },
        { name: 'statCount', type: 'u32' },
        { name: 'padding', type: 'padding', count: 4 }, // Padding to align stats array to 8-byte boundary
        { name: 'stats', type: StatsQueryResponseColumnSchema, count: 32 }, // Max 32 stats (matches resym: stats[32])
    ],
});

// Stats Query Response Leaderboard Schema
const StatsQueryResponseLeaderboardSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'leaderboardId', type: 'u32' },
        { name: 'rowCount', type: 'u32' },
        { name: 'rows', type: StatsQueryResponseRowSchema, count: 16 }, // Max 16 rows
    ],
});

// Stats Query Response Chunk Schema
export const SBlfChunkStatsQueryResponseSchema = blf.createChunkSchema({
    name: 'xsqr',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'leaderboardCount', type: 'u32' },
        { name: 'padding', type: 'padding', count: 4 }, // Padding to align leaderboard_results array to 8-byte boundary
        { name: 'leaderboards', type: StatsQueryResponseLeaderboardSchema, count: 4 }, // Max 4 leaderboards
    ],
});

// Online Property Schema (s_online_property: id + padding + s_online_data)
// Matches the C++ s_online_property struct (pack 8): id (u32) at 0x0, value at 0x8
const OnlinePropertySchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'id', type: 'u32' }, // e_online_property_id
        { name: 'padding', type: 'padding', count: 4 }, // align value to 8-byte boundary
        { name: 'data', type: OnlineDataSchema },
    ],
});

// Stats Write Leaderboard Schema (s_online_stat_write: leaderboard_id + property_count + properties[16])
const StatsWriteLeaderboardSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'leaderboardId', type: 'u32' }, // e_online_leaderboard_id
        { name: 'propertyCount', type: 'u32' },
        { name: 'properties', type: OnlinePropertySchema, count: 16 }, // Max 16 properties (matches resym: properties[16])
    ],
});

// Stats Write Chunk Schema
// Matches s_blf_chunk_stats_write from game code: session_id + xuid + write_count + writes[4]
export const SBlfChunkStatsWriteSchema = blf.createChunkSchema({
    name: 'xswq',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'sessionId', type: TransportSessionIdSchema }, // arbitrated session these writes belong to (match correlation)
        { name: 'xuid', type: 'u64' },
        { name: 'writeCount', type: 'u32' },
        { name: 'writes', type: StatsWriteLeaderboardSchema, count: 4 }, // Max 4 writes (matchmade uses 3, custom/global use 1)
    ],
});

// File schema for reading stats query requests (full BLF file with _eof)
// Matches s_blffile_stats_query structure from game code
export const SBlfFileStatsQuerySchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkStatsQuerySchema,
    SBlfChunkEndOfFileSchema,
]);

// File schema for reading stats write requests (full BLF file with _eof)
// Matches s_blffile_stats_write structure from game code
export const SBlfFileStatsWriteSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkStatsWriteSchema,
    SBlfChunkEndOfFileSchema,
]);

export const SBlfFileStatsQueryResponseSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkStatsQueryResponseSchema,
    SBlfChunkEndOfFileSchema,
]);

// Type exports
export type s_blf_chunk_stats_query = blf.infer<typeof SBlfChunkStatsQuerySchema>;
export type s_blf_chunk_stats_query_response = blf.infer<typeof SBlfChunkStatsQueryResponseSchema, false>;
export type s_blf_chunk_stats_write = blf.infer<typeof SBlfChunkStatsWriteSchema>;

// Helper type exports for nested structures
export type s_stats_query_spec = c.infer<typeof StatsQuerySpecSchema>;
export type s_stats_query_response_column = c.infer<typeof StatsQueryResponseColumnSchema>;
export type s_stats_query_response_row = c.infer<typeof StatsQueryResponseRowSchema>;
export type s_stats_query_response_leaderboard = c.infer<typeof StatsQueryResponseLeaderboardSchema>;
export type s_stats_write_leaderboard = c.infer<typeof StatsWriteLeaderboardSchema>;
export type s_online_property = c.infer<typeof OnlinePropertySchema>;

