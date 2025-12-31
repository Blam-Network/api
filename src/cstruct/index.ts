import { AdvancedType, CString, CWString, CMagicNumber, CMagicString, CBitfield } from "./advanced";
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
         * Get the natural alignment of a struct (max alignment of its fields, capped by its pack value)
         */
        private getStructNaturalAlignment(struct: Struct): number {
            const structPack = (struct as any).pack || 1;
            
            // Calculate natural alignment from fields first
            let maxAlignment = 1;
            let hasNestedStructWithPack = false;
            for (const field of struct.fields) {
                let fieldAlignment = 1;
                if (field.type instanceof Struct) {
                    // For nested structs, use their natural alignment (which may be their pack value)
                    fieldAlignment = this.getStructNaturalAlignment(field.type);
                    const nestedPack = (field.type as any).pack || 1;
                    // If nested struct has pack >= our pack, we need to use our pack value
                    if (nestedPack >= structPack && structPack > 1) {
                        hasNestedStructWithPack = true;
                    }
                } else if (field.type instanceof AdvancedType) {
                    // AdvancedType fields (String, WString) have alignment 1 (byte arrays)
                    fieldAlignment = 1;
                } else if (field.type !== 'padding') {
                    const fieldSize = getPrimitiveTypeSize(field.type as PrimitiveType);
                    fieldAlignment = Math.min(fieldSize, 8);
                }
                maxAlignment = Math.max(maxAlignment, fieldAlignment);
            }
            
            // If struct has pack > 1 and contains a nested struct with pack >= that value,
            // use pack as alignment requirement (the nested struct needs that alignment)
            // Otherwise, use natural alignment capped by pack
            // Example: OnlinePropertySchema (pack: 8, contains OnlineDataSchema with pack: 8) -> returns 8
            // Example: OnlineContextSchema (pack: 8, only u32 fields) -> returns min(4, 8) = 4
            if (structPack > 1 && hasNestedStructWithPack) {
                return structPack;
            }
            return Math.min(maxAlignment, structPack);
        }

        /**
         * Get the alignment requirement for a field type
         */
        private getFieldAlignment(field: c.StructField, parentPack: number): number {
            if (field.type instanceof Struct) {
                // For structs, use natural alignment (max field alignment capped by struct pack)
                // This matches C++ behavior where structs without explicit pack use natural alignment
                return this.getStructNaturalAlignment(field.type);
            } else if (field.type instanceof AdvancedType) {
                // For advanced types (String, WString, etc.), alignment is 1 (byte arrays)
                // They don't need alignment beyond what pack provides
                return 1;
            } else if (field.type === 'padding') {
                return 1;
            } else {
                // For primitives, use size as alignment, capped at 8
                const size = getPrimitiveTypeSize(field.type as PrimitiveType);
                return Math.min(size, 8);
            }
        }

        /**
         * Calculate the total size of the struct
         */
        private calculateSize(schema: c.StructSchema): number {
            let totalSize = 0;
            const pack = schema.pack || 1;

            for (const field of schema.fields) {
                // For arrays, align based on element type's natural alignment
                // For single fields, align based on field's natural alignment capped by parent pack
                let alignment = pack;
                if (field.count && field.count > 1) {
                    // Array: use element type's natural alignment
                    alignment = this.getFieldAlignment(field, pack);
                } else {
                    // Single field: use field's natural alignment, capped by parent pack
                    alignment = this.getFieldAlignment(field, pack);
                }
                const offsetBeforeAlign = totalSize;
                totalSize = this.alignOffset(totalSize, alignment);

                const fieldSize = this.getFieldSize(field);
                const count = field.count || 1;
                const sizeToAdd = fieldSize * count;
                totalSize += sizeToAdd;
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
                // For arrays, align based on element type's natural alignment
                // For single fields, align based on parent pack (standard C struct behavior)
                let alignment = this.pack;
                if (field.count && field.count > 1) {
                    // Array: use element type's natural alignment
                    alignment = this.getFieldAlignment(field, this.pack);
                } else {
                    // Single field: use field's natural alignment, capped by parent pack
                    alignment = this.getFieldAlignment(field, this.pack);
                }
                currentOffset = this.alignOffset(currentOffset, alignment);

                if (field.type instanceof Struct) {
                    const nestedStruct = field.type;
                    const count = field.count || 1;

                    if (count === 1) {
                        result[field.name] = nestedStruct.read(buffer, offset + currentOffset);
                        currentOffset += nestedStruct.size;
                    } else {
                        // For arrays, elements are placed contiguously (no alignment between elements)
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
                // For arrays, align based on element type's natural alignment
                // For single fields, align based on parent pack (standard C struct behavior)
                let alignment = this.pack;
                if (field.count && field.count > 1) {
                    // Array: use element type's natural alignment
                    alignment = this.getFieldAlignment(field, this.pack);
                } else {
                    // Single field: use field's natural alignment, capped by parent pack
                    alignment = this.getFieldAlignment(field, this.pack);
                }
                currentOffset = this.alignOffset(currentOffset, alignment);

                if (field.type instanceof Struct) {
                    const nestedStruct = field.type;
                    const count = field.count || 1;
                    const value = data[field.name];

                    if (count === 1) {
                        const nestedBuffer = nestedStruct.write(value || {});
                        nestedBuffer.copy(buffer, currentOffset);
                        currentOffset += nestedStruct.size;
                    } else {
                        // For arrays, elements are placed contiguously (no alignment between elements)
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
    export const WString = CWString;
    export const MagicString = CMagicString;
    export const MagicNumber = CMagicNumber;
    export const Bitfield = CBitfield;
}