import { StructSchema, PrimitiveType, StructSchemaToTS, ExtractSchema, c } from './binary-struct';

describe('CStruct', () => {
    describe('Basic Types', () => {
        it('should pack and unpack u8', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'u8' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: 42 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBe(42);
            expect(buffer.length).toBe(1);
        });

        it('should pack and unpack u16', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'u16' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: 0x1234 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBe(0x1234);
            expect(buffer.length).toBe(2);
        });

        it('should pack and unpack u32', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'u32' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: 0x12345678 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBe(0x12345678);
            expect(buffer.length).toBe(4);
        });

        it('should pack and unpack u64', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'u64' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: BigInt('0x1234567890ABCDEF') };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBe(BigInt('0x1234567890ABCDEF'));
            expect(buffer.length).toBe(8);
        });

        it('should pack and unpack i8', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'i8' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: -42 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBe(-42);
        });

        it('should pack and unpack i16', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'i16' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: -1234 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBe(-1234);
        });

        it('should pack and unpack i32', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'i32' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: -12345678 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBe(-12345678);
        });

        it('should pack and unpack i64', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'i64' }],
            };
            const struct = c.createCStruct(schema);
            const negativeValue = -BigInt('0x1234567890ABCDEF');
            const data = { value: negativeValue };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBe(negativeValue);
        });

        it('should pack and unpack f32', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'f32' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: 3.14159 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBeCloseTo(3.14159, 5);
        });

        it('should pack and unpack f64', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'f64' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: 3.141592653589793 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBe(3.141592653589793);
        });
    });

    describe('Arrays', () => {
        it('should pack and unpack u8 array', () => {
            const schema: StructSchema = {
                fields: [{ name: 'values', type: 'u8', count: 5 }],
            };
            const struct = c.createCStruct(schema);
            const data = { values: [1, 2, 3, 4, 5] };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.values).toEqual([1, 2, 3, 4, 5]);
            expect(buffer.length).toBe(5);
        });

        it('should pack and unpack u32 array', () => {
            const schema: StructSchema = {
                fields: [{ name: 'values', type: 'u32', count: 3 }],
            };
            const struct = c.createCStruct(schema);
            const data = { values: [0x11111111, 0x22222222, 0x33333333] };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.values).toEqual([0x11111111, 0x22222222, 0x33333333]);
            expect(buffer.length).toBe(12);
        });

        it('should pack and unpack u64 array', () => {
            const schema: StructSchema = {
                fields: [{ name: 'values', type: 'u64', count: 2 }],
            };
            const struct = c.createCStruct(schema);
            const data = { values: [BigInt('0x1234567890ABCDEF'), BigInt('0xFEDCBA0987654321')] };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.values).toEqual([BigInt('0x1234567890ABCDEF'), BigInt('0xFEDCBA0987654321')]);
            expect(buffer.length).toBe(16);
        });
    });

    describe('Nested Structs', () => {
        it('should pack and unpack nested struct', () => {
            const nestedStruct = c.createCStruct({
                fields: [
                    { name: 'x', type: 'u32' },
                    { name: 'y', type: 'u32' },
                ],
            });

            const struct = c.createCStruct({
                fields: [
                    { name: 'point', type: nestedStruct },
                    { name: 'z', type: 'u32' },
                ],
            });
            const data = {
                point: { x: 100, y: 200 },
                z: 300,
            };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.point.x).toBe(100);
            expect(unpacked.point.y).toBe(200);
            expect(unpacked.z).toBe(300);
            expect(buffer.length).toBe(12);
        });

        it('should pack and unpack array of nested structs', () => {
            const nestedSchema: StructSchema = {
                fields: [
                    { name: 'x', type: 'u16' },
                    { name: 'y', type: 'u16' },
                ],
            };

            const nestedStruct = c.createCStruct(nestedSchema);

            const schema: StructSchema = {
                fields: [
                    { name: 'points', type: nestedStruct, count: 3 },
                ],
            };

            const struct = c.createCStruct(schema);
            const data = {
                points: [
                    { x: 10, y: 20 },
                    { x: 30, y: 40 },
                    { x: 50, y: 60 },
                ],
            };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.points).toHaveLength(3);
            expect(unpacked.points[0]).toEqual({ x: 10, y: 20 });
            expect(unpacked.points[1]).toEqual({ x: 30, y: 40 });
            expect(unpacked.points[2]).toEqual({ x: 50, y: 60 });
            expect(buffer.length).toBe(12);
        });
    });


    describe('Endianness', () => {
        it('should use little endian by default', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'u16' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: 0x1234 };
            const buffer = struct.pack(data);

            // In little endian, 0x1234 is stored as [0x34, 0x12]
            expect(buffer[0]).toBe(0x34);
            expect(buffer[1]).toBe(0x12);
        });

        it('should use big endian when specified', () => {
            const schema: StructSchema = {
                endian: 'big',
                fields: [{ name: 'value', type: 'u16' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: 0x1234 };
            const buffer = struct.pack(data);

            // In big endian, 0x1234 is stored as [0x12, 0x34]
            expect(buffer[0]).toBe(0x12);
            expect(buffer[1]).toBe(0x34);
        });

        it('should round-trip with big endian', () => {
            const schema: StructSchema = {
                endian: 'big',
                fields: [{ name: 'value', type: 'u32' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: 0x12345678 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked.value).toBe(0x12345678);
        });
    });

    describe('Complex Structures', () => {
        it('should pack and unpack complex nested structure', () => {
            const headerSchema: StructSchema = {
                fields: [
                    { name: 'chunkType', type: 'i32' },
                    { name: 'chunkSize', type: 'i32' },
                ],
            };

            const headerStruct = c.createCStruct(headerSchema);

            const schema: StructSchema = {
                fields: [
                    { name: 'header', type: headerStruct },
                    { name: 'data', type: 'u8', count: 4 },
                    { name: 'flags', type: 'u16' },
                ],
            };

            const struct = c.createCStruct(schema);
            const data = {
                header: { chunkType: 1, chunkSize: 10 },
                data: [0xAA, 0xBB, 0xCC, 0xDD],
                flags: 0x1234,
            };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect((unpacked.header as any).chunkType).toBe(1);
            expect((unpacked.header as any).chunkSize).toBe(10);
            expect(unpacked.data).toEqual([0xAA, 0xBB, 0xCC, 0xDD]);
            expect(unpacked.flags).toBe(0x1234);
        });
    });

    describe('Alignment', () => {
        it('should apply alignment when specified', () => {
            const schema: StructSchema = {
                align: 8,
                fields: [
                    { name: 'value', type: 'u8' },
                ],
            };

            const struct = c.createCStruct(schema);
            expect(struct.getSize()).toBe(8); // Aligned to 8 bytes
        });

        it('should align complex structures', () => {
            const schema: StructSchema = {
                align: 4,
                fields: [
                    { name: 'a', type: 'u8' },
                    { name: 'b', type: 'u16' },
                ],
            };

            const struct = c.createCStruct(schema);
            // a (1) + b (2) = 3, aligned to 4 = 4
            expect(struct.getSize()).toBe(4);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty struct', () => {
            const schema: StructSchema = {
                fields: [],
            };
            const struct = c.createCStruct(schema);
            const data = {};
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(unpacked).toEqual({});
            expect(buffer.length).toBe(0);
        });


        it('should handle offset parameter in unpack', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'u32' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: 0x12345678 };
            const buffer = struct.pack(data);

            // Create a larger buffer with padding
            const largeBuffer = Buffer.alloc(10);
            buffer.copy(largeBuffer, 2);

            const unpacked = struct.unpack(largeBuffer, 2);
            expect(unpacked.value).toBe(0x12345678);
        });

        it('should handle array with count 1', () => {
            const schema: StructSchema = {
                fields: [{ name: 'values', type: 'u8', count: 1 }],
            };
            const struct = c.createCStruct(schema);
            const data = { values: [42] };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            // When count is 1, it returns a single value (not an array)
            expect(unpacked.values).toBe(42);
        });
    });

    describe('Type Safety', () => {
        it('should return correct types for u64', () => {
            const schema: StructSchema = {
                fields: [{ name: 'value', type: 'u64' }],
            };
            const struct = c.createCStruct(schema);
            const data = { value: BigInt(123) };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(typeof unpacked.value).toBe('bigint');
            // Type check: unpacked.value should be bigint, not a union
            const _test: bigint = unpacked.value;
        });

        it('should return correct types for numbers', () => {
            const schema: StructSchema = {
                fields: [
                    { name: 'u8', type: 'u8' },
                    { name: 'u32', type: 'u32' },
                    { name: 'f32', type: 'f32' },
                ],
            };
            const struct = c.createCStruct(schema);
            const data = { u8: 1, u32: 2, f32: 3.0 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            expect(typeof unpacked.u8).toBe('number');
            expect(typeof unpacked.u32).toBe('number');
            expect(typeof unpacked.f32).toBe('number');
            // Type check: these should be number, not a union
            const _test1: number = unpacked.u8;
            const _test2: number = unpacked.u32;
            const _test3: number = unpacked.f32;
        });

        it('should return specific types, not unions', () => {
            const schema: StructSchema = {
                fields: [
                    { name: 'u8Value', type: 'u8' },
                    { name: 'u64Value', type: 'u64' },
                    { name: 'i32Value', type: 'i32' },
                ],
            };
            const struct = c.createCStruct(schema);
            const data = { u8Value: 1, u64Value: BigInt(2), i32Value: -3 };
            const buffer = struct.pack(data);
            const unpacked = struct.unpack(buffer);

            // These should be specific types, not unions
            const u8: number = unpacked.u8Value; // Should be number, not number | bigint
            const u64: bigint = unpacked.u64Value; // Should be bigint, not number | bigint
            const i32: number = unpacked.i32Value; // Should be number, not number | bigint

            expect(u8).toBe(1);
            expect(u64).toBe(BigInt(2));
            expect(i32).toBe(-3);
        });
    });
});



