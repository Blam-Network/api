import { CArray, isCArray } from "./array";
import {
    CDataField,
    CString,
    CWString,
    CMagicNumber,
    CMagicString,
    CBitfield,
    CEnum,
    CUnion,
    CPadding,
    isCPadding,
    createPadding,
    pad as padField,
    isCDataField,
} from "./advanced";
import type { Endian as EndianType } from "./data-field";
import {
    CPrimitive,
    PrimitiveKind,
    PrimitiveTypeToTS,
    u8 as primitiveU8,
    u16 as primitiveU16,
    u32 as primitiveU32,
    u64 as primitiveU64,
    i8 as primitiveI8,
    i16 as primitiveI16,
    i32 as primitiveI32,
    i64 as primitiveI64,
    f32 as primitiveF32,
    f64 as primitiveF64,
} from "./primitive";
import {
    FieldOptions as IFieldOptions,
    FieldType,
    StructFieldValue,
    CStructField,
    getFieldOptions,
    unwrapFieldType,
} from "./field";
import { unwrapArrayElement } from "./array";
import { FlattenIntersection, Tuple, UnionToIntersection } from "./utils";

export { CDataField, isCDataField } from "./advanced";
export { CStructField, isCStructField } from "./field";

export namespace c {
    export type FieldOptions = IFieldOptions;
    export type Endian = EndianType;

    export type StructFields = Record<string, StructFieldValue>;

    type IsAny<T> = 0 extends 1 & T ? true : false;

    type FieldValueType<T extends FieldType> =
        IsAny<T> extends true
            ? any
            : T extends CPadding
                ? never
                : T extends CPrimitive<infer P>
                    ? PrimitiveTypeToTS<P>
                    : T extends Struct<infer F>
                        ? StructSchemaToTS<F>
                        : T extends CDataField<infer AT, any>
                            ? AT
                            : never;

    type ProcessArrayField<K extends string, T, N extends number> =
        N extends 1
            ? { [Key in K]: T }
            : number extends N
                ? { [Key in K]: T[] }
                : { [Key in K]: Tuple<T, N> };

    type ElementFieldType<T> =
        T extends CStructField<infer S, any>
            ? S extends Struct<infer F>
                ? StructSchemaToTS<F>
                : never
            : T extends FieldType
                ? FieldValueType<T>
                : never;

    type ProcessSchemaField<K extends string, F extends StructFieldValue> =
        IsAny<F> extends true
            ? { [Key in K]: any }
            : F extends { readonly __carray: true; readonly element: infer ET; readonly count: infer N extends number }
                ? ProcessArrayField<K, ElementFieldType<ET>, N>
                : F extends CStructField<infer S, infer _O>
                    ? S extends Struct<infer SF>
                        ? { [Key in K]: StructSchemaToTS<SF> }
                        : never
                : F extends CPadding
                    ? {}
                    : F extends FieldType
                    ? { [Key in K]: FieldValueType<F> }
                    : never;

    export type StructSchemaToTS<F extends StructFields> = FlattenIntersection<
        UnionToIntersection<{
            [K in keyof F]: ProcessSchemaField<K & string, F[K]>
        }[keyof F]>
    >;

    /** @deprecated Use StructFields directly */
    export type StructSchema<F extends StructFields = StructFields> = F;

    function normalizeFields(fields: StructFields): StructField[] {
        const result: StructField[] = [];
        for (const [name, value] of Object.entries(fields)) {
            const fieldOptions = getFieldOptions(value);
            if (fieldOptions.padBefore) {
                result.push({ name: `__pad_before_${name}`, type: createPadding(fieldOptions.padBefore) });
            }
            if (isCArray(value)) {
                result.push({ name, type: unwrapArrayElement(value.element), count: value.count });
            } else {
                result.push({ name, type: unwrapFieldType(value) });
            }
            if (fieldOptions.padAfter) {
                result.push({ name: `__pad_after_${name}`, type: createPadding(fieldOptions.padAfter) });
            }
        }
        return result;
    }

    export class Struct<F extends StructFields = StructFields> {
        private fields: readonly StructField[];
        private size: number;

        private constructor(fields: F) {
            this.fields = normalizeFields(fields);
            this.size = this.calculateSize();
        }

