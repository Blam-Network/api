import { type BLFChunk, find_chunk, read_blffile } from '@blamnetwork/blf';
import * as H3 from '@blamnetwork/blf/halo3/v12070_08_09_05_2031_halo3_ship';
import * as ODST from '@blamnetwork/blf/halo3odst/v13895_09_04_27_2201_atlas_release';
import * as HR from '@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual';

/** Reads a big-endian file holding exactly these chunks, in order, into them. Null if it isn't one. */
export function read_blf_file<T extends Record<string, BLFChunk>>(buffer: Uint8Array, chunks: T): T | null {
    try {
        read_blffile(buffer, 'big', Object.values(chunks));
    } catch {
        return null;
    }
    return chunks;
}

/** Finds and reads `chunk` anywhere in a big-endian file. Null if it isn't there or doesn't read. */
export function find_blf_chunk<T extends BLFChunk>(buffer: Uint8Array, chunk: T): T | null {
    try {
        return find_chunk(buffer, chunk, 'big') ? chunk : null;
    } catch {
        return null;
    }
}

/** Halo 3 screenshot uploaded outside the file share: `_blf chdr scnc scnd _eof`. */
export function read_halo3_blind_screenshot(buffer: Uint8Array) {
    return read_blf_file(buffer, {
        _blf: new H3.s_blf_chunk_start_of_file(),
        chdr: new H3.s_blf_chunk_content_header(),
        scnc: new H3.s_blf_chunk_screenshot_camera(),
        scnd: new H3.s_blf_chunk_screenshot_data(),
        _eof: new H3.s_blf_chunk_end_of_file(),
    });
}

/** Halo 3 11637 (pre-release) screenshot, with no camera chunk: `_blf chdr scnd _eof`. */
export function read_halo3_11637_blind_screenshot(buffer: Uint8Array) {
    return read_blf_file(buffer, {
        _blf: new H3.s_blf_chunk_start_of_file(),
        chdr: new H3.s_blf_chunk_content_header(),
        scnd: new H3.s_blf_chunk_screenshot_data(),
        _eof: new H3.s_blf_chunk_end_of_file(),
    });
}

/** Halo 3 file share screenshot: `_blf chdr scnc _cmp(scnd) _eof`. */
export function read_halo3_fileshare_screenshot(buffer: Uint8Array) {
    return read_blf_file(buffer, {
        _blf: new H3.s_blf_chunk_start_of_file(),
        chdr: new H3.s_blf_chunk_content_header(),
        scnc: new H3.s_blf_chunk_screenshot_camera(),
        scnd: new H3.s_blf_chunk_compressed_data(H3.s_blf_chunk_screenshot_data),
        _eof: new H3.s_blf_chunk_end_of_file(),
    });
}

/** ODST screenshot: `_blf chdr scnc scnd _eof`, with ODST's `chdr` 9.3. */
export function read_odst_blind_screenshot(buffer: Uint8Array) {
    return read_blf_file(buffer, {
        _blf: new H3.s_blf_chunk_start_of_file(),
        chdr: new ODST.s_blf_chunk_content_header(),
        scnc: new H3.s_blf_chunk_screenshot_camera(),
        scnd: new H3.s_blf_chunk_screenshot_data(),
        _eof: new H3.s_blf_chunk_end_of_file(),
    });
}

/** Reach TU0/TU1 screenshot: `_blf chdr scnc scnd ssig _eof`. */
export function read_reach_blind_screenshot(buffer: Uint8Array) {
    return read_blf_file(buffer, {
        _blf: new H3.s_blf_chunk_start_of_file(),
        chdr: new HR.s_blf_chunk_content_header(),
        scnc: new HR.s_blf_chunk_screenshot_camera(),
        scnd: new HR.s_blf_chunk_screenshot_data(),
        ssig: new HR.s_blf_chunk_server_signature(),
        _eof: new H3.s_blf_chunk_end_of_file(),
    });
}

/** Reach 09730 (public beta) screenshot: `_blf chdr _cmp(scnd 1.2) _eof`. */
export function read_reach_09730_blind_screenshot(buffer: Uint8Array) {
    return read_blf_file(buffer, {
        _blf: new H3.s_blf_chunk_start_of_file(),
        chdr: new HR.s_blf_chunk_content_header(),
        _cmp: new H3.s_blf_chunk_compressed_data(HR.s_blf_chunk_screenshot_data),
        _eof: new H3.s_blf_chunk_end_of_file(),
    });
}

/** Reach 09449 (private beta) screenshot: `_blf chdr _cmp(scnd 1.1) _eof`. */
export function read_reach_09449_blind_screenshot(buffer: Uint8Array) {
    return read_blf_file(buffer, {
        _blf: new H3.s_blf_chunk_start_of_file(),
        chdr: new HR.s_blf_chunk_content_header(),
        _cmp: new H3.s_blf_chunk_compressed_data(H3.s_blf_chunk_screenshot_data),
        _eof: new H3.s_blf_chunk_end_of_file(),
    });
}