const s_blf_chunk_header_schema = c.createCStruct({
    endian: 'little',
    align: 4,
    fields: [
        { name: 'chunkType', type: 'u8', count: 4 },
        { name: 'chunkSize', type: 'u32' },
        { name: 'versionMajor', type: 'u16' },
        { name: 'versionMinor', type: 'u16' },
    ],
});

type s_blf_chunk_header = c.infer<typeof s_blf_chunk_header_schema>;

const s_blf_chunk_author_schema = c.createCStruct({
    endian: 'little',
    align: 4,
    fields: [
        { name: 'header', type: s_blf_chunk_header_schema },
        { name: 'programName', type: 'u8', count: 32 },
        { name: 'buildNumberSequence', type: 'u32' },
        { name: 'buildNumber', type: 'u32' },
        { name: 'buildString', type: 'u8', count: 32 },
        { name: 'authorName', type: 'u8', count: 32 },
    ],
});

type s_blf_chunk_author = c.infer<typeof s_blf_chunk_author_schema>;
type s_blf_chunk_author_expected = {
    header: s_blf_chunk_header;
    programName: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
    buildNumberSequence: number;
    buildNumber: number;
    buildString: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
    authorName: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
};

// Type check: these should be equal
type _authorTypeCheck1 = s_blf_chunk_author extends s_blf_chunk_author_expected ? true : false;
type _authorTypeCheck2 = s_blf_chunk_author_expected extends s_blf_chunk_author ? true : false;
type _authorTypeCheck = _authorTypeCheck1 extends true ? (_authorTypeCheck2 extends true ? true : false) : false;

