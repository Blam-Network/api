import { c } from "../../cstruct";
import { blf, SBlfChunkEndOfFileSchema } from "../../blf";
import { SBlfChunkAuthorSchema, SBlfChunkStartOfFileSchema } from "../chunks";

/**
 * BLF Chunk Schemas for Ares Statistics API
 * These schemas define the binary structure of BLF chunks used for statistics operations
 */

// Online Data Schema (used by stats query response)
const OnlineDataSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'type', type: 'u8' },
        { name: 'padding', type: 'padding', count: 7 },
        { name: 'dataAsLong', type: 'u64' },
        { name: 'dataAsDouble', type: 'f64' },
        { name: 'extension', type: 'u64' },
    ],
});

// Stats Query Spec Schema
const StatsQuerySpecSchema = c.createCStruct({
    endian: 'big',
    pack: 1,
    fields: [
        { name: 'viewId', type: 'u32' },
        { name: 'numColumnIds', type: 'u32' },
        { name: 'columnIds', type: 'u32', count: 64 }, // Max 64 column IDs
    ],
});

// Stats Query Chunk Schema
export const SBlfChunkStatsQuerySchema = blf.createChunkSchema({
    name: 'xsqq',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'big',
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
        { name: 'stats', type: StatsQueryResponseColumnSchema, count: 64 }, // Max 64 stats
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
    endian: 'big',
    pack: 1,
    fields: [
        { name: 'leaderboardCount', type: 'u32' },
        { name: 'leaderboards', type: StatsQueryResponseLeaderboardSchema, count: 4 }, // Max 4 leaderboards
    ],
});

// File schema for reading stats query requests (full BLF file with _eof)
export const SBlfFileStatsQuerySchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkStatsQuerySchema,
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

// Helper type exports for nested structures
export type s_online_data = c.infer<typeof OnlineDataSchema>;
export type s_stats_query_spec = c.infer<typeof StatsQuerySpecSchema>;
export type s_stats_query_response_column = c.infer<typeof StatsQueryResponseColumnSchema>;
export type s_stats_query_response_row = c.infer<typeof StatsQueryResponseRowSchema>;
export type s_stats_query_response_leaderboard = c.infer<typeof StatsQueryResponseLeaderboardSchema>;

