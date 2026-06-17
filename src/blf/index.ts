import { c } from "../cstruct";
import { FlattenIntersection, UnionToIntersection } from "../cstruct/utils";

export namespace blf {

    export class FileSchema<const CHUNKS extends readonly blf.ChunkSchema<any, any, any, any, any>[]> {
        public readonly chunks: CHUNKS;

        constructor(chunks: CHUNKS) {
            this.chunks = chunks;
        }

        public read(buffer: Buffer): FlattenIntersection<UnionToIntersection<{
            [K in keyof CHUNKS]: CHUNKS[K] extends blf.ChunkSchema<infer S, any, any, any, any>
                ? { [Key in S]: blf.infer<CHUNKS[K], false> }
                : never;
        }[number]>> {
            let result: any = {};
            let currentOffset = 0;
            for (const chunk of this.chunks) {
                const chunkData = chunk.read(buffer.subarray(currentOffset)) as any;
                const { header, ...rest } = chunkData;
                result[chunk.signature] = rest;
                currentOffset += (header.chunkSize as number);
            }
            return result as FlattenIntersection<UnionToIntersection<{
                [K in keyof CHUNKS]: CHUNKS[K] extends blf.ChunkSchema<infer S, any, any, any, any>
                    ? { [Key in S]: blf.infer<CHUNKS[K], false> }
                    : never;
            }[number]>>;
        }

        public write(data: FlattenIntersection<UnionToIntersection<{
            [K in keyof CHUNKS]: CHUNKS[K] extends blf.ChunkSchema<infer S, any, any, any, any>
                ? { [Key in S]: blf.infer<CHUNKS[K], false> }
                : never;
        }[number]>>): Buffer {
            let buffer = Buffer.alloc(0);
            for (const chunk of this.chunks) {
                if (chunk.signature === '_eof') {
                    const eofData = data['_eof'] as any;
                    if (eofData) {
                        eofData.totalFileSize = buffer.length;
                    }
                }
                buffer = Buffer.concat([buffer, chunk.write(data[chunk.signature])]);
            }
            return buffer;
        }
    }

    export class ChunkSchema<
        S extends string,
        MAJ extends number,
        MIN extends number,
        HEADER_STRUCT extends c.Struct<any> = c.Struct<any>,
        PAYLOAD_FIELDS extends c.StructFields = c.StructFields,
    > {
        public readonly signature: S;
        public readonly majorVersion: MAJ;
        public readonly minorVersion: MIN;
        private readonly expectedSize?: number;
        public readonly headerSchema: HEADER_STRUCT;
        public readonly payloadSchema: c.Struct<PAYLOAD_FIELDS>;
        private readonly endian: c.Endian;

        constructor(
            signature: S,
            majorVersion: MAJ,
            minorVersion: MIN,
            size: number | undefined,
            headerSchema: HEADER_STRUCT,
            payloadSchema: c.Struct<PAYLOAD_FIELDS>,
            endian: c.Endian,
        ) {
            this.signature = signature;
            this.majorVersion = majorVersion;
            this.minorVersion = minorVersion;
            this.expectedSize = size;
            this.headerSchema = headerSchema;
            this.payloadSchema = payloadSchema;
            this.endian = endian;
        }


        public read(buffer: Buffer): {
            header: c.infer<HEADER_STRUCT>;
        } & c.StructSchemaToTS<PAYLOAD_FIELDS> {
            if (buffer.length < this.headerSchema.getSize()) {
                throw new Error(`Buffer too small for chunk header: ${buffer.length} bytes (need at least ${this.headerSchema.getSize()})`);
            }
            const header = this.headerSchema.read(buffer, 0, 'big') as c.infer<HEADER_STRUCT>;
            const payload = this.payloadSchema.read(buffer, this.headerSchema.getSize(), this.endian) as Record<string, unknown>;
            return { header, ...payload } as {
                header: c.infer<HEADER_STRUCT>;
            } & c.StructSchemaToTS<PAYLOAD_FIELDS>;
        }

        public write(data: c.StructSchemaToTS<PAYLOAD_FIELDS>): Buffer {
            const payloadBuffer = this.payloadSchema.write(data as Record<string, any>, this.endian);
            const headerBuffer = this.headerSchema.write({
                chunkType: this.signature,
                chunkSize: 0,
                versionMajor: this.majorVersion,
                versionMinor: this.minorVersion,
            } as unknown as c.infer<HEADER_STRUCT>, 'big');

            const buffer = Buffer.concat([headerBuffer, payloadBuffer]);
            const actualChunkSize = this.expectedSize || buffer.length;

            if (this.expectedSize !== undefined && buffer.length !== this.expectedSize) {
                throw new Error(`Chunk size mismatch: expected ${this.expectedSize} bytes, but struct calculation produced ${buffer.length} bytes`);
            }

            if (buffer.length < 8) {
                throw new Error(`Buffer too small to write chunk header: ${buffer.length} bytes`);
            }

            const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            view.setUint32(4, actualChunkSize, false);
            return buffer;
        }
    }

    export function createChunkSchema<
        const F extends c.StructFields,
        S extends string,
        MAJ extends number,
        MIN extends number,
    >(
        schema: { fields: F; name: S; majorVersion: MAJ; minorVersion: MIN; size?: number; endian?: c.Endian },
    ) {
        const endian = schema.endian ?? 'big';
        const headerSchema = c.struct({
            chunkType: c.MagicString(schema.name),
            chunkSize: schema.size ? c.MagicNumber(schema.size, c.u32()) : c.u32(),
            versionMajor: c.MagicNumber(schema.majorVersion, c.u16()),
            versionMinor: c.MagicNumber(schema.minorVersion, c.u16()),
        });
        const payloadSchema = c.struct(schema.fields);
        return new blf.ChunkSchema(
            schema.name,
            schema.majorVersion,
            schema.minorVersion,
            schema.size,
            headerSchema,
            payloadSchema,
            endian,
        ) as blf.ChunkSchema<S, MAJ, MIN, typeof headerSchema, F>;
    }

    export function createFileSchema<const CHUNKS extends readonly blf.ChunkSchema<any, any, any, any, any>[]>(chunks: CHUNKS) {
        return new blf.FileSchema(chunks);
    }

    export type infer<T, HEADER extends boolean = true> =
    T extends blf.FileSchema<infer CHUNKS>
        ? FlattenIntersection<UnionToIntersection<{
                [K in keyof CHUNKS]: CHUNKS[K] extends blf.ChunkSchema<infer S, any, any, any, any>
                    ? { [Key in S]: blf.infer<CHUNKS[K], HEADER> }
                    : never;
            }[number]>>
    : T extends blf.ChunkSchema<infer _S, infer _MAJ, infer _MIN, infer HEADER_STRUCT, infer PAYLOAD_FIELDS>
        ? HEADER extends true
            ? { header: c.infer<HEADER_STRUCT> } & c.StructSchemaToTS<PAYLOAD_FIELDS>
            : c.StructSchemaToTS<PAYLOAD_FIELDS>
        : never;

    export const SBlfChunkEndOfFileSchema = blf.createChunkSchema({
        name: '_eof',
        majorVersion: 1,
        minorVersion: 1,
        endian: 'big',
        fields: {
            totalFileSize: c.u32(),
            authenticationType: c.u8(),
        },
    });

    export type s_blf_chunk_end_of_file = blf.infer<typeof blf.SBlfChunkEndOfFileSchema, false>;
}

export const SBlfChunkEndOfFileSchema = blf.SBlfChunkEndOfFileSchema;
export type s_blf_chunk_end_of_file = blf.s_blf_chunk_end_of_file;