// Test that the type inference works correctly
const testAuthorValue: s_blf_chunk_author = {
    header: {
        chunkType: [1, 2, 3, 4],
        chunkSize: 2,
        versionMajor: 3,
        versionMinor: 4,
    },
    programName: Array(32).fill(0) as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number],
    buildNumberSequence: 1,
    buildNumber: 2,
    buildString: Array(32).fill(0) as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number],
    authorName: Array(32).fill(0) as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number],
};

// This should compile without errors if types match
const testAuthorExpected: s_blf_chunk_author_expected = testAuthorValue;


type s_blf_chunk_header_expected = {
    chunkType: [number, number, number, number];
    chunkSize: number;
    versionMajor: number;
    versionMinor: number;
}

// Type check: these should be equal
type _typeCheck1 = s_blf_chunk_header extends s_blf_chunk_header_expected ? true : false;
type _typeCheck2 = s_blf_chunk_header_expected extends s_blf_chunk_header ? true : false;
type _typeCheck = _typeCheck1 extends true ? (_typeCheck2 extends true ? true : false) : false;

// Test that the type inference works correctly
const testValue: s_blf_chunk_header = {
    chunkType: [1, 2, 3, 4],
    chunkSize: 2,
    versionMajor: 3,
    versionMinor: 4,
};

// This should compile without errors if types match
const testExpected: s_blf_chunk_header_expected = testValue;