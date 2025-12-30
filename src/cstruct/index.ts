import { AdvancedType, CString, MagicNumber, MagicString } from "./advanced";
import { getPrimitiveTypeSize, PrimitiveType, PrimitiveTypeToTS, readPrimitiveValue, writePrimitiveValue } from "./primitive";
import { FlattenIntersection, Tuple, UnionToIntersection } from "./utils";

interface StructField {
    name: string;
    type: PrimitiveType | CStruct<any> | AdvancedType<any> | { __schemaType: StructSchema };
    count?: number; // For arrays
}

interface StructSchema {
    pack?: number; // Packing/alignment in bytes
    endian?: 'little' | 'big'; // Byte order, defaults to 'little'
    fields: readonly StructField[];
}

/**
 * Process a single field to get its name and value type
 * Uses distributive conditional to process each field individually
 */
type ProcessField<F> = F extends { type: any; name: any }
    ? F extends { type: infer T; count: infer C; name: infer N }
        ? N extends string
            ? T extends PrimitiveType
                ? C extends number
                    ? C extends 1
                        ? { [K in N]: PrimitiveTypeToTS<T> }
                        : { [K in N]: Tuple<PrimitiveTypeToTS<T>, C> }
                    : { [K in N]: PrimitiveTypeToTS<T> }
                : T extends { __schemaType: infer S }
                    ? S extends StructSchema
                        ? C extends number
                            ? C extends 1
                                ? { [K in N]: StructSchemaToTS<S> }
                                : { [K in N]: Tuple<StructSchemaToTS<S>, C> }
                            : { [K in N]: StructSchemaToTS<S> }
                        : never
                    : T extends CStruct<infer S>
                        ? S extends StructSchema
                            ? C extends number
                                ? C extends 1
                                    ? { [K in N]: StructSchemaToTS<S> }
                                    : { [K in N]: Tuple<StructSchemaToTS<S>, C> }
                                : { [K in N]: StructSchemaToTS<S> }
                            : never
                        : T extends AdvancedType<infer AT>
                            ? C extends number
                                ? C extends 1
                                    ? { [K in N]: AT }
                                    : { [K in N]: Tuple<AT, C> }
                                : { [K in N]: AT }
                            : never
            : never
        : F extends { type: infer T; name: infer N }
        ? N extends string
            ? T extends PrimitiveType
                ? { [K in N]: PrimitiveTypeToTS<T> }
                : T extends { __schemaType: infer S }
                    ? S extends StructSchema
                        ? { [K in N]: StructSchemaToTS<S> }
                        : never
                    : T extends CStruct<infer S>
                        ? S extends StructSchema
                            ? { [K in N]: StructSchemaToTS<S> }
                            : never
                        : T extends AdvancedType<infer AT>
                            ? { [K in N]: AT }
                            : T extends CString<any>
                                ? { [K in N]: string }
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
export type StructSchemaToTS<S extends StructSchema> = FlattenIntersection<
    UnionToIntersection<ProcessField<S['fields'][number]>>
>;

class CStruct<S extends StructSchema = StructSchema> {
    private endian: c.Endian;
    private pack: number;
    private fields: readonly StructField[];
    private size: number;
    public readonly __schemaType!: S; // Type marker for TypeScript

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
    static createCStruct<const S extends StructSchema>(schema: S): CStruct<S> {
        return new CStruct(schema);
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
    private getFieldSize(field: StructField): number {
        if (field.type instanceof CStruct) {
            return field.type.size;
        } else if (field.type instanceof AdvancedType) {
            return field.type.getSize();
        } else {
            return getPrimitiveTypeSize(field.type as PrimitiveType);
        }
    }

    /**
     * Calculate the total size of the struct
     */
    private calculateSize(schema: StructSchema): number {
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

            if (field.type instanceof CStruct) {
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

            const type = field.type as PrimitiveType;
            const count = field.count || 1;
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

            if (field.type instanceof CStruct) {
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

                if (typeof value !== 'string') {
                    throw new Error(`Field '${field.name}': expected string, got ${typeof value}`);
                }

                if (count > 1 && !Array.isArray(value)) {
                    throw new Error(`Field '${field.name}': expected array of strings, got ${typeof value}`);
                }

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

            const type = field.type as PrimitiveType;
            const count = field.count || 1;
            const value = data[field.name];
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

const endian = {
    little: 'little' satisfies c.Endian,
    big: 'big' satisfies c.Endian,
} as const;

/**
 * Type inference utility for CStruct, similar to Zod's z.infer
 * Usage: type MyType = c.infer<typeof myCStruct>;
 */
export namespace c {
    export type infer<T> = T extends CStruct<infer S>
        ? StructSchemaToTS<S>
        : T extends { __schemaType: infer S }
            ? S extends StructSchema
                ? StructSchemaToTS<S>
                : never
            : never;

    export type Endian = 'little' | 'big';
}

export const c = {
    Struct: CStruct,
    createCStruct: CStruct.createCStruct,
    String: CString,
    MagicString: MagicString,
    MagicNumber: MagicNumber,

    endian,
}