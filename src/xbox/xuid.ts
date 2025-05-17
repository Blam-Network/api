import { z } from "zod"

export const parseXuid = (xuid: string): number => {
    return z.coerce.number().parse(`0x${xuid}`)
}