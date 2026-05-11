import { CString } from "../cstruct/advanced";
import { blf } from ".";
import { c } from "../cstruct";

// Layout matches blf.createChunkSchema header: chunkType, chunkSize, versionMajor, versionMinor (all big-endian)
const s_blf_chunk_header = c.createCStruct({pack: 1, endian: 'big', fields: [
    { name: 'signature', type: new CString(4) },
    { name: 'chunkSize', type: 'u32' },
    { name: 'majorVersion', type: 'u16' },
    { name: 'minorVersion', type: 'u16' },
]});

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
        const header = s_blf_chunk_header.read(fileBuffer.slice(offset, offset + s_blf_chunk_header.getSize()));

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