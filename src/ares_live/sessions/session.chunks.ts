import { c } from "../../cstruct";
import { blf, SBlfChunkEndOfFileSchema } from "../../blf";
import { randomBytes } from "crypto";
import { Tuple } from "src/cstruct/utils";
import { SBlfChunkAuthorSchema, SBlfChunkStartOfFileSchema } from "../chunks";

/**
 * BLF Chunk Schemas for Ares Session API
 * These schemas define the binary structure of BLF chunks used for session operations
 */

const TransportSecureAddressSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'data', type: 'u8', count: 320 },
    ],
});

export type s_transport_secure_address = c.infer<typeof TransportSecureAddressSchema>;

const TransportSessionIdSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'data', type: 'u8', count: 8 },
    ],
});

export type s_transport_secure_identifier = c.infer<typeof TransportSessionIdSchema>;
export function randomTransportSessionId(): s_transport_secure_identifier {
    return {
        data: Array.from(randomBytes(8)) as Tuple<number, 8>,
    };
}

const TransportSessionKeySchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'data', type: 'u8', count: 16 },
    ],
});
export function randomTransportSessionKey(): s_transport_session_key {
    return {
        data: Array.from(randomBytes(16)) as Tuple<number, 16>,
    };
}

export type s_transport_session_key = c.infer<typeof TransportSessionKeySchema>;

// Transport Session Description Schema (shared by multiple session chunks)
const TransportSessionDescriptionSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'id', type: TransportSessionIdSchema },
        { name: 'hostAddress', type: TransportSecureAddressSchema },
        { name: 'key', type: TransportSessionKeySchema },
    ],
});

// Online Data Schema (used by session search)
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

// Online Property Schema
const OnlinePropertySchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'id', type: 'u32' },
        { name: 'padding', type: 'u32' },
        { name: 'value', type: OnlineDataSchema },
    ],
});

// Online Context Schema
const OnlineContextSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'id', type: 'u32' },
        { name: 'value', type: 'u32' },
    ],
});

const SessionFlagsSchema = new c.Bitfield([
    'create_as_host',
    'uses_presence',
    'uses_stats',
    'uses_matchmaking',
    'uses_arbitration',
    'multiplayer',
    'invites_disabled',
    'join_via_presence_disabled',
    'join_in_progress_disabled',
    'join_via_presence_friends_only',
], 'u16');

// Session Create Chunk Schema
export const SBlfChunkSessionCreateSchema = blf.createChunkSchema({
    name: 'xscc',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'secureAddress', type: TransportSecureAddressSchema },
        { name: 'flags', type: SessionFlagsSchema },
        { name: 'maxPublicSlots', type: 'u32' },
        { name: 'maxPrivateSlots', type: 'u32' },
        { name: 'userXuid', type: 'u64' },
    ],
});

// Session Create Response Chunk Schema
export const SBlfChunkSessionCreateResponseSchema = blf.createChunkSchema({
    name: 'xscr',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'sessionDescription', type: TransportSessionDescriptionSchema },
        { name: 'nonce', type: 'u64' },
    ],
});

export function randomNonce(): bigint {
    return randomBytes(8).readBigUInt64LE(0);
}

// Session Modify Chunk Schema
export const SBlfChunkSessionModifySchema = blf.createChunkSchema({
    name: 'xscm',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'identifier', type: TransportSessionIdSchema },
        { name: 'flags', type: SessionFlagsSchema },
        { name: 'maxPublicSlots', type: 'u32' },
        { name: 'maxPrivateSlots', type: 'u32' },
    ],
});

// Session Join Player Schema
const SessionJoinPlayerSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'xuid', type: 'u64' },
        { name: 'secureAddress', type: TransportSecureAddressSchema },
    ],
});

// Session Join Chunk Schema
export const SBlfChunkSessionJoinSchema = blf.createChunkSchema({
    name: 'xsj ',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'sessionId', type: TransportSessionIdSchema },
        { name: 'playerCount', type: 'u32' },
        { name: 'players', type: SessionJoinPlayerSchema, count: 16 }, // Max 16 players
    ],
});

