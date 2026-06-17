import { blf } from ".";
import { c } from "../cstruct";

const s_blf_chunk_header = c.struct({
    signature: c.String(4),
    chunkSize: c.u32(),
    majorVersion: c.u16(),
    minorVersion: c.u16(),
});

if (s_blf_chunk_header.getSize() !== 12) {
    throw new Error(`Invalid chunk header size: ${s_blf_chunk_header.getSize()}`);
}

export const find_chunk_in_file = <
    S extends string,
    MAJ extends number,
    MIN extends number,
    SS extends c.Struct<any>,
>(file: Buffer | Uint8Array, chunk: blf.ChunkSchema<S, MAJ, MIN, SS>): blf.infer<blf.ChunkSchema<S, MAJ, MIN, SS>, true> | undefined => {
    const fileBuffer = file instanceof Buffer ? file : Buffer.from(file);

    let offset = 0;
    while (true) {
        const header = s_blf_chunk_header.read(fileBuffer.slice(offset, offset + s_blf_chunk_header.getSize()), 0, 'big');

        if (header.signature === chunk.signature && header.majorVersion === chunk.majorVersion && header.minorVersion === chunk.minorVersion) {
            return chunk.read(fileBuffer.subarray(offset));
        }

        if (header.chunkSize < s_blf_chunk_header.getSize()) {
            throw new Error(`Invalid chunk header: ${header.signature} ${header.majorVersion} ${header.minorVersion} ${header.chunkSize}`);
        }

        offset += header.chunkSize;

        if (offset >= fileBuffer.length) {
            return undefined;
        }
    }
}
