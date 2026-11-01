import { type BLFChunk, write_blffile } from '@blamnetwork/blf';
import {
    s_blf_chunk_end_of_file,
    s_blf_chunk_online_file_listing,
    s_blf_chunk_online_file_summary,
    s_blf_chunk_start_of_file,
    type s_online_file_metadata,
    type s_online_file_summary_listing_entry,
    type s_online_file_tag,
} from '@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual';

/** The `fitm` fields that aren't derived from the entries. */
interface s_fileshare_owner {
    xuid: bigint;
    gamertag: string;
    unknown16: number;
    unknown17: number;
    unknown18: number;
    unknown19: number;
    quota_byte_count: number;
    quota_slot_count: number;
}

/** A Reach fileshare response: `_blf`, `chunk`, `_eof`. */
function fileshare_file(chunk: BLFChunk): Uint8Array {
    return write_blffile('big', [
        s_blf_chunk_start_of_file.create('test'),
        chunk,
        new s_blf_chunk_end_of_file(),
    ]);
}

function listing_chunk(owner: s_fileshare_owner): s_blf_chunk_online_file_listing {
    const chunk = new s_blf_chunk_online_file_listing();
    chunk.xuid = owner.xuid;
    chunk.gamertag = owner.gamertag;
    chunk.unknown16 = owner.unknown16;
    chunk.unknown17 = owner.unknown17;
    chunk.unknown18 = owner.unknown18;
    chunk.unknown19 = owner.unknown19;
    chunk.quota_byte_count = owner.quota_byte_count;
    chunk.quota_slot_count = owner.quota_slot_count;
    return chunk;
}

/** A file share's listing: its files and a message (`fitm` 4.0). */
export function fileshare_listing_file(
    listing: s_fileshare_owner & { entries: s_online_file_metadata[]; message: string },
): Uint8Array {
    const chunk = listing_chunk(listing);
    chunk.entries = listing.entries;
    chunk.message = listing.message;
    return fileshare_file(chunk);
}

/** One file's details: its entry, screenshot preview and tags (`fitm` 4.0). */
export function fileshare_details_file(
    details: s_fileshare_owner & {
        entries: s_online_file_metadata;
        screenshot: number[];
        tags: s_online_file_tag[];
    },
): Uint8Array {
    const chunk = listing_chunk(details);
    chunk.entries = [details.entries];
    chunk.message = null;
    chunk.screenshot = details.screenshot;
    chunk.tags = details.tags;
    return fileshare_file(chunk);
}

/** File share summaries (`finf` 1.0). */
export function fileshare_summary_file(summary: {
    entries: s_online_file_summary_listing_entry[];
}): Uint8Array {
    const chunk = new s_blf_chunk_online_file_summary();
    chunk.entries = summary.entries;
    return fileshare_file(chunk);
}
