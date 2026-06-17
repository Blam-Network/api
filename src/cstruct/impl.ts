import { CArray, isCArray } from "./array";
import {
    CFieldType,
    CString,
    CWString,
    CMagicNumber,
    CMagicString,
    CBitfield,
    CEnum,
    CUnion,
    CDiscriminatedUnion,
    discriminatedUnion as discriminatedUnionField,
    arm as unionArm,
    when as unionWhen,
    isCDiscriminatedUnion,
    UnionOfArms,
    CPadding,
    CBool,
    bool as boolField,
    Time64 as time64Field,
    isCPadding,
    createPadding,
    pad as padField,
    isCFieldType,
} from "./types";
import type { Endian as EndianType } from "./field-type";
import {
    CNumber,
    NumberTypeToTS,
    CBigint,
    BigintTypeToTS,
    u8 as numberU8,
    u16 as numberU16,
    u32 as numberU32,
    i8 as numberI8,
    i16 as numberI16,
    i32 as numberI32,
    f32 as numberF32,
    f64 as numberF64,
    u64 as bigintU64,
    i64 as bigintI64,
    CNumeric,
} from "./types";
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
import { setStructFactory } from "./class";

export namespace cImpl {
    export type FieldOptions = IFieldOptions;
    export type Endian = EndianType;

    export type StructFields = Record<string, StructFieldValue>;

    type IsAny<T> = 0 extends 1 & T ? true : false;

    type FieldValueType<T extends FieldType> =
        IsAny<T> extends true
            ? any
            : T extends CPadding
                ? never
                : T extends CNumber<infer P>
                    ? NumberTypeToTS<P>
                    : T extends CBigint<infer P>
                        ? BigintTypeToTS<P>
                        : T extends Struct<infer F>
                        ? StructSchemaToTS<F>
                        : T extends CDiscriminatedUnion<infer Arms, any>
                            ? UnionOfArms<Arms> | null
                        : T extends CFieldType<infer AT, any>
                            ? AT
                            : never;

    type ProcessArrayField<K extends string, T, N extends number> =
        N extends 1
            ? { [Key in K]: T }
            : number extends N
                ? { [Key in K]: T[] }
                : { [Key in K]: Tuple<T, N> };

    type NestedStructSchema<T> =
        T extends { readonly struct: infer S }
            ? S extends Struct<infer F>
                ? StructSchemaToTS<F>
                : never
            : never;

    type ElementFieldType<T> =
        NestedStructSchema<T> extends never
            ? T extends FieldType
                ? FieldValueType<T>
                : never
            : NestedStructSchema<T>;

    type ProcessSchemaField<K extends string, F extends StructFieldValue> =
        IsAny<F> extends true
            ? { [Key in K]: any }
            : F extends { readonly __carray: true; readonly element: infer ET; readonly count: infer N extends number }
                ? ProcessArrayField<K, ElementFieldType<ET>, N>
                : NestedStructSchema<F> extends never
                    ? F extends CPadding
                        ? {}
                        : F extends FieldType
                            ? { [Key in K]: FieldValueType<F> }
                            : never
                    : { [Key in K]: NestedStructSchema<F> };

    export type StructSchemaToTS<F extends StructFields> = FlattenIntersection<
        UnionToIntersection<{
            [K in keyof F]: ProcessSchemaField<K & string, F[K]>
        }[keyof F]>
    >;

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
            if (isCDiscriminatedUnion(field.type)) {
                return field.type.getSize();
            }
            if (field.type instanceof Struct) {
                return field.type.size;
            } else if (isCFieldType(field.type)) {
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
                if (isCDiscriminatedUnion(field.type)) {
                    result[field.name] = field.type.read(buffer, offset + currentOffset, endian, result);
                    currentOffset += field.type.getSize();
                    continue;
                }

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

                if (isCFieldType(field.type)) {
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
                    if (isCDiscriminatedUnion(field.type)) {
                        field.type.write(buffer, currentOffset, data[field.name], endian, data);
                        currentOffset += field.type.getSize();
                        continue;
                    }

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

                    if (isCFieldType(field.type)) {
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
    }

    export const endian = {
        little: 'little' satisfies Endian,
        big: 'big' satisfies Endian,
    } as const;

    type InferType<T> =
        T extends Struct<infer F>
            ? StructSchemaToTS<F>
            : NestedStructSchema<T> extends never
                ? T extends { readonly __carray: true; readonly element: infer ET; readonly count: infer N extends number }
                    ? N extends 1
                        ? InferType<ET>
                        : number extends N
                            ? InferType<ET>[]
                            : Tuple<InferType<ET>, N>
                    : T extends { readonly __cdiscriminatedUnion: true; readonly arms: infer Arms }
                        ? Arms extends readonly import("./types/discriminated-union").UnionArmInput[]
                            ? UnionOfArms<Arms> | null
                            : never
                    : T extends FieldType
                        ? FieldValueType<T>
                        : never
                : NestedStructSchema<T>;

    export type UnionOf<Arms extends readonly import("./types/discriminated-union").UnionArmInput[]> =
        UnionOfArms<Arms>;

    export type infer<T> = InferType<T>;

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

    export function Time64<const O extends IFieldOptions = {}>(options?: O) {
        return time64Field(options);
    }

    export const bool = boolField;

    export function MagicNumber<N extends number, PT extends CNumeric, const O extends IFieldOptions = {}>(
        magic: N,
        type: PT,
        options?: O,
    ) {
        return new CMagicNumber(magic, type, options);
    }

    export function MagicString<S extends string, const O extends IFieldOptions = {}>(magic: S, options?: O) {
        return new CMagicString(magic, options);
    }

    export function Bitfield<const K extends readonly string[], PT extends CNumeric, const O extends IFieldOptions = {}>(
        keys: K,
        type: PT,
        options?: O,
    ) {
        return new CBitfield(keys, type, options);
    }

    export function Enum<const T extends readonly string[] | Record<string, number>, PT extends CNumeric, const O extends IFieldOptions = {}>(
        keysOrMap: T,
        type: PT,
        options?: O,
    ) {
        return new CEnum(keysOrMap, type, options);
    }

    export function Union<S extends Record<string, Struct<any>>, const O extends IFieldOptions = {}>(members: S, options?: O) {
        return new CUnion(members, options);
    }

    export function discriminatedUnion<const Arms extends readonly import("./types/discriminated-union").UnionArmInput[]>(
        options: { size: number },
        ...arms: Arms
    ) {
        return discriminatedUnionField(options, ...arms);
    }

    export const arm = unionArm;
    export const when = unionWhen;

    export const u8 = numberU8;
    export const u16 = numberU16;
    export const u32 = numberU32;
    export const u64 = bigintU64;
    export const i8 = numberI8;
    export const i16 = numberI16;
    export const i32 = numberI32;
    export const i64 = bigintI64;
    export const f32 = numberF32;
    export const f64 = numberF64;
    export type Array<T extends FieldType = FieldType, N extends number = number> = CArray<T, N>;
    export const pad = padField;
    export const Pad = CPadding;
}

setStructFactory((fields) => cImpl.struct(fields));
