import type { CDataField } from "./data-field";
import type { CArray } from "./array";

export interface FieldOptions {
    padBefore?: number;
    padAfter?: number;
}

/** Runtime shape shared by nested struct field types. */
export type StructFieldType = {
    size: number;
    getSize(): number;
    read(buffer: Buffer, offset?: number): unknown;
    write(data: Record<string, unknown>): Buffer;
};

export type FieldType = CDataField<any, any> | StructFieldType;

export class CStructField<S, const O extends FieldOptions = {}> {
    readonly __cstructField = true as const;
    readonly struct: S;
    readonly options: O;

    constructor(struct: S, options?: O) {
        this.struct = struct;
        this.options = (options ?? {}) as O;
    }
}

export function isCStructField(value: unknown): value is CStructField<any, any> {
    return typeof value === 'object' && value !== null && '__cstructField' in value && (value as CStructField<any>).__cstructField === true;
}

export type StructFieldValue =
    | CDataField<any, any>
    | StructFieldType
    | CArray<any, any, any>
    | CStructField<any, any>;

export function getFieldOptions(value: StructFieldValue): FieldOptions {
    if (isCStructField(value)) {
        return value.options;
    }
    if ('options' in value && value.options) {
        return value.options as FieldOptions;
    }
    return {};
}

export function unwrapFieldType(value: StructFieldValue): FieldType {
    if (isCStructField(value)) {
        return value.struct as FieldType;
    }
    if ('__carray' in value && (value as CArray).element) {
        return unwrapFieldType((value as CArray).element as StructFieldValue);
    }
    return value as FieldType;
}