        static struct<const F extends StructFields>(fields: F): Struct<F> {
            return new Struct(fields);
        }

        field<const O extends IFieldOptions = {}>(options?: O): CStructField<this, O> {
            return new CStructField(this, options);
        }

        private getFieldSize(field: StructField): number {
            if (field.type instanceof Struct) {
                return field.type.size;
            } else if (isCDataField(field.type)) {
                return field.type.getSize();
            } else {
                throw new Error(`Unsupported field type for '${field.name}'`);
            }
        }

        private calculateSize(): number {
            let totalSize = 0;
            for (const field of this.fields) {
                const fieldSize = this.getFieldSize(field);
                const count = field.count ?? 1;
                totalSize += fieldSize * count;
            }
            return totalSize;
        }

        public read(buffer: Buffer, offset: number = 0, endian: EndianType = 'little'): StructSchemaToTS<F> {
            const result: any = {};
            let currentOffset = 0;

            for (const field of this.fields) {
                if (field.type instanceof Struct) {
                    const nestedStruct = field.type;
                    const count = field.count ?? 1;

                    if (count === 1) {
                        result[field.name] = nestedStruct.read(buffer, offset + currentOffset, endian);
                        currentOffset += nestedStruct.size;
                    } else {
                        result[field.name] = [];
                        for (let i = 0; i < count; i++) {
                            result[field.name].push(nestedStruct.read(buffer, offset + currentOffset, endian));
                            currentOffset += nestedStruct.size;
                        }
                    }
                    continue;
                }

                if (isCDataField(field.type)) {
                    const dataField = field.type;
                    const count = field.count ?? 1;

                    if (isCPadding(dataField)) {
                        currentOffset += dataField.getSize() * count;
                        continue;
                    }

                    if (count === 1) {
                        result[field.name] = dataField.read(buffer, offset + currentOffset, endian);
                        currentOffset += dataField.getSize();
                    } else {
                        result[field.name] = [];
                        for (let i = 0; i < count; i++) {
                            result[field.name].push(dataField.read(buffer, offset + currentOffset, endian));
                            currentOffset += dataField.getSize();
                        }
                    }
                    continue;
                }

                throw new Error(`Unsupported field type for '${field.name}'`);
            }

            return result;
        }

        public write(data: Record<string, any>, endian: EndianType = 'little'): Buffer {
            const buffer = Buffer.alloc(this.size);
            let currentOffset = 0;

            for (const field of this.fields) {
                try {
                    if (field.type instanceof Struct) {
                        const nestedStruct = field.type;
                        const count = field.count ?? 1;
                        const value = data[field.name];

                        if (count == 1 && !Array.isArray(value)) {
                            if (value === undefined || value === null) {
                                throw new Error(`Field '${field.name}' is ${value}`);
                            }
                            const nestedBuffer = nestedStruct.write(value, endian);
                            nestedBuffer.copy(buffer, currentOffset);
                            currentOffset += nestedStruct.size;
                        } else {
                            if (!Array.isArray(value)) {
                                throw new Error(`Expected array for field '${field.name}' with count ${count}`);
                            }
                            if (value.length < count) {
                                throw new Error(`Field '${field.name}' expected ${count} elements but got ${value.length}`);
                            }
                            for (let i = 0; i < count; i++) {
                                if (value[i] === undefined) {
                                    throw new Error(`Field '${field.name}[${i}]' is undefined`);
                                }
                                const nestedBuffer = nestedStruct.write(value[i], endian);
                                nestedBuffer.copy(buffer, currentOffset);
                                currentOffset += nestedStruct.size;
                            }
                        }
                        continue;
                    }

                    if (isCDataField(field.type)) {
                        const dataField = field.type;
                        const count = field.count ?? 1;

                        if (isCPadding(dataField)) {
                            for (let i = 0; i < count; i++) {
                                dataField.write(buffer, currentOffset, undefined, endian);
                                currentOffset += dataField.getSize();
                            }
                            continue;
                        }

                        const value = data[field.name];

                        if (Array.isArray(value)) {
                            for (let i = 0; i < count; i++) {
                                dataField.write(buffer, currentOffset, value[i], endian);
                                currentOffset += dataField.getSize();
                            }
                        } else {
                            dataField.write(buffer, currentOffset, value, endian);
                            currentOffset += dataField.getSize();
                        }
                        continue;
                    }

                    throw new Error(`Unsupported field type for '${field.name}'`);
                } catch (error) {
                    throw new Error(`${field.name}: ${error}`);
                }
            }

            return buffer;
        }