// Session Get By Secure Address Chunk Schema
export const SBlfChunkSessionGetBySecureAddressSchema = blf.createChunkSchema({
    name: 'xsga',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'secureAddress', type: TransportSecureAddressSchema },
    ],
});

// Session Get By Secure Address Response Chunk Schema
export const SBlfChunkSessionGetBySecureAddressResponseSchema = blf.createChunkSchema({
    name: 'xsgr',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'sessionId', type: TransportSessionIdSchema },
    ],
});

// Session Search Result Schema
const OnlineSessionSearchResultSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'sessionName', type: new c.String(64) },
        { name: 'description', type: TransportSessionDescriptionSchema },
        { name: 'openPublicSlots', type: 'u32' },
        { name: 'openPrivateSlots', type: 'u32' },
        { name: 'filledPublicSlots', type: 'u32' },
        { name: 'filledPrivateSlots', type: 'u32' },
        { name: 'propertyCount', type: 'u32' },
        { name: 'padding', type: 'padding', count: 1 },
        { name: 'properties', type: OnlinePropertySchema, count: 10 }, // Max 10 properties
        { name: 'contextCount', type: 'u32' },
        { name: 'contexts', type: OnlineContextSchema, count: 10 }, // Max 10 contexts
    ],
});

// Session Search Response Chunk Schema
export const SBlfChunkSessionSearchResponseSchema = blf.createChunkSchema({
    name: 'xssr',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'resultCount', type: 'u32' },
        { name: 'results', type: OnlineSessionSearchResultSchema, count: 10 }, // Max 10 results
        { name: 'usableAddresses', type: 'u32', count: 16 }, // Max 16 addresses
    ],
});

// File schemas for reading session requests (full BLF files with _eof)
export const SBlfFileSessionCreateSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionCreateSchema,
    SBlfChunkEndOfFileSchema,
]);

export const SBlfFileSessionModifySchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionModifySchema,
    SBlfChunkEndOfFileSchema,
]);

export const SBlfFileSessionJoinSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionJoinSchema,
    SBlfChunkEndOfFileSchema,
]);

export const SBlfFileSessionGetBySecureAddressSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionGetBySecureAddressSchema,
    SBlfChunkEndOfFileSchema,
]);

// File schemas for writing session responses
export const SBlfFileSessionCreateResponseSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionCreateResponseSchema,
    SBlfChunkEndOfFileSchema,
]);

export const SBlfFileSessionSearchResponseSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionSearchResponseSchema,
    SBlfChunkEndOfFileSchema,
]);

export const SBlfFileSessionGetBySecureAddressResponseSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionGetBySecureAddressResponseSchema,
    SBlfChunkEndOfFileSchema,
]);

// Type exports
export type s_blf_chunk_session_create = blf.infer<typeof SBlfChunkSessionCreateSchema>;
export type s_blf_chunk_session_create_response = blf.infer<typeof SBlfChunkSessionCreateResponseSchema, false>;
export type s_blf_chunk_session_modify = blf.infer<typeof SBlfChunkSessionModifySchema>;
export type s_blf_chunk_session_join = blf.infer<typeof SBlfChunkSessionJoinSchema>;
export type s_blf_chunk_session_get_by_secure_address = blf.infer<typeof SBlfChunkSessionGetBySecureAddressSchema>;
export type s_blf_chunk_session_get_by_secure_address_response = blf.infer<typeof SBlfChunkSessionGetBySecureAddressResponseSchema, false>;
export type s_blf_chunk_session_search_response = blf.infer<typeof SBlfChunkSessionSearchResponseSchema, false>;

// Helper type exports for nested structures
export type s_transport_session_description = c.infer<typeof TransportSessionDescriptionSchema>;
export type s_online_data = c.infer<typeof OnlineDataSchema>;
export type s_online_property = c.infer<typeof OnlinePropertySchema>;
export type s_online_context = c.infer<typeof OnlineContextSchema>;
export type s_online_session_search_result = c.infer<typeof OnlineSessionSearchResultSchema>;

