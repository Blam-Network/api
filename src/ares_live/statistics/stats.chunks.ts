import { c } from "@craftycodie/cstruct";
import { blf, CStructBLFChunk } from "@blamnetwork/blf";
import { blf_file } from "../blf_file";
import { OnlineDataSchema, s_blf_chunk_author, s_blf_chunk_end_of_file, s_blf_chunk_start_of_file } from "../chunks";

// Registered by call; see session.chunks.ts.
const k_chunk_context = {} as ClassDecoratorContext;
import { TransportSessionIdSchema } from "../sessions/session.chunks";

/**
 * BLF Chunk Schemas for Ares Statistics API
 * These schemas define the binary structure of BLF chunks used for statistics operations
 */

// Stats Query Spec Schema
const StatsQuerySpecSchema = c.struct({
  viewId: c.u32(),
  numColumnIds: c.u32(),
  columnIds: c.u16().array(64), // Max 64 column IDs
}, { endian: 'little', pack: 1 });

// Stats Query Chunk Schema
export class s_blf_chunk_stats_query extends CStructBLFChunk(
    c.struct({
      xuidCount: c.u32(),
      xuids: c.u64().array(16), // Max 16 xuids
      specCount: c.u32(),
      specs: StatsQuerySpecSchema.array(4), // Max 4 specs
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xsqq', 1.0)(s_blf_chunk_stats_query, k_chunk_context);

// Stats Query Response Column Schema
const StatsQueryResponseColumnSchema = c.struct({
  id: c.u32(),
  // Padding to align data to 8-byte boundary
  pad: c.pad(4),
  data: OnlineDataSchema,
}, { endian: 'little', pack: 1 });

// Stats Query Response Row Schema
const StatsQueryResponseRowSchema = c.struct({
  xuid: c.u64(),
  gamertag: c.string(16),
  statCount: c.u32(),
  // Padding to align stats array to 8-byte boundary
  pad: c.pad(4),
  stats: StatsQueryResponseColumnSchema.array(32), // Max 32 stats (matches resym: stats[32])
}, { endian: 'little', pack: 1 });

// Stats Query Response Leaderboard Schema
const StatsQueryResponseLeaderboardSchema = c.struct({
  leaderboardId: c.u32(),
  rowCount: c.u32(),
  rows: StatsQueryResponseRowSchema.array(16), // Max 16 rows
}, { endian: 'little', pack: 1 });

// Stats Query Response Chunk Schema
export class s_blf_chunk_stats_query_response extends CStructBLFChunk(
    c.struct({
      leaderboardCount: c.u32(),
      // Padding to align leaderboard_results array to 8-byte boundary
      pad: c.pad(4),
      leaderboards: StatsQueryResponseLeaderboardSchema.array(4), // Max 4 leaderboards
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xsqr', 1.0)(s_blf_chunk_stats_query_response, k_chunk_context);

// Online Property Schema (s_online_property: id + padding + s_online_data)
// Matches the C++ s_online_property struct (pack 8): id (u32) at 0x0, value at 0x8
const OnlinePropertySchema = c.struct({
  id: c.u32(), // e_online_property_id
  // align value to 8-byte boundary
  pad: c.pad(4),
  data: OnlineDataSchema,
}, { endian: 'little', pack: 1 });

// Stats Write Leaderboard Schema (s_online_stat_write: leaderboard_id + property_count + properties[16])
const StatsWriteLeaderboardSchema = c.struct({
  leaderboardId: c.u32(), // e_online_leaderboard_id
  propertyCount: c.u32(),
  properties: OnlinePropertySchema.array(16), // Max 16 properties (matches resym: properties[16])
}, { endian: 'little', pack: 1 });

// Stats Write Chunk Schema
// Matches s_blf_chunk_stats_write from game code: session_id + xuid + write_count + writes[4]
export class s_blf_chunk_stats_write extends CStructBLFChunk(
    c.struct({
      sessionId: TransportSessionIdSchema, // arbitrated session these writes belong to (match correlation)
      xuid: c.u64(),
      writeCount: c.u32(),
      writes: StatsWriteLeaderboardSchema.array(4), // Max 4 writes (matchmade uses 3, custom/global use 1)
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xswq', 1.0)(s_blf_chunk_stats_write, k_chunk_context);

// File schema for reading stats query requests (full BLF file with _eof)
// Matches s_blffile_stats_query structure from game code
export const SBlfFileStatsQuerySchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xsqq: s_blf_chunk_stats_query,
    _eof: s_blf_chunk_end_of_file,
});

// File schema for reading stats write requests (full BLF file with _eof)
// Matches s_blffile_stats_write structure from game code
export const SBlfFileStatsWriteSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xswq: s_blf_chunk_stats_write,
    _eof: s_blf_chunk_end_of_file,
});

export const SBlfFileStatsQueryResponseSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xsqr: s_blf_chunk_stats_query_response,
    _eof: s_blf_chunk_end_of_file,
});

// Type exports

// Helper type exports for nested structures
export type s_stats_query_spec = c.infer<typeof StatsQuerySpecSchema>;
export type s_stats_query_response_column = c.infer<typeof StatsQueryResponseColumnSchema>;
export type s_stats_query_response_row = c.infer<typeof StatsQueryResponseRowSchema>;
export type s_stats_query_response_leaderboard = c.infer<typeof StatsQueryResponseLeaderboardSchema>;
export type s_stats_write_leaderboard = c.infer<typeof StatsWriteLeaderboardSchema>;
export type s_online_property = c.infer<typeof OnlinePropertySchema>;

