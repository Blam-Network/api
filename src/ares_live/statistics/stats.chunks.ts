import { c } from "../../cstruct";
import { blf, SBlfChunkEndOfFileSchema } from "../../blf";
import { SBlfChunkAuthorSchema, SBlfChunkStartOfFileSchema, OnlineDataSchema } from "../chunks";

const StatsQuerySpecSchema = c.struct({
    viewId: c.u32(),
    numColumnIds: c.u32(),
    columnIds: c.array(c.u16(), 64),
});

export const SBlfChunkStatsQuerySchema = blf.createChunkSchema({
    name: 'xsqq',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    fields: {
        xuidCount: c.u32(),
        xuids: c.array(c.u64(), 16),
        specCount: c.u32(),
        specs: c.array(StatsQuerySpecSchema.field(), 4),
    },
});

const StatsQueryResponseColumnSchema = c.struct({
    id: c.u32({ padAfter: 4 }),
    data: OnlineDataSchema.field(),
});

const StatsQueryResponseRowSchema = c.struct({
    xuid: c.u64(),
    gamertag: c.String(16),
    statCount: c.u32({ padAfter: 4 }),
    stats: c.array(StatsQueryResponseColumnSchema.field(), 32),
});

const StatsQueryResponseLeaderboardSchema = c.struct({
    leaderboardId: c.u32(),
    rowCount: c.u32(),
    rows: c.array(StatsQueryResponseRowSchema.field(), 16),
});

export const SBlfChunkStatsQueryResponseSchema = blf.createChunkSchema({
    name: 'xsqr',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    fields: {
        leaderboardCount: c.u32({ padAfter: 4 }),
        leaderboards: c.array(StatsQueryResponseLeaderboardSchema.field(), 4),
    },
});

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

export type s_blf_chunk_stats_query = blf.infer<typeof SBlfChunkStatsQuerySchema>;
export type s_blf_chunk_stats_query_response = blf.infer<typeof SBlfChunkStatsQueryResponseSchema, false>;

export type s_stats_query_spec = c.infer<typeof StatsQuerySpecSchema>;
export type s_stats_query_response_column = c.infer<typeof StatsQueryResponseColumnSchema>;
export type s_stats_query_response_row = c.infer<typeof StatsQueryResponseRowSchema>;
export type s_stats_query_response_leaderboard = c.infer<typeof StatsQueryResponseLeaderboardSchema>;
