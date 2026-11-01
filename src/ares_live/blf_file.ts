import { type BLFChunk, read_blffile, write_blffile } from '@blamnetwork/blf';

type t_chunk_class = new () => BLFChunk;

/** A chunk's data fields, without its read/write methods. */
export type chunk_fields<T extends BLFChunk> = Omit<T, keyof BLFChunk>;

/**
 * A BLF file made of exactly these chunks, in order. Chunk headers are big-endian; Ares chunks
 * pin their own little-endian bodies.
 */
export function blf_file<const T extends Record<string, t_chunk_class>>(chunks: T) {
    const keys = Object.keys(chunks) as (keyof T & string)[];
    return {
        read(buffer: Uint8Array): { [K in keyof T]: InstanceType<T[K]> } {
            const file = Object.fromEntries(keys.map((key) => [key, new chunks[key]()])) as {
                [K in keyof T]: InstanceType<T[K]>;
            };
            read_blffile(buffer, 'big', keys.map((key) => file[key]));
            return file;
        },
        write(data: { [K in keyof T]: chunk_fields<InstanceType<T[K]>> }): Buffer {
            // `_eof`'s file_size is filled in by write_blffile.
            const bytes = write_blffile('big', keys.map((key) => Object.assign(new chunks[key](), data[key])));
            return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        },
    };
}
