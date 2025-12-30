import { c } from ".";
import { getPrimitiveTypeSize, PrimitiveType, readPrimitiveValue, writePrimitiveValue } from "./primitive";

export abstract class AdvancedType<T> {
    abstract getSize(): number;
    abstract read(buffer: Buffer, offset: number, endian: c.Endian): T;
    abstract write(buffer: Buffer, offset: number, value: T, endian: c.Endian): void;
}

/**
 * String type for fixed-length character arrays
 * Takes length as a generic parameter
 */
export class CString<L extends number> extends AdvancedType<string> {
    public readonly length!: L;

    constructor(length: L) {
        super();
        this.length = length;
    }

    /**
     * Read a string from buffer
     */
    read(buffer: Buffer, offset: number, endian: c.Endian): string {
        const bytes = buffer.subarray(offset, offset + this.length);
        // Find null terminator if present
        let nullIndex = bytes.indexOf(0);
        if (nullIndex === -1) {
            nullIndex = this.length;
        }
        // Convert bytes to string, trimming null bytes
        return bytes.subarray(0, nullIndex).toString('utf8');
    }

    /**
     * Write a string to buffer
     */
    write(buffer: Buffer, offset: number, value: string, endian: c.Endian): void {
        // Convert string to bytes
        const stringBytes = Buffer.from(value, 'utf8');
        
        // Trim if too long
        const bytesToWrite = stringBytes.length > this.length ? stringBytes.subarray(0, this.length) : stringBytes;
        
        // Write the string bytes
        bytesToWrite.copy(buffer, offset);
        
        // Pad with zeros if necessary
        if (bytesToWrite.length < this.length) {
            buffer.fill(0, offset + bytesToWrite.length, offset + this.length);
        }
    }

    getSize(): number {
        return this.length;
    }
}

export class MagicNumber<N extends number, PT extends PrimitiveType> extends AdvancedType<N> {
    private magic: N;
    private type: PT;

    constructor(magic: N, type: PT) {
        super();
        this.magic = magic;
    }
    
    getSize(): number {
        return getPrimitiveTypeSize(this.type);
    }

    read(buffer: Buffer, offset: number, endian: c.Endian): N {
        const value = readPrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset + offset), offset, this.type, endian === 'little');

        if (value !== this.magic) {
            throw new Error(`Magic number mismatch: expected ${this.magic}, got ${value}`);
        }

        return this.magic;
    }
    
    write(buffer: Buffer, offset: number, value: N, endian: c.Endian): void {
        writePrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset + offset), offset, this.type, value, endian === 'little');
    }
}

export class MagicString<S extends string> extends AdvancedType<S> {
    private magic: S;

    constructor(magic: S) {
        super();
        this.magic = magic;
    }

    getSize(): number {
        return this.magic.length;
    }

    read(buffer: Buffer, offset: number, endian: c.Endian): S {
        const magic = buffer.subarray(offset, offset + this.magic.length);
        if (magic.toString('utf8') !== this.magic) {
            throw new Error(`Magic string mismatch: expected ${this.magic}, got ${magic.toString('utf8')}`);
        }
        return this.magic;
    }

    write(buffer: Buffer, offset: number, value: S, endian: c.Endian): void {
        buffer.write(this.magic, offset);
    }
}