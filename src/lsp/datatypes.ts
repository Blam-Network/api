export const i32_to_u32 = (value: number) => {
    if (value < 0)
        return (-value) | 0x80000000;
    return value;
}