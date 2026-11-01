import { c } from "@craftycodie/cstruct";
import { blf, CStructBLFChunk } from "@blamnetwork/blf";
import { blf_file } from "../blf_file";
import { randomBytes } from "crypto";
import type { Tuple } from "@craftycodie/cstruct";
import { OnlineDataSchema, s_blf_chunk_author, s_blf_chunk_end_of_file, s_blf_chunk_start_of_file } from "../chunks";

// web_private compiles with legacy experimentalDecorators, which reject blf-ts's TC39
// decorator, so chunks are registered by call.
const k_chunk_context = {} as ClassDecoratorContext;

/**
 * BLF Chunk Schemas for Ares Session API
 * These schemas define the binary structure of BLF chunks used for session operations
 */

export const TransportSecureAddressSchema = c.struct({
  data: c.u8().array(320),
}, { endian: 'little', pack: 1 });

export type s_transport_secure_address = c.infer<typeof TransportSecureAddressSchema>;

export const TransportSessionIdSchema = c.struct({
  data: c.u8().array(8),
}, { endian: 'little', pack: 1 });

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
  data: c.u8().array(16),
}, { endian: 'little', pack: 1 });
export function randomTransportSessionKey(): s_transport_session_key {
    return {
        data: Array.from(randomBytes(16)) as Tuple<number, 16>,
    };
}

export type s_transport_session_key = c.infer<typeof TransportSessionKeySchema>;

// Transport Session Description Schema (shared by multiple session chunks)
export const TransportSessionDescriptionSchema = c.struct({
  id: TransportSessionIdSchema,
  hostAddress: TransportSecureAddressSchema,
  key: TransportSessionKeySchema,
}, { endian: 'little', pack: 1 });


// Online Property Schema
// C++: id (4 bytes at 0x0) + padding (4 bytes) + value (24 bytes at 0x8) = 32 bytes
// Pack alignment will automatically add 4 bytes of padding after 'id' to align 'value' to offset 8
export const OnlinePropertySchema = c.struct({
  id: c.u32(),
  value: OnlineDataSchema, // Aligned to offset 8 by pack
}, { endian: 'little', pack: 8 });

// Online Context Schema
export const OnlineContextSchema = c.struct({
  id: c.u32(),
  value: c.u32(),
}, { endian: 'little', pack: 8 });

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

// k_ares_live_addr_base64_max_length
export const HOST_PEER_ID_LENGTH = 128;

// Session Create Chunk Schema
export class s_blf_chunk_session_create extends CStructBLFChunk(
    c.struct({
      secureAddress: TransportSecureAddressSchema,
      flags: SessionFlagsSchema,
      maxPublicSlots: c.u32(),
      maxPrivateSlots: c.u32(),
      userXuid: c.u64(),
      hostIceEnabled: c.u8(),
      hostPeerId: c.string(HOST_PEER_ID_LENGTH),
    }, { endian: 'little', pack: 1 }),
) {}
// 479 bytes with its header.
blf.chunk('xscc', 1.0)(s_blf_chunk_session_create, k_chunk_context);

