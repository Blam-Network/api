import { c } from "../cstruct";
import { FlattenIntersection, UnionToIntersection } from "../cstruct/utils";

export namespace blf {

    export class FileSchema<const CHUNKS extends readonly blf.ChunkSchema<any, any, any>[]> {
        public readonly chunks: CHUNKS;

        constructor(chunks: CHUNKS) {
            this.chunks = chunks;
        }

        public read(buffer: Buffer): FlattenIntersection<UnionToIntersection<{
            [K in keyof CHUNKS]: CHUNKS[K] extends blf.ChunkSchema<infer S, any, any, any>
                ? { [Key in S]: blf.infer<CHUNKS[K], true> }
                : never;
        }[number]>> {
            let result: any = {};
            let currentOffset = 0;
            for (const chunk of this.chunks) {
                const chunkData = chunk.read(buffer.subarray(currentOffset)) as any;
                const { header, ...rest } = chunkData;
                result[chunk.signature] = rest;
                // Use chunkSize from header, which includes the header itself
                currentOffset += (header.chunkSize as number);
            }
            return result as FlattenIntersection<UnionToIntersection<{
                [K in keyof CHUNKS]: CHUNKS[K] extends blf.ChunkSchema<infer S, any, any, any>
                    ? { [Key in S]: blf.infer<CHUNKS[K], true> }
                    : never;
            }[number]>>;
        }

        public write(data: FlattenIntersection<UnionToIntersection<{
            [K in keyof CHUNKS]: CHUNKS[K] extends blf.ChunkSchema<infer S, any, any, any>
                ? { [Key in S]: blf.infer<CHUNKS[K], false> }
                : never;
        }[number]>>): Buffer {
            let buffer = Buffer.alloc(0);
            for (const chunk of this.chunks) {
                if (chunk.signature === '_eof') {
                    // Update totalFileSize in the data before writing
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

    export class ChunkSchema<S extends string, MAJ extends number, MIN extends number, SCHEMA_STRUCT extends c.Struct<any> = c.Struct<any>> {
        public readonly signature: S;
        public readonly majorVersion: MAJ;
        public readonly minorVersion: MIN;
        private readonly expectedSize?: number;
        public readonly schema: SCHEMA_STRUCT;

        constructor(signature: S, majorVersion: MAJ, minorVersion: MIN, size: number | undefined = undefined, schema: SCHEMA_STRUCT) {
            this.signature = signature;
            this.majorVersion = majorVersion;
            this.minorVersion = minorVersion;
            this.expectedSize = size;
            this.schema = schema;
        }

        public read(buffer: Buffer): c.infer<SCHEMA_STRUCT> {
            if (buffer.length < 12) {
                throw new Error(`Buffer too small for chunk header: ${buffer.length} bytes (need at least 12)`);
            }
            return this.schema.read(buffer);
        }

        public write(data: Omit<c.infer<SCHEMA_STRUCT>, 'header'>): Buffer {
            // Write the data first to get the actual size
            const tempChunkSize = 0; // Temporary value, will be updated
            const dataWithHeader = {
                ...data,
                header: {
                    chunkType: this.signature,
                    chunkSize: tempChunkSize,
                    versionMajor: this.majorVersion,
                    versionMinor: this.minorVersion,
                } as any,
            } as c.infer<SCHEMA_STRUCT>;
            const buffer = this.schema.write(dataWithHeader);
            // Update chunkSize with expected size if provided, otherwise use actual buffer size
            const actualChunkSize = this.expectedSize || buffer.length;
            
            if (this.expectedSize !== undefined && buffer.length !== this.expectedSize) {
                throw new Error(`Chunk size mismatch: expected ${this.expectedSize} bytes, but struct calculation produced ${buffer.length} bytes`);
            }
            
            // Ensure we have enough space to write the chunkSize field at offset 4
            if (buffer.length < 8) {
                throw new Error(`Buffer too small to write chunk header: ${buffer.length} bytes`);
            }
            
            const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            view.setUint32(4, actualChunkSize, false); // big endian
            return buffer;
        }
    }

    export function createChunkSchema<const SCHEMA extends c.StructSchema, S extends string, MAJ extends number, MIN extends number>(
        schema: SCHEMA & { name: S, majorVersion: MAJ, minorVersion: MIN, size?: number }
    ) {
        // c.createCStruct uses 'const' type parameter, so it preserves literal types
        const headerStruct = c.createCStruct({
            endian: 'big',
            pack: 1,
            fields: [
                { name: 'chunkType', type: new c.MagicString(schema.name) },
                { name: 'chunkSize', type: schema.size ? new c.MagicNumber(schema.size, 'u32') : 'u32' },
                { name: 'versionMajor', type: new c.MagicNumber(schema.majorVersion, 'u16') },
                { name: 'versionMinor', type: new c.MagicNumber(schema.minorVersion, 'u16') },
            ],
        });
        
        // Construct the full schema type explicitly to preserve literal types from SCHEMA['fields']
        // Since SCHEMA is const, SCHEMA['fields'] preserves literal types
        type FullSchemaType = {
            readonly endian: SCHEMA['endian'] extends infer E ? E extends c.Endian ? E : 'little' : 'little';
            readonly pack: SCHEMA['pack'] extends infer P ? P extends number ? P : 1 : 1;
            readonly fields: readonly [
                { readonly name: 'header'; readonly type: typeof headerStruct },
                ...SCHEMA['fields']
            ];
        };
        const fullSchema = c.createCStruct({
            endian: (schema.endian || 'little') as FullSchemaType['endian'],
            pack: (schema.pack || 1) as FullSchemaType['pack'],
            fields: [
                {
                    name: 'header',
                    type: headerStruct,
                },
                ...schema.fields,
            ] as unknown as FullSchemaType['fields'],
        });
        type ExpectedStructType = c.Struct<FullSchemaType>;
        return new blf.ChunkSchema(schema.name, schema.majorVersion, schema.minorVersion, schema.size, fullSchema as ExpectedStructType) as blf.ChunkSchema<S, MAJ, MIN, ExpectedStructType>;
    }

    export function createFileSchema<const CHUNKS extends readonly blf.ChunkSchema<any, any, any>[]>(chunks: CHUNKS) {
        return new blf.FileSchema(chunks);
    }
    
    export type infer<T, HEADER extends boolean = true> = 
    T extends blf.FileSchema<infer CHUNKS>
        ? FlattenIntersection<UnionToIntersection<{
                [K in keyof CHUNKS]: CHUNKS[K] extends blf.ChunkSchema<infer S, any, any, any>
                    ? { [Key in S]: blf.infer<CHUNKS[K], HEADER> }
                    : never;
            }[number]>>
    : T extends blf.ChunkSchema<infer S, infer MAJ, infer MIN, infer SCHEMA_STRUCT>
        ? HEADER extends true
            ? c.infer<SCHEMA_STRUCT>
            : Omit<c.infer<SCHEMA_STRUCT>, 'header'>
        : never;

    export const SBlfChunkEndOfFileSchema = blf.createChunkSchema({
        name: '_eof',
        majorVersion: 1,
        minorVersion: 1,
        endian: 'big',
        fields: [
            { name: 'totalFileSize', type: 'u32' },
            { name: 'authenticationType', type: 'u8' },
        ],
    });

    export type s_blf_chunk_end_of_file = blf.infer<typeof blf.SBlfChunkEndOfFileSchema, false>;
}

// Re-export for convenience
export const SBlfChunkEndOfFileSchema = blf.SBlfChunkEndOfFileSchema;
export type s_blf_chunk_end_of_file = blf.s_blf_chunk_end_of_file;
