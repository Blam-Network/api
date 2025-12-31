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

/**
 * Wide string type for fixed-length wchar_t arrays (UTF-16LE, 2 bytes per character)
 * Takes character count as a generic parameter (not byte count)
 */
export class CWString<L extends number> extends AdvancedType<string> {
    public readonly length!: L;

    constructor(length: L) {
        super();
        this.length = length;
    }

    /**
     * Read a wide string from buffer (UTF-16LE)
     */
    read(buffer: Buffer, offset: number, endian: c.Endian): string {
        const byteLength = this.length * 2;
        const bytes = buffer.subarray(offset, offset + byteLength);
        
        // Find null terminator (two zero bytes) if present
        let nullIndex = -1;
        for (let i = 0; i < bytes.length - 1; i += 2) {
            if (bytes[i] === 0 && bytes[i + 1] === 0) {
                nullIndex = i;
                break;
            }
        }
        
        const lengthToRead = nullIndex === -1 ? byteLength : nullIndex;
        // Convert UTF-16LE bytes to string
        return bytes.subarray(0, lengthToRead).toString('utf16le');
    }

    /**
     * Write a wide string to buffer (UTF-16LE)
     */
    write(buffer: Buffer, offset: number, value: string, endian: c.Endian): void {
        const byteLength = this.length * 2;
        // Convert string to UTF-16LE bytes
        const stringBytes = Buffer.from(value, 'utf16le');
        
        // Trim if too long
        const bytesToWrite = stringBytes.length > byteLength ? stringBytes.subarray(0, byteLength) : stringBytes;
        
        // Write the string bytes
        bytesToWrite.copy(buffer, offset);
        
        // Pad with zeros if necessary
        if (bytesToWrite.length < byteLength) {
            buffer.fill(0, offset + bytesToWrite.length, offset + byteLength);
        }
    }

    getSize(): number {
        return this.length * 2; // Each wchar_t is 2 bytes
    }
}

export class CMagicNumber<N extends number, PT extends PrimitiveType> extends AdvancedType<N> {
    private magic: N;
    private type: PT;

    constructor(magic: N, type: PT) {
        super();
        this.magic = magic;
        this.type = type;
    }
    
    getSize(): number {
        return getPrimitiveTypeSize(this.type);
    }

    read(buffer: Buffer, offset: number, endian: c.Endian): N {
        const value = readPrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset), offset, this.type, endian === 'little');

        if (value !== this.magic) {
            throw new Error(`Magic number mismatch: expected ${this.magic}, got ${value} at offset ${offset}`);
        }

        return this.magic;
    }
    
    write(buffer: Buffer, offset: number, value: N, endian: c.Endian): void {
        writePrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset), offset, this.type, value, endian === 'little');
    }
}

export class CMagicString<S extends string> extends AdvancedType<S> {
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

export class CBitfield<const K extends readonly string[], T extends PrimitiveType> extends AdvancedType<{
    [Key in K[number]]: boolean;
}> {
    private keys: readonly string[];
    private type: T;

    constructor(keys: K, type: T) {
        super();
        this.keys = keys;
        this.type = type;
    }

    getSize(): number {
        return getPrimitiveTypeSize(this.type);
    }

    read(buffer: Buffer, offset: number, endian: c.Endian): {
        [Key in K[number]]: boolean;
    } {
        const value = readPrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset), offset, this.type, endian === 'little');
        const result: any = {};
        for (let i = 0; i < this.keys.length; i++) {
            const key = this.keys[i];
            result[key] = (((value as number) >> i) & 1) === 1;
        }
        return result as {
            [Key in K[number]]: boolean;
        };
    }
    
    write(buffer: Buffer, offset: number, value: {
        [Key in K[number]]: boolean;
    }, endian: c.Endian): void {
        let result = 0;
        for (let i = 0; i < this.keys.length; i++) {
            const key = this.keys[i];
            result |= (value[key as K[number]] ? 1 : 0) << i;
        }
        writePrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset), offset, this.type, result, endian === 'little');
    }
}