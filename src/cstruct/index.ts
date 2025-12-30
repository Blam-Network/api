import { AdvancedType, CString, CMagicNumber, CMagicString } from "./advanced";
import { getPrimitiveTypeSize, PrimitiveType, PrimitiveTypeToTS, readPrimitiveValue, writePrimitiveValue } from "./primitive";
import { FlattenIntersection, Tuple, UnionToIntersection } from "./utils";

export namespace c {
    type Padding = 'padding';

    /**
     * Process a single field to get its name and value type
     * Uses distributive conditional to process each field individually
     * 
     * Handles two cases:
     * 1. Fields with a `count` property (arrays)
     * 2. Fields without a `count` property (single values)
     * 
     * For each case, checks the field type in order:
     * - PrimitiveType (u8, u16, u32, etc.) -> maps to number/bigint
     * - Struct (nested structs) -> recursively processes the nested schema
     * - AdvancedType (CString, MagicString, MagicNumber) -> uses the generic type parameter
     */
    type ProcessField<F> = F extends { type: any; name: any }
        // Case 1: Field with count property (array)
        ? F extends { type: infer T; count: infer C; name: infer N }
            ? N extends string
                // Primitive type with count
                ? T extends PrimitiveType
                    ? C extends number
                        ? C extends 1
                            // count: 1 is same as no count, return single value
                            ? { [K in N]: PrimitiveTypeToTS<T> }
                            // count > 1, return tuple type
                            : { [K in N]: Tuple<PrimitiveTypeToTS<T>, C> }
                        // count is not a literal number, return single value
                        : { [K in N]: PrimitiveTypeToTS<T> }
                    // Nested struct with count
                    : T extends Struct<infer S>
                            ? S extends c.StructSchema
                                ? C extends number
                                    ? C extends 1
                                        // count: 1, return single nested struct type
                                        ? { [K in N]: StructSchemaToTS<S> }
                                        // count > 1, return tuple of nested struct types
                                        : { [K in N]: Tuple<StructSchemaToTS<S>, C> }
                                    // count is not a literal number, return single nested struct type
                                    : { [K in N]: StructSchemaToTS<S> }
                                : never
                            // AdvancedType (CString, MagicString, MagicNumber) with count
                            : T extends AdvancedType<infer AT>
                                ? C extends number
                                    ? C extends 1
                                        // count: 1, return single value
                                        ? { [K in N]: AT }
                                        // count > 1, return tuple type
                                        : { [K in N]: Tuple<AT, C> }
                                    // count is not a literal number, return single value
                                    : { [K in N]: AT }
                                : never
                : never
            // Case 2: Field without count property (single value)
            : F extends { type: infer T; name: infer N }
            ? N extends string
                // Primitive type without count
                ? T extends PrimitiveType
                    ? { [K in N]: PrimitiveTypeToTS<T> }
                    // Nested struct without count
                    : T extends Struct<infer S>
                            ? S extends c.StructSchema
                                ? { [K in N]: StructSchemaToTS<S> }
                                : never
                            // AdvancedType without count
                            : T extends AdvancedType<infer AT>
                                ? { [K in N]: AT }
                                : never
                : never
            : never
        : never;

    /**
     * Map StructSchema to TypeScript type
     * Uses distributive conditional to process each field individually, avoiding unions
     * Flattens the intersection into a single object type for better readability
     * Recursively flattens nested struct types as well
     */
    export type StructSchemaToTS<S extends c.StructSchema> = FlattenIntersection<
        UnionToIntersection<ProcessField<S['fields'][number]>>
    >;

    export class Struct<S extends c.StructSchema = c.StructSchema> {
        private endian: c.Endian;
        private pack: number;
        private fields: readonly c.StructField[];
        private size: number;

        private constructor(schema: S) {
            this.endian = schema.endian || 'little';
            this.pack = schema.pack || 1;
            this.fields = schema.fields;
            this.size = this.calculateSize(schema);
        }
        
        /**
         * Internal factory method that can access the private constructor
         * Uses a more permissive type to accept schemas with literal types preserved
         */
        static createCStruct<const S extends c.StructSchema>(schema: S): Struct<S> {
            return new Struct(schema);
        }

        /**
         * Align offset to pack boundary
         */
        private alignOffset(offset: number, pack?: number): number {
            if (!pack) return offset;
            return Math.ceil(offset / pack) * pack;
        }

        /**
         * Get the size of a field
         */
        private getFieldSize(field: c.StructField): number {
            if (field.type instanceof Struct) {
                return field.type.size;
            } else if (field.type instanceof AdvancedType) {
                return field.type.getSize();
            } else if (field.type === 'padding') {
                return 1;
            } else {
                return getPrimitiveTypeSize(field.type as PrimitiveType);
            }
        }

        /**
         * Calculate the total size of the struct
         */
        private calculateSize(schema: c.StructSchema): number {
            let totalSize = 0;
            const pack = schema.pack;

            for (const field of schema.fields) {
                // Align offset before field
                totalSize = this.alignOffset(totalSize, pack);

                const fieldSize = this.getFieldSize(field);
                totalSize += fieldSize * (field.count || 1);
            }
            
            // Align final size
            totalSize = this.alignOffset(totalSize, pack);
            
            return totalSize;
        }

        /**
         * Parse a buffer into an object based on the schema
         */
        public read(buffer: Buffer, offset: number = 0): c.infer<this> {
            const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
            const result: any = {};
            let currentOffset = 0;
            const littleEndian = this.endian === 'little';

            for (const field of this.fields) {
                // Align offset before field
                currentOffset = this.alignOffset(currentOffset, this.pack);

                if (field.type instanceof Struct) {
                    const nestedStruct = field.type;
                    const count = field.count || 1;

                    if (count === 1) {
                        result[field.name] = nestedStruct.read(buffer, offset + currentOffset);
                        currentOffset += nestedStruct.size;
                    } else {
                        result[field.name] = [];
                        for (let i = 0; i < count; i++) {
                            result[field.name].push(nestedStruct.read(buffer, offset + currentOffset));
                            currentOffset += nestedStruct.size;
                        }
                    }
                    continue;
                }

                if (field.type instanceof AdvancedType) {
                    const advancedType = field.type;
                    const count = field.count || 1;

                    if (count === 1) {
                        result[field.name] = advancedType.read(buffer, offset + currentOffset, this.endian);
                        currentOffset += advancedType.getSize();
                    } else {
                        result[field.name] = [];
                        for (let i = 0; i < count; i++) {
                            result[field.name].push(advancedType.read(buffer, offset + currentOffset, this.endian));
                            currentOffset += advancedType.getSize();
                        }
                    }
                    continue;
                }

                const type = field.type satisfies PrimitiveType | Padding;
                const count = field.count || 1;


                if (type === 'padding') {
                    currentOffset += count;
                    continue;
                }

                const fieldSize = getPrimitiveTypeSize(type);

                if (count === 1) {
                    result[field.name] = readPrimitiveValue(view, currentOffset, type, littleEndian);
                    currentOffset += fieldSize;
                } else {
                    result[field.name] = [];
                    for (let i = 0; i < count; i++) {
                        result[field.name].push(readPrimitiveValue(view, currentOffset, type, littleEndian));
                        currentOffset += fieldSize;
                    }
                }
            }

            return result;
        }

        /**
         * Pack an object into a buffer based on the schema
         */
        public write(data: Record<string, any>): Buffer {
            const buffer = Buffer.alloc(this.size);
            const view = new DataView(buffer.buffer, buffer.byteOffset);
            let currentOffset = 0;
            const littleEndian = this.endian === 'little';

            for (const field of this.fields) {
                // Align offset before field
                currentOffset = this.alignOffset(currentOffset, this.pack);

                if (field.type instanceof Struct) {
                    const nestedStruct = field.type;
                    const count = field.count || 1;
                    const value = data[field.name];

                    if (count === 1) {
                        const nestedBuffer = nestedStruct.write(value || {});
                        nestedBuffer.copy(buffer, currentOffset);
                        currentOffset += nestedStruct.size;
                    } else {
                        const array = value || [];
                        for (let i = 0; i < count; i++) {
                            const nestedBuffer = nestedStruct.write(array[i] || {});
                            nestedBuffer.copy(buffer, currentOffset);
                            currentOffset += nestedStruct.size;
                        }
                    }
                    continue;
                }

                if (field.type instanceof AdvancedType) {
                    const advancedType = field.type;
                    const count = field.count || 1;
                    const value = data[field.name];



                    if (Array.isArray(value)) {
                        for (let i = 0; i < count; i++) {
                            advancedType.write(buffer, currentOffset, value[i], this.endian);
                            currentOffset += advancedType.getSize();
                        }
                    } else {
                        advancedType.write(buffer, currentOffset, value, this.endian);
                        currentOffset += advancedType.getSize();
                    }
                    continue;
                }

                const type = field.type satisfies PrimitiveType | Padding;
                const count = field.count || 1;
                const value = data[field.name];

                if (type === 'padding') {
                    buffer.fill(0, currentOffset, currentOffset + count);
                    currentOffset += count;
                    continue;
                }

                const fieldSize = getPrimitiveTypeSize(type);

                if (count === 1) {
                    writePrimitiveValue(view, currentOffset, type, value, littleEndian);
                    currentOffset += fieldSize;
                } else {
                    const array = value || [];
                    for (let i = 0; i < count; i++) {
                        writePrimitiveValue(view, currentOffset, type, array[i] || 0, littleEndian);
                        currentOffset += fieldSize;
                    }
                }
            }

            return buffer;
        }

        /**
         * Get the size of this struct in bytes
         */
        public getSize(): number {
            return this.size;
        }
    }

    export type Endian = 'little' | 'big';

    export const endian = {
        little: 'little' satisfies c.Endian,
        big: 'big' satisfies c.Endian,
    } as const;

    /**
     * Type inference utility for Struct, similar to Zod's z.infer
     * Usage: type MyType = c.infer<typeof myStruct>;
     */
    export type infer<T> = T extends Struct<infer S>
        ? StructSchemaToTS<S>
        : never;


    export interface StructField {
        name: string;
        type: PrimitiveType | 'padding' | Struct<any> | AdvancedType<any>;
        count?: number; // For arrays
    }
    
    export interface StructSchema {
        pack?: number; // Packing/alignment in bytes
        endian?: 'little' | 'big'; // Byte order, defaults to 'little'
        fields: readonly c.StructField[];
    }
    
    export const createCStruct = Struct.createCStruct;
    export const String = CString;
    export const MagicString = CMagicString;
    export const MagicNumber = CMagicNumber;
}