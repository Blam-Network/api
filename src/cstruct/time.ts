import { c } from ".";
import { AdvancedType } from "./advanced";

/**
 * 64-bit C time_t equivalent (seconds since Unix epoch).
 * Encodes/decodes as signed i64 and maps to JavaScript Date.
 */
export class time64_t extends AdvancedType<Date> {
    getSize(): number {
        return 8;
    }

    read(buffer: Buffer, offset: number, endian: c.Endian): Date {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const seconds = view.getBigInt64(offset, endian === "little");
        return new Date(Number(seconds) * 1000);
    }

    write(buffer: Buffer, offset: number, value: Date, endian: c.Endian): void {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const seconds = BigInt(Math.trunc(value.getTime() / 1000));
        view.setBigInt64(offset, seconds, endian === "little");
    }
}
