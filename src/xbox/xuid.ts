import { unsigned_to_signed } from "src/lsp/datatypes";
import { z, ZodError } from "zod"

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
    .transform((val) => unsigned_to_signed(BigInt(`0x${val}`), 64));

export const xuidToHexString = (xuid: bigint) => {
  if (xuid & (1n << 63n)) {
    return xuid - (1n << 64n);
  }

  // hex string padded to 16 hex digits
  return xuid.toString(16).padStart(16, '0');
}