// Session Create Response Chunk Schema
export class s_blf_chunk_session_create_response extends CStructBLFChunk(
    c.struct({
      sessionDescription: TransportSessionDescriptionSchema,
      nonce: c.u64(),
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xscr', 1.0)(s_blf_chunk_session_create_response, k_chunk_context);

export function randomNonce(): bigint {
    return randomBytes(8).readBigUInt64LE(0);
}

// Session Modify Chunk Schema
export class s_blf_chunk_session_modify extends CStructBLFChunk(
    c.struct({
      identifier: TransportSessionIdSchema,
      flags: SessionFlagsSchema,
      maxPublicSlots: c.u32(),
      maxPrivateSlots: c.u32(),
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xscm', 1.0)(s_blf_chunk_session_modify, k_chunk_context);

// Session Delete Chunk Schema
export class s_blf_chunk_session_delete extends CStructBLFChunk(
    c.struct({
      sessionId: TransportSessionIdSchema,
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xsdl', 1.0)(s_blf_chunk_session_delete, k_chunk_context);

// Session End Chunk Schema (sent by the game when a session ends; triggers stat finalization)
export class s_blf_chunk_session_end extends CStructBLFChunk(
    c.struct({
      sessionId: TransportSessionIdSchema,
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xsse', 1.0)(s_blf_chunk_session_end, k_chunk_context);

// Session Get By ID Chunk Schema
export class s_blf_chunk_session_get_by_id extends CStructBLFChunk(
    c.struct({
      sessionId: TransportSessionIdSchema,
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xsgi', 1.0)(s_blf_chunk_session_get_by_id, k_chunk_context);

// Session Get By ID Response Chunk Schema
export class s_blf_chunk_session_get_by_id_response extends CStructBLFChunk(
    c.struct({
      secureAddress: TransportSecureAddressSchema,
      sessionKey: TransportSessionKeySchema,
      usableAddress: c.u32(), // Network byte order
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xsir', 1.0)(s_blf_chunk_session_get_by_id_response, k_chunk_context);

// Session Migrate Host Chunk Schema
export class s_blf_chunk_session_migrate_host extends CStructBLFChunk(
    c.struct({
      sessionId: TransportSessionIdSchema,
      secureAddress: TransportSecureAddressSchema,
      hostIceEnabled: c.u8(),
      hostPeerId: c.string(HOST_PEER_ID_LENGTH),
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xsmh', 1.0)(s_blf_chunk_session_migrate_host, k_chunk_context);

// Session Migrate Host Response Chunk Schema
export class s_blf_chunk_session_migrate_host_response extends CStructBLFChunk(
    c.struct({
      sessionDescription: TransportSessionDescriptionSchema,
      nonce: c.u64(),
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xsmr', 1.0)(s_blf_chunk_session_migrate_host_response, k_chunk_context);

// Session Search Result Schema
export const OnlineSessionSearchResultSchema = c.struct({
  sessionName: c.wstring(32), // wchar_t[32] = 64 bytes
  description: TransportSessionDescriptionSchema,
  openPublicSlots: c.u32(),
  openPrivateSlots: c.u32(),
  filledPublicSlots: c.u32(),
  filledPrivateSlots: c.u32(),
  propertyCount: c.u32(),
  properties: OnlinePropertySchema.array(3), // Max 3 properties
  contextCount: c.u32(),
  contexts: OnlineContextSchema.array(2), // Max 2 contexts
}, { endian: 'little', pack: 8 });

// Session Search Response Chunk Schema
export class s_blf_chunk_session_search_response extends CStructBLFChunk(
    c.struct({
      resultCount: c.u32(),
      results: OnlineSessionSearchResultSchema.array(50), // Max 50 results
    }, { endian: 'little', pack: 1 }),
) {}
blf.chunk('xssr', 1.0)(s_blf_chunk_session_search_response, k_chunk_context);

// File schemas for reading session requests (full BLF files with _eof)
export const SBlfFileSessionCreateSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xscc: s_blf_chunk_session_create,
    _eof: s_blf_chunk_end_of_file,
});

export const SBlfFileSessionModifySchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xscm: s_blf_chunk_session_modify,
    _eof: s_blf_chunk_end_of_file,
});

export const SBlfFileSessionDeleteSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xsdl: s_blf_chunk_session_delete,
    _eof: s_blf_chunk_end_of_file,
});

export const SBlfFileSessionEndSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xsse: s_blf_chunk_session_end,
    _eof: s_blf_chunk_end_of_file,
});

export const SBlfFileSessionMigrateHostSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xsmh: s_blf_chunk_session_migrate_host,
    _eof: s_blf_chunk_end_of_file,
});

export const SBlfFileSessionGetByIdSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xsgi: s_blf_chunk_session_get_by_id,
    _eof: s_blf_chunk_end_of_file,
});

// File schemas for writing session responses
export const SBlfFileSessionCreateResponseSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xscr: s_blf_chunk_session_create_response,
    _eof: s_blf_chunk_end_of_file,
});

export const SBlfFileSessionSearchResponseSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xssr: s_blf_chunk_session_search_response,
    _eof: s_blf_chunk_end_of_file,
});

export const SBlfFileSessionMigrateHostResponseSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xsmr: s_blf_chunk_session_migrate_host_response,
    _eof: s_blf_chunk_end_of_file,
});

export const SBlfFileSessionGetByIdResponseSchema = blf_file({
    _blf: s_blf_chunk_start_of_file,
    athr: s_blf_chunk_author,
    xsir: s_blf_chunk_session_get_by_id_response,
    _eof: s_blf_chunk_end_of_file,
});

// Type exports

// Helper type exports for nested structures
export type s_transport_session_description = c.infer<typeof TransportSessionDescriptionSchema>;
export type s_online_property = c.infer<typeof OnlinePropertySchema>;
export type s_online_context = c.infer<typeof OnlineContextSchema>;
export type s_online_session_search_result = c.infer<typeof OnlineSessionSearchResultSchema>;

