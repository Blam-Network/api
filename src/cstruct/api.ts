import {
    classImpl,
    fieldImpl,
    readClass as readClassImpl,
    writeClass as writeClassImpl,
    sizeofClass as sizeofClassImpl,
} from "./class";
import { cImpl } from "./impl";
import type { FieldType } from "./field";

export const c = {
    struct: cImpl.struct,
    array: cImpl.array,
    String: cImpl.String,
    WString: cImpl.WString,
    MagicNumber: cImpl.MagicNumber,
    MagicString: cImpl.MagicString,
    Bitfield: cImpl.Bitfield,
    Enum: cImpl.Enum,
    Union: cImpl.Union,
    u8: cImpl.u8,
    u16: cImpl.u16,
    u32: cImpl.u32,
    u64: cImpl.u64,
    i8: cImpl.i8,
    i16: cImpl.i16,
    i32: cImpl.i32,
    i64: cImpl.i64,
    f32: cImpl.f32,
    f64: cImpl.f64,
    pad: cImpl.pad,
    Pad: cImpl.Pad,
    endian: cImpl.endian,
    Struct: cImpl.Struct,
    field: fieldImpl,
    class: classImpl,
    readClass: readClassImpl,
    writeClass: writeClassImpl,
    sizeofClass: sizeofClassImpl,
} as const;

export namespace c {
    export type FieldOptions = cImpl.FieldOptions;
    export type Endian = cImpl.Endian;
    export type StructFields = cImpl.StructFields;
    export type StructSchemaToTS<F extends StructFields> = cImpl.StructSchemaToTS<F>;
    /** @deprecated Use StructFields directly */
    export type StructSchema<F extends StructFields = StructFields> = cImpl.StructSchema<F>;
    export type infer<T> = cImpl.infer<T>;
    export type Array<T extends FieldType = FieldType, N extends number = number> = cImpl.Array<T, N>;
    export type Struct<F extends StructFields = StructFields> = cImpl.Struct<F>;
    export type StructField = cImpl.StructField;
}
