export const i32_to_u32 = (value: number) => {
    if (value < 0)
        return (-value) | 0x7FFFFFFF;
    return value;
}

export const clamp_to_byte = (value: number) => value & 0xFF;