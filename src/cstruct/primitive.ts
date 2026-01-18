export type PrimitiveType = 'u8' | 'u16' | 'u32' | 'u64' | 'i8' | 'i16' | 'i32' | 'i64' | 'f32' | 'f64';

export type PrimitiveTypeToTS<T extends PrimitiveType> = T extends 'u64' | 'i64' ? bigint : number;

const PRIMITIVE_TYPE_SIZES: Record<PrimitiveType, number> = {
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

export function getPrimitiveTypeSize(type: PrimitiveType): number {
    return PRIMITIVE_TYPE_SIZES[type];
}

/**
 * Read a value from DataView based on type
 */
export function readPrimitiveValue(view: DataView, offset: number, type: PrimitiveType, littleEndian: boolean = true): number | bigint {
    switch (type) {
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
            throw new Error(`Unsupported type: ${type}`);
    }
}

/**
 * Write a value to DataView based on type
 */
export function writePrimitiveValue(
    view: DataView,
    offset: number,
    type: PrimitiveType,
    value: number | bigint,
    littleEndian: boolean = true,
): void {
    switch (type) {
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
            throw new Error(`Unsupported type: ${type}`);
    }
}