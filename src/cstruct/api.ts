import { classImpl, fieldImpl } from "./class";
import { read, write, sizeof } from "./io";
import { cImpl } from "./impl";
import type { FieldType } from "./field";

export const c = Object.assign(cImpl, {
    field: fieldImpl,
    class: classImpl,
    read,
    write,
    sizeof,
});
export namespace c {
    export type FieldOptions = cImpl.FieldOptions;
    export type Endian = cImpl.Endian;
    export type StructFields = cImpl.StructFields;
    export type StructSchemaToTS<F extends StructFields> = cImpl.StructSchemaToTS<F>;
    export type infer<T> = cImpl.infer<T>;
    export type Array<T extends FieldType = FieldType, N extends number = number> = cImpl.Array<T, N>;
    export type Struct<F extends StructFields = StructFields> = cImpl.Struct<F>;
    export type StructField = cImpl.StructField;
    export type UnionOf<Arms extends readonly import("./types/discriminated-union").UnionArmInput[]> = cImpl.UnionOf<Arms>;
}
