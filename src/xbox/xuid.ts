import { z } from "zod"

export const parseXuid = (xuid: string): BigInt => {
    return z.coerce.bigint().parse(`0x${xuid}`)
}

export const hexStringXuidSchema = z.string()
    .refine((val) => val.length === 16, {
        message: "Provided hex-string XUID was not 16 characters long.",
    })
    .refine((val) => /^[0-9a-fA-F]{16}$/.test(val), {
        message: "Provided hex-string XUID contains invalid characters.",
    })
    .transform((val) => BigInt(`0x${val}`));

export const xuidToHexString = (xuid: BigInt) => {
  return xuid.toString(16).padStart(16, '0');
}