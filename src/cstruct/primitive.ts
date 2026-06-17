import { FieldOptions } from "./field";
import { CDataField, Endian } from "./data-field";

export type PrimitiveKind = 'u8' | 'u16' | 'u32' | 'u64' | 'i8' | 'i16' | 'i32' | 'i64' | 'f32' | 'f64';

export type PrimitiveTypeToTS<K extends PrimitiveKind> = K extends 'u64' | 'i64' ? bigint : number;

const PRIMITIVE_TYPE_SIZES: Record<PrimitiveKind, number> = {
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

export class CPrimitive<K extends PrimitiveKind = PrimitiveKind, const O extends FieldOptions = {}>
    extends CDataField<PrimitiveTypeToTS<K>, O>
{
    readonly kind: K;

    constructor(kind: K, options?: O) {
        super(options);
        this.kind = kind;
    }

    getSize(): number {
        return PRIMITIVE_TYPE_SIZES[this.kind];
    }

    read(buffer: Buffer, offset: number, endian: Endian): PrimitiveTypeToTS<K> {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        return readPrimitiveValue(view, offset, this, endian === 'little') as PrimitiveTypeToTS<K>;
    }

    write(buffer: Buffer, offset: number, value: PrimitiveTypeToTS<K>, endian: Endian): void {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        writePrimitiveValue(view, offset, this, value as number | bigint, endian === 'little');
    }
}

export const u8 = <const O extends FieldOptions = {}>(options?: O) => new CPrimitive('u8', options);
export const u16 = <const O extends FieldOptions = {}>(options?: O) => new CPrimitive('u16', options);
export const u32 = <const O extends FieldOptions = {}>(options?: O) => new CPrimitive('u32', options);
export const u64 = <const O extends FieldOptions = {}>(options?: O) => new CPrimitive('u64', options);
export const i8 = <const O extends FieldOptions = {}>(options?: O) => new CPrimitive('i8', options);
export const i16 = <const O extends FieldOptions = {}>(options?: O) => new CPrimitive('i16', options);
export const i32 = <const O extends FieldOptions = {}>(options?: O) => new CPrimitive('i32', options);
export const i64 = <const O extends FieldOptions = {}>(options?: O) => new CPrimitive('i64', options);
export const f32 = <const O extends FieldOptions = {}>(options?: O) => new CPrimitive('f32', options);
export const f64 = <const O extends FieldOptions = {}>(options?: O) => new CPrimitive('f64', options);

export function isCPrimitive(value: unknown): value is CPrimitive {
    return value instanceof CPrimitive;
}

export function getPrimitiveTypeSize(type: CPrimitive): number {
    return type.getSize();
}

export function readPrimitiveValue(
    view: DataView,
    offset: number,
    type: CPrimitive,
    littleEndian: boolean = true,
): number | bigint {
    switch (type.kind) {
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
            throw new Error(`Unsupported primitive: ${type.kind}`);
    }
}

export function writePrimitiveValue(
    view: DataView,
    offset: number,
    type: CPrimitive,
    value: number | bigint,
    littleEndian: boolean = true,
): void {
    switch (type.kind) {
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
            throw new Error(`Unsupported primitive: ${type.kind}`);
    }
}
