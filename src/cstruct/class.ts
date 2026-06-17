import { CArray, isCArray } from "./array";
import { isCPadding } from "./advanced";
import {
    CAnnotatedField,
    CClassField,
    CStructField,
    FieldOptions,
    StructFieldValue,
    isCClassField,
    isCStructField,
    isCAnnotatedField,
} from "./field";

export { CClassField, isCClassField } from "./field";

export const CCLASS_LAYOUT = Symbol.for("cstruct.class.layout");
export const CSTRUCT_CLASS = Symbol.for("cstruct.class.struct");

export type ClassCtor<T = object> = new (...args: any[]) => T;

export interface ClassFieldMeta {
    name: string;
    type: StructFieldValue | ClassCtor;
    padBefore?: number;
    padAfter?: number;
    count?: number;
}

const PENDING_FIELDS = new WeakMap<Function, ClassFieldMeta[]>();
const CLASS_STRUCTS = new WeakMap<Function, unknown>();

type StructLike = {
    read(buffer: Buffer, offset?: number, endian?: "little" | "big"): Record<string, unknown>;
    write(data: Record<string, unknown>, endian?: "little" | "big"): Buffer;
    getSize(): number;
};

export function isClassCtor(value: unknown): value is ClassCtor {
    return typeof value === "function" && (value as unknown as { [key: symbol]: unknown })[CCLASS_LAYOUT] === true;
}

export function getClassStruct(ctor: ClassCtor): StructLike {
    const struct = CLASS_STRUCTS.get(ctor);
    if (!struct) {
        throw new Error(`${ctor.name}: not decorated with @c.class()`);
    }
    return struct as StructLike;
}

function getC() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./api").c as typeof import("./api").c;
}

function isStructInstance(value: unknown): value is StructLike & { field(options?: FieldOptions): CStructField<StructLike, FieldOptions> } {
    return (
        typeof value === "object" &&
        value !== null &&
        "field" in value &&
        typeof (value as { field?: unknown }).field === "function" &&
        "read" in value &&
        "write" in value &&
        "getSize" in value
    );
}

function normalizeFieldType(
    type: StructFieldValue | ClassCtor | (StructLike & { field(options?: FieldOptions): unknown }),
    options?: FieldOptions & { count?: number },
): StructFieldValue | ClassCtor {
    if (isClassCtor(type)) {
        return type;
    }
    if (isStructInstance(type)) {
        const nested = type.field(options);
        return nested as StructFieldValue;
    }
    return type as StructFieldValue;
}

function isFieldOptions(value: unknown): value is FieldOptions & { count?: number } {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    if (isClassCtor(value) || isCArray(value) || isCStructField(value) || isCClassField(value) || isCAnnotatedField(value)) {
        return false;
    }
    if (isStructInstance(value)) {
        return false;
    }
    if ("getSize" in value && "read" in value && "write" in value) {
        return false;
    }
    return "padBefore" in value || "padAfter" in value || "count" in value;
}

function metaToFieldValue(meta: ClassFieldMeta): StructFieldValue {
    if (isClassCtor(meta.type)) {
        return new CClassField(getClassStruct(meta.type));
    }

    if (meta.count !== undefined) {
        return new CArray(meta.type as StructFieldValue, meta.count, {
            padBefore: meta.padBefore,
            padAfter: meta.padAfter,
        });
    }

    let value = meta.type as StructFieldValue;
    if (meta.padBefore || meta.padAfter) {
        value = new CAnnotatedField(value, {
            padBefore: meta.padBefore,
            padAfter: meta.padAfter,
        });
    }
    return value;
}

export function finalizeClassDecorator(target: Function): void {
    const metas = PENDING_FIELDS.get(target) ?? [];
    if (metas.length === 0) {
        throw new Error(`${target.name}: no @c.field metadata`);
    }

    const fields: Record<string, StructFieldValue> = {};
    for (const meta of metas) {
        fields[meta.name] = metaToFieldValue(meta);
    }

    const struct = getC().struct(fields);
    CLASS_STRUCTS.set(target, struct);
    Object.defineProperty(target, CCLASS_LAYOUT, {
        value: true,
        enumerable: false,
        configurable: false,
    });
    Object.defineProperty(target, CSTRUCT_CLASS, {
        value: struct,
        enumerable: false,
        configurable: false,
    });
    PENDING_FIELDS.delete(target);
}

type ClassDecorator = <T extends ClassCtor>(target: T) => T;

export function classImpl(): ClassDecorator;
export function classImpl<C extends ClassCtor>(ctor: C, options?: FieldOptions): CClassField<StructLike, FieldOptions>;
export function classImpl(ctorOrVoid?: ClassCtor, options?: FieldOptions) {
    if (ctorOrVoid === undefined) {
        return ((target: Function) => {
            finalizeClassDecorator(target);
        }) as ClassDecorator;
    }
    return new CClassField(getClassStruct(ctorOrVoid), options);
}

export function fieldImpl(
    typeOrOptions: StructFieldValue | ClassCtor | (StructLike & { field(options?: FieldOptions): unknown }) | (FieldOptions & { count?: number }),
    maybeOptions?: FieldOptions & { count?: number },
) {
    return (target: object, propertyKey: string | symbol): void => {
        const ctor = target.constructor as Function;
        const name = String(propertyKey);

        if (typeOrOptions === undefined) {
            throw new Error("@c.field() requires a field type");
        }

        if (isFieldOptions(typeOrOptions)) {
            throw new Error("@c.field({ ... }) requires the field type as the first argument");
        }

        const structOptions = isStructInstance(typeOrOptions) ? maybeOptions : undefined;
        const type = normalizeFieldType(
            typeOrOptions as StructFieldValue | ClassCtor | (StructLike & { field(options?: FieldOptions): unknown }),
            structOptions,
        );
        const options = isStructInstance(typeOrOptions) ? undefined : maybeOptions;

        if (isCPadding(type as StructFieldValue) && name.startsWith("_") && options?.count !== undefined) {
            throw new Error("c.pad() cannot be used with { count }");
        }

        const list = PENDING_FIELDS.get(ctor) ?? [];
        list.push({
            name,
            type,
            padBefore: options?.padBefore,
            padAfter: options?.padAfter,
            count: options?.count,
        });
        PENDING_FIELDS.set(ctor, list);
    };
}

export function readClass(ctor: ClassCtor, buffer: Buffer, offset = 0, endian: "little" | "big" = "little") {
    return getClassStruct(ctor).read(buffer, offset, endian);
}

export function writeClass(ctor: ClassCtor, data: Record<string, unknown>, endian: "little" | "big" = "little") {
    return getClassStruct(ctor).write(data, endian);
}

export function sizeofClass(ctor: ClassCtor) {
    return getClassStruct(ctor).getSize();
}
