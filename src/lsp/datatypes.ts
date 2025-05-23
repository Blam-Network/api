export const i32_to_u32 = (value: number) => {
    if (value < 0)
        return (-value) | 0x7FFFFFFF;
    return value;
}

export const clamp_to_byte = (value: number) => value & 0xFF;

export const unsigned_to_signed = (value: BigInt | number, bits: number) => {
    if (typeof value === 'number')
        value = BigInt(value);

    const mask = BigInt(1 << (bits - 1));

    const sign = value.valueOf() & mask;
    value = value.valueOf() & ~mask;
    if (sign)
        value = -value;
    return value;
}