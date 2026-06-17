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

export class CClassField<S, const O extends FieldOptions = {}> {
    readonly __cclassField = true as const;
    readonly struct: S;
    readonly options: O;

    constructor(struct: S, options?: O) {
        this.struct = struct;
        this.options = (options ?? {}) as O;
    }
}

export function isCClassField(value: unknown): value is CClassField<any, any> {
    return typeof value === 'object' && value !== null && '__cclassField' in value && (value as CClassField<any>).__cclassField === true;
}

export class CAnnotatedField<T extends StructFieldValue = StructFieldValue, const O extends FieldOptions = {}> {
    readonly __cstructAnnotatedField = true as const;
    readonly field: T;
    readonly options: O;

    constructor(field: T, options?: O) {
        this.field = field;
        this.options = (options ?? {}) as O;
    }
}

export function isCAnnotatedField(value: unknown): value is CAnnotatedField<any, any> {
    return typeof value === 'object' && value !== null && '__cstructAnnotatedField' in value && (value as CAnnotatedField<any>).__cstructAnnotatedField === true;
}

export type StructFieldValue =
    | CDataField<any, any>
    | StructFieldType
    | CArray<any, any, any>
    | CStructField<any, any>
    | CClassField<any, any>
    | CAnnotatedField<any, any>;

export function getFieldOptions(value: StructFieldValue): FieldOptions {
    if (isCStructField(value) || isCClassField(value) || isCAnnotatedField(value)) {
        return value.options;
    }
    if ('options' in value && value.options) {
        return value.options as FieldOptions;
    }
    return {};
}

export function unwrapFieldType(value: StructFieldValue): FieldType {
    if (isCStructField(value) || isCClassField(value)) {
        return value.struct as FieldType;
    }
    if (isCAnnotatedField(value)) {
        return unwrapFieldType(value.field);
    }
    if ('__carray' in value && (value as CArray).element) {
        return unwrapFieldType((value as CArray).element as StructFieldValue);
    }
    return value as FieldType;
}
