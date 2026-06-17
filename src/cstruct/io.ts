import { cImpl } from "./impl";
import { ClassCtor, getClassFieldNames, getClassStruct, isClassCtor, isClassInstance } from "./class";

export type Endian = cImpl.Endian;

export function isStructSchema(value: unknown): value is cImpl.Struct<cImpl.StructFields> {
    return value instanceof cImpl.Struct;
}

function classInstanceToRecord(instance: object): Record<string, unknown> {
    const ctor = instance.constructor as ClassCtor;
    const names = getClassFieldNames(ctor);
    const data: Record<string, unknown> = {};
    for (const name of names) {
        data[name] = (instance as Record<string, unknown>)[name];
    }
    return data;
}

export function read<F extends cImpl.StructFields>(
    schema: cImpl.Struct<F>,
    buffer: Buffer,
    offset?: number,
    endian?: Endian,
): cImpl.StructSchemaToTS<F>;
export function read<T extends object>(instance: T, buffer: Buffer, offset?: number, endian?: Endian): T;
export function read(target: unknown, buffer: Buffer, offset = 0, endian: Endian = "little"): unknown {
    if (isStructSchema(target)) {
        return target.read(buffer, offset, endian);
    }
    if (isClassInstance(target)) {
        const data = getClassStruct(target.constructor as ClassCtor).read(buffer, offset, endian);
        return Object.assign(target, data);
    }
    throw new Error("c.read() expects a c.struct schema or @c.class() instance");
}

export function write<F extends cImpl.StructFields>(
    schema: cImpl.Struct<F>,
    data: cImpl.StructSchemaToTS<F>,
    endian?: Endian,
): Buffer;
export function write<T extends object>(instance: T, endian?: Endian): Buffer;
export function write(target: unknown, arg2?: unknown, arg3?: Endian): Buffer {
    if (isStructSchema(target)) {
        if (arg2 === undefined || arg2 === "little" || arg2 === "big") {
            throw new Error("c.write(schema, data) requires a data object");
        }
        const endian = arg3 ?? "little";
        return target.write(arg2 as Record<string, unknown>, endian);
    }
    if (isClassInstance(target)) {
        const endian = arg2 === "little" || arg2 === "big" ? arg2 : "little";
        return getClassStruct(target.constructor as ClassCtor).write(classInstanceToRecord(target), endian);
    }
    throw new Error("c.write() expects a c.struct schema or @c.class() instance");
}

export function sizeof<F extends cImpl.StructFields>(schema: cImpl.Struct<F>): number;
export function sizeof(instance: object): number;
export function sizeof(target: unknown): number {
    if (isStructSchema(target)) {
        return target.getSize();
    }
    if (isClassInstance(target)) {
        return getClassStruct(target.constructor as ClassCtor).getSize();
    }
    if (isClassCtor(target)) {
        return getClassStruct(target).getSize();
    }
    throw new Error("c.sizeof() expects a c.struct schema or @c.class() instance");
}
