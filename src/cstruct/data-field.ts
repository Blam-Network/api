import type { FieldOptions } from "./field";

export type Endian = 'little' | 'big';

export abstract class CDataField<T, const O extends FieldOptions = {}> {
    readonly options: O;

    constructor(options?: O) {
        this.options = (options ?? {}) as O;
    }

    abstract getSize(): number;
    abstract read(buffer: Buffer, offset: number, endian: Endian): T;
    abstract write(buffer: Buffer, offset: number, value: T, endian: Endian): void;
}

export function isCDataField(value: unknown): value is CDataField<any, any> {
    return value instanceof CDataField;
}
