import { CString } from "src/cstruct/advanced";
import { blf } from ".";
import { c } from "src/cstruct";

const s_blf_chunk_header = c.createCStruct({pack: 1, endian: 'big', fields: [
    { name: 'signature', type: new CString(4) },
    { name: 'chunkSize', type: 'u32' },
    { name: 'minorVersion', type: 'u16' },
    { name: 'majorVersion', type: 'u16' },
]});

export const find_chunk_in_file = <T extends blf.ChunkSchema<any, any, any, any>>(file: Buffer, chunk: T) => {
    // Stream Reader
    let offset = 0;
    while (true) {
        const header = s_blf_chunk_header.read(file.slice(offset, offset + s_blf_chunk_header.getSize()));
        if (header.signature === chunk.signature && header.majorVersion === chunk.majorVersion && header.minorVersion === chunk.minorVersion) {
            return chunk.read(file);
        }

        if (header.chunkSize < s_blf_chunk_header.getSize()) {
            throw new Error('Invalid chunk header');
        }

        offset += header.chunkSize + s_blf_chunk_header.getSize();

        if (offset >= file.length) {
            return undefined;
        }
    }
}