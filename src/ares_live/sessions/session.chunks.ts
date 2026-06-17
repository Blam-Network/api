import { c } from "../../cstruct";
import { blf, SBlfChunkEndOfFileSchema } from "../../blf";
import { randomBytes } from "crypto";
import { Tuple } from "src/cstruct/utils";
import { SBlfChunkAuthorSchema, SBlfChunkStartOfFileSchema, OnlineDataSchema } from "../chunks";

export const TransportSecureAddressSchema = c.struct({
    data: c.array(c.u8(), 320),
});

export type s_transport_secure_address = c.infer<typeof TransportSecureAddressSchema>;

export const TransportSessionIdSchema = c.struct({
    data: c.array(c.u8(), 8),
});

enum e_ares_live_transport_identifier_flags
{
	_identifier_flags_offline = 0x00,
	_identifier_flags_online = 0x80,
	_identifier_flags_mask = 0xF0
};

export type s_transport_secure_identifier = c.infer<typeof TransportSessionIdSchema>;
export function randomTransportSessionId(): s_transport_secure_identifier
{
    const data = Array.from(randomBytes(8)) as Tuple<number, 8>;

    data[0] &= ~e_ares_live_transport_identifier_flags._identifier_flags_mask;
    data[0] |=  e_ares_live_transport_identifier_flags._identifier_flags_online;

    return {
        data,
    };
}

export const TransportSessionKeySchema = c.struct({
    data: c.array(c.u8(), 16),
});
export function randomTransportSessionKey(): s_transport_session_key {
    return {
        data: Array.from(randomBytes(16)) as Tuple<number, 16>,
    };
}

export type s_transport_session_key = c.infer<typeof TransportSessionKeySchema>;

export const TransportSessionDescriptionSchema = c.struct({
    id: TransportSessionIdSchema.field(),
    hostAddress: TransportSecureAddressSchema.field(),
    key: TransportSessionKeySchema.field(),
});

// id (4 bytes) + padding (4 bytes) + value (24 bytes) = 32 bytes
export const OnlinePropertySchema = c.struct({
    id: c.u32({ padAfter: 4 }),
    value: OnlineDataSchema.field(),
});

export const OnlineContextSchema = c.struct({
    id: c.u32(),
    value: c.u32(),
});

const SessionFlagsSchema = c.Bitfield([
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
], c.u16());

export const SBlfChunkSessionCreateSchema = blf.createChunkSchema({
    name: 'xscc',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    size: 350,
    fields: {
        secureAddress: TransportSecureAddressSchema.field(),
        flags: SessionFlagsSchema,
        maxPublicSlots: c.u32(),
        maxPrivateSlots: c.u32(),
        userXuid: c.u64(),
    },
});

export const SBlfChunkSessionCreateResponseSchema = blf.createChunkSchema({
    name: 'xscr',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    fields: {
        sessionDescription: TransportSessionDescriptionSchema.field(),
        nonce: c.u64(),
    },
});

export function randomNonce(): bigint {
    return randomBytes(8).readBigUInt64LE(0);
}

export const SBlfChunkSessionModifySchema = blf.createChunkSchema({
    name: 'xscm',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    fields: {
        identifier: TransportSessionIdSchema.field(),
        flags: SessionFlagsSchema,
        maxPublicSlots: c.u32(),
        maxPrivateSlots: c.u32(),
    },
});

export const SBlfChunkSessionDeleteSchema = blf.createChunkSchema({
    name: 'xsdl',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    fields: {
        sessionId: TransportSessionIdSchema.field(),
    },
});

export const SBlfChunkSessionGetByIdSchema = blf.createChunkSchema({
    name: 'xsgi',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    fields: {
        sessionId: TransportSessionIdSchema.field(),
    },
});

export const SBlfChunkSessionGetByIdResponseSchema = blf.createChunkSchema({
    name: 'xsir',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    fields: {
        secureAddress: TransportSecureAddressSchema.field(),
        sessionKey: TransportSessionKeySchema.field(),
        usableAddress: c.u32(),
    },
});

export const SBlfChunkSessionMigrateHostSchema = blf.createChunkSchema({
    name: 'xsmh',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    fields: {
        sessionId: TransportSessionIdSchema.field(),
        secureAddress: TransportSecureAddressSchema.field(),
    },
});

export const SBlfChunkSessionMigrateHostResponseSchema = blf.createChunkSchema({
    name: 'xsmr',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    fields: {
        sessionDescription: TransportSessionDescriptionSchema.field(),
        nonce: c.u64(),
    },
});

export const OnlineSessionSearchResultSchema = c.struct({
    sessionName: c.WString(32),
    description: TransportSessionDescriptionSchema.field(),
    openPublicSlots: c.u32(),
    openPrivateSlots: c.u32(),
    filledPublicSlots: c.u32(),
    filledPrivateSlots: c.u32(),
    propertyCount: c.u32({ padAfter: 4 }),
    properties: c.array(OnlinePropertySchema.field(), 3),
    contextCount: c.u32(),
    contexts: c.array(OnlineContextSchema.field(), 2, { padAfter: 4 }),
});

export const SBlfChunkSessionSearchResponseSchema = blf.createChunkSchema({
    name: 'xssr',
    majorVersion: 1,
    minorVersion: 0,
    endian: 'little',
    fields: {
        resultCount: c.u32(),
        results: c.array(OnlineSessionSearchResultSchema.field(), 50),
    },
});

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

export const SBlfFileSessionDeleteSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionDeleteSchema,
    SBlfChunkEndOfFileSchema,
]);

export const SBlfFileSessionMigrateHostSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionMigrateHostSchema,
    SBlfChunkEndOfFileSchema,
]);

export const SBlfFileSessionGetByIdSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionGetByIdSchema,
    SBlfChunkEndOfFileSchema,
]);

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

export const SBlfFileSessionMigrateHostResponseSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionMigrateHostResponseSchema,
    SBlfChunkEndOfFileSchema,
]);

export const SBlfFileSessionGetByIdResponseSchema = blf.createFileSchema([
    SBlfChunkStartOfFileSchema,
    SBlfChunkAuthorSchema,
    SBlfChunkSessionGetByIdResponseSchema,
    SBlfChunkEndOfFileSchema,
]);

export type s_blf_chunk_session_create = blf.infer<typeof SBlfChunkSessionCreateSchema>;
export type s_blf_chunk_session_create_response = blf.infer<typeof SBlfChunkSessionCreateResponseSchema, false>;
export type s_blf_chunk_session_modify = blf.infer<typeof SBlfChunkSessionModifySchema>;
export type s_blf_chunk_session_search_response = blf.infer<typeof SBlfChunkSessionSearchResponseSchema, false>;
export type s_blf_chunk_session_delete = blf.infer<typeof SBlfChunkSessionDeleteSchema>;
export type s_blf_chunk_session_migrate_host = blf.infer<typeof SBlfChunkSessionMigrateHostSchema>;
export type s_blf_chunk_session_migrate_host_response = blf.infer<typeof SBlfChunkSessionMigrateHostResponseSchema, false>;
export type s_blf_chunk_session_get_by_id = blf.infer<typeof SBlfChunkSessionGetByIdSchema>;
export type s_blf_chunk_session_get_by_id_response = blf.infer<typeof SBlfChunkSessionGetByIdResponseSchema, false>;

export type s_transport_session_description = c.infer<typeof TransportSessionDescriptionSchema>;
export type s_online_property = c.infer<typeof OnlinePropertySchema>;
export type s_online_context = c.infer<typeof OnlineContextSchema>;
export type s_online_session_search_result = c.infer<typeof OnlineSessionSearchResultSchema>;