        public getSize(): number {
            return this.size;
        }

        public audit(): void {
            const rows: { field: string; offset: number; hex: string; size: number }[] = [];
            let currentOffset = 0;

            const pushRow = (label: string, byteOffset: number, byteSize: number) => {
                rows.push({
                    field: label,
                    offset: byteOffset,
                    hex: `0x${byteOffset.toString(16)}`,
                    size: byteSize,
                });
            };

            for (const field of this.fields) {
                const offset = currentOffset;
                const name = field.name;

                if (field.type instanceof Struct) {
                    const nested = field.type;
                    const count = field.count ?? 1;
                    const total = nested.size * count;
                    pushRow(name, offset, total);
                    currentOffset += total;
                    continue;
                }

                if (isCDataField(field.type)) {
                    const dataField = field.type;
                    const count = field.count ?? 1;
                    const total = dataField.getSize() * count;
                    if (isCPadding(dataField)) {
                        pushRow(`${name} (${total} bytes padding)`, offset, total);
                    } else {
                        pushRow(name, offset, total);
                    }
                    currentOffset += total;
                    continue;
                }

                throw new Error(`Unsupported field type for '${name}'`);
            }

            console.table(rows);
        }
    }

    export const endian = {
        little: 'little' satisfies Endian,
        big: 'big' satisfies Endian,
    } as const;

    export type infer<T> = T extends Struct<infer F>
        ? StructSchemaToTS<F>
        : never;

    export interface StructField {
        name: string;
        type: FieldType;
        count?: number;
    }

    export function struct<const F extends StructFields>(fields: F): Struct<F> {
        return Struct.struct(fields);
    }

    export function array<
        T extends StructFieldValue,
        const N extends number,
        const O extends IFieldOptions = {},
    >(element: T, count: N, options?: O): CArray<T, N, O> {
        return new CArray(element, count, options);
    }

    export function String<L extends number, const O extends IFieldOptions = {}>(length: L, encoding: BufferEncoding = 'utf8', options?: O) {
        return new CString(length, encoding, options);
    }

    export function WString<L extends number, const O extends IFieldOptions = {}>(length: L, options?: O) {
        return new CWString(length, options);
    }

    export function MagicNumber<N extends number, PT extends CPrimitive, const O extends IFieldOptions = {}>(
        magic: N,
        type: PT,
        options?: O,
    ) {
        return new CMagicNumber(magic, type, options);
    }

    export function MagicString<S extends string, const O extends IFieldOptions = {}>(magic: S, options?: O) {
        return new CMagicString(magic, options);
    }

    export function Bitfield<const K extends readonly string[], PT extends CPrimitive, const O extends IFieldOptions = {}>(
        keys: K,
        type: PT,
        options?: O,
    ) {
        return new CBitfield(keys, type, options);
    }

    export function Enum<const T extends readonly string[] | Record<string, number>, PT extends CPrimitive, const O extends IFieldOptions = {}>(
        keysOrMap: T,
        type: PT,
        options?: O,
    ) {
        return new CEnum(keysOrMap, type, options);
    }

    export function Union<S extends Record<string, Struct<any>>, const O extends IFieldOptions = {}>(members: S, options?: O) {
        return new CUnion(members, options);
    }

    export const u8 = primitiveU8;
    export const u16 = primitiveU16;
    export const u32 = primitiveU32;
    export const u64 = primitiveU64;
    export const i8 = primitiveI8;
    export const i16 = primitiveI16;
    export const i32 = primitiveI32;
    export const i64 = primitiveI64;
    export const f32 = primitiveF32;
    export const f64 = primitiveF64;
    export type Array<T extends FieldType = FieldType, N extends number = number> = CArray<T, N>;
    export const pad = padField;
    export const Pad = CPadding;
}
