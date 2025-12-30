/**
 * Custom binary struct parser/serializer
 * Supports DataView types and nested structures
 */

export type PrimitiveType = 'u8' | 'u16' | 'u32' | 'u64' | 'i8' | 'i16' | 'i32' | 'i64' | 'f32' | 'f64';

const PRIMITIVE_TYPE_SIZES: Record<PrimitiveType, number> = {
    u8: 1,
    u16: 2,
    u32: 4,
    u64: 8,
    i8: 1,
    i16: 2,
    i32: 4,
    i64: 8,
    f32: 4,
    f64: 8,
};

export interface StructField {
    name: string;
    type: PrimitiveType | CStruct<any>;
    count?: number; // For arrays
}

// Helper type to deeply preserve literal types in StructSchema
type DeepReadonly<T> = T extends PrimitiveType
    ? T
    : T extends CStruct<any>
    ? T
    : T extends object
    ? {
          readonly [K in keyof T]: T[K] extends (infer U)[]
              ? readonly DeepReadonly<U>[]
              : DeepReadonly<T[K]>;
      }
    : T;

export interface StructSchema {
    align?: number; // Alignment in bytes
    endian?: 'little' | 'big'; // Byte order, defaults to 'little'
    fields: StructField[];
}

/**
 * Map PrimitiveType to TypeScript type
 */
type PrimitiveTypeToTS<T extends PrimitiveType> = T extends 'u64' | 'i64' ? bigint : number;

/**
 * Generate a tuple type of length N (mutable, not readonly)
 */
type Tuple<T, N extends number, R extends T[] = []> = R['length'] extends N
    ? R
    : Tuple<T, N, [...R, T]>;

/**
 * Extract schema type from CStruct instance
 * This works by checking if T is a CStruct and extracting its generic parameter
 */
export type ExtractSchema<T> = T extends CStruct<infer S> ? S : never;

/**
 * Process a single field to get its name and value type
 * Uses distributive conditional to process each field individually
 */
type ProcessField<F extends StructField> = F extends StructField
    ? F extends { type: infer T; count: infer C; name: infer N }
        ? N extends string
            ? T extends PrimitiveType
                ? C extends number
                    ? C extends 1
                        ? { [K in N]: PrimitiveTypeToTS<T> }
                        : { [K in N]: Tuple<PrimitiveTypeToTS<T>, C> }
                    : { [K in N]: PrimitiveTypeToTS<T> }
                : T extends CStruct<infer S>
                    ? S extends StructSchema
                        ? C extends number
                            ? C extends 1
                                ? { [K in N]: StructSchemaToTS<S> }
                                : { [K in N]: Tuple<StructSchemaToTS<S>, C> }
                            : { [K in N]: StructSchemaToTS<S> }
                        : never
                    : T extends { __schemaType: infer S }
                    ? S extends StructSchema
                        ? C extends number
                            ? C extends 1
                                ? { [K in N]: StructSchemaToTS<S> }
                                : { [K in N]: Tuple<StructSchemaToTS<S>, C> }
                            : { [K in N]: StructSchemaToTS<S> }
                        : never
                    : never
            : never
        : F extends { type: infer T; name: infer N }
        ? N extends string
            ? T extends PrimitiveType
                ? { [K in N]: PrimitiveTypeToTS<T> }
                : T extends CStruct<infer S>
                    ? S extends StructSchema
                        ? { [K in N]: StructSchemaToTS<S> }
                        : never
                    : T extends { __schemaType: infer S }
                    ? S extends StructSchema
                        ? { [K in N]: StructSchemaToTS<S> }
                        : never
                    : never
            : never
        : never
    : never;

/**
 * Union to intersection helper
 */
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

/**
 * Flatten an intersection of object types into a single object type
 * Converts { a: 1 } & { b: 2 } into { a: 1; b: 2 }
 * Recursively flattens nested object types for cleaner display
 * This makes the type display cleaner in IDEs
 */
type FlattenIntersection<T> = T extends object
    ? {
          [K in keyof T]: T[K] extends object
              ? FlattenIntersection<T[K]>
              : T[K];
      }
    : T;

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
    private schema: S;
    private size: number;
    public readonly __schemaType!: S; // Type marker for TypeScript

    private constructor(schema: S) {
        this.schema = schema;
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
     * Calculate the total size of the struct
     */
    private calculateSize(schema: StructSchema): number {
        let totalSize = 0;
        for (const field of schema.fields) {
            if (field.type instanceof CStruct) {
                totalSize += field.type.size * (field.count || 1);
            } else {
                const fieldSize = this.getTypeSize(field.type as PrimitiveType);
                totalSize += fieldSize * (field.count || 1);
            }
        }
        
        // Apply alignment if specified
        if (schema.align) {
            totalSize = Math.ceil(totalSize / schema.align) * schema.align;
        }
        
        return totalSize;
    }

    /**
     * Get the size in bytes for a PrimitiveType
     */
    private getTypeSize(type: PrimitiveType): number {
        return PRIMITIVE_TYPE_SIZES[type];
    }

    /**
     * Read a value from DataView based on type
     */
    private readValue(view: DataView, offset: number, type: PrimitiveType, littleEndian: boolean = true): number | bigint {
        switch (type) {
            case 'u8':
                return view.getUint8(offset);
            case 'u16':
                return view.getUint16(offset, littleEndian);
            case 'u32':
                return view.getUint32(offset, littleEndian);
            case 'u64':
                return view.getBigUint64(offset, littleEndian);
            case 'i8':
                return view.getInt8(offset);
            case 'i16':
                return view.getInt16(offset, littleEndian);
            case 'i32':
                return view.getInt32(offset, littleEndian);
            case 'i64':
                return view.getBigInt64(offset, littleEndian);
            case 'f32':
                return view.getFloat32(offset, littleEndian);
            case 'f64':
                return view.getFloat64(offset, littleEndian);
            default:
                throw new Error(`Unsupported type: ${type}`);
        }
    }

    /**
     * Write a value to DataView based on type
     */
    private writeValue(
        view: DataView,
        offset: number,
        type: PrimitiveType,
        value: number | bigint,
        littleEndian: boolean = true,
    ): void {
        switch (type) {
            case 'u8':
                view.setUint8(offset, value as number);
                break;
            case 'u16':
                view.setUint16(offset, value as number, littleEndian);
                break;
            case 'u32':
                view.setUint32(offset, value as number, littleEndian);
                break;
            case 'u64':
                view.setBigUint64(offset, value as bigint, littleEndian);
                break;
            case 'i8':
                view.setInt8(offset, value as number);
                break;
            case 'i16':
                view.setInt16(offset, value as number, littleEndian);
                break;
            case 'i32':
                view.setInt32(offset, value as number, littleEndian);
                break;
            case 'i64':
                view.setBigInt64(offset, value as bigint, littleEndian);
                break;
            case 'f32':
                view.setFloat32(offset, value as number, littleEndian);
                break;
            case 'f64':
                view.setFloat64(offset, value as number, littleEndian);
                break;
            default:
                throw new Error(`Unsupported type: ${type}`);
        }
    }

    /**
     * Parse a buffer into an object based on the schema
     */
    public unpack(buffer: Buffer, offset: number = 0): c.infer<this> {
        const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
        const result: any = {};
        let currentOffset = 0;
        const littleEndian = (this.schema.endian || 'little') === 'little';

        for (const field of this.schema.fields) {
            if (field.type instanceof CStruct) {
                const nestedStruct = field.type;
                const count = field.count || 1;

                if (count === 1) {
                    result[field.name] = nestedStruct.unpack(buffer, offset + currentOffset);
                    currentOffset += nestedStruct.size;
                } else {
                    result[field.name] = [];
                    for (let i = 0; i < count; i++) {
                        result[field.name].push(nestedStruct.unpack(buffer, offset + currentOffset));
                        currentOffset += nestedStruct.size;
                    }
                }
                continue;
            }

            const type = field.type as PrimitiveType;
            const count = field.count || 1;
            const fieldSize = this.getTypeSize(type);

            if (count === 1) {
                result[field.name] = this.readValue(view, currentOffset, type, littleEndian);
                currentOffset += fieldSize;
            } else {
                result[field.name] = [];
                for (let i = 0; i < count; i++) {
                    result[field.name].push(this.readValue(view, currentOffset, type, littleEndian));
                    currentOffset += fieldSize;
                }
            }
        }

        return result;
    }

    /**
     * Pack an object into a buffer based on the schema
     */
    public pack(data: Record<string, any>): Buffer {
        const buffer = Buffer.alloc(this.size);
        const view = new DataView(buffer.buffer, buffer.byteOffset);
        let currentOffset = 0;
        const littleEndian = (this.schema.endian || 'little') === 'little';

        for (const field of this.schema.fields) {
            if (field.type instanceof CStruct) {
                const nestedStruct = field.type;
                const count = field.count || 1;
                const value = data[field.name];

                if (count === 1) {
                    const nestedBuffer = nestedStruct.pack(value || {});
                    nestedBuffer.copy(buffer, currentOffset);
                    currentOffset += nestedStruct.size;
                } else {
                    const array = value || [];
                    for (let i = 0; i < count; i++) {
                        const nestedBuffer = nestedStruct.pack(array[i] || {});
                        nestedBuffer.copy(buffer, currentOffset);
                        currentOffset += nestedStruct.size;
                    }
                }
                continue;
            }

            const type = field.type as PrimitiveType;
            const count = field.count || 1;
            const value = data[field.name];

            if (count === 1) {
                this.writeValue(view, currentOffset, type, value, littleEndian);
                currentOffset += this.getTypeSize(type);
            } else {
                const fieldSize = this.getTypeSize(type);
                const array = value || [];
                for (let i = 0; i < count; i++) {
                    this.writeValue(view, currentOffset, type, array[i] || 0, littleEndian);
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

/**
 * Type inference utility for CStruct, similar to Zod's z.infer
 * Usage: type MyType = c.infer<typeof myCStruct>;
 */
export namespace c {
    export type infer<T> = T extends CStruct<infer S> 
        ? StructSchemaToTS<S> 
        : never;
}

export const c = {
    CStruct,
    createCStruct: CStruct.createCStruct,
}