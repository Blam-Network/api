import { FieldOptions } from "./field";
import { CDataField, Endian } from "./data-field";
import { getPrimitiveTypeSize, CPrimitive, readPrimitiveValue, writePrimitiveValue } from "./primitive";
import type { c as CTypes } from ".";

export type { Endian };
export { CDataField, isCDataField } from "./data-field";
/** @deprecated Use CDataField */
export { CDataField as AdvancedType };

/**
 * Explicit padding bytes in a struct layout. Omitted from inferred TypeScript types.
 */
export class CPadding<const O extends FieldOptions = {}> extends CDataField<undefined, O> {
    readonly bytes: number;

    constructor(bytes: number, options?: O) {
        super(options);
        this.bytes = bytes;
    }

    getSize(): number {
        return this.bytes;
    }

    read(_buffer: Buffer, _offset: number, _endian: Endian): undefined {
        return undefined;
    }

    write(buffer: Buffer, offset: number, _value: undefined, _endian: Endian): void {
        buffer.fill(0, offset, offset + this.bytes);
    }
}

const PADDING_CACHE = new Map<number, CPadding>();

export function createPadding(bytes: number): CPadding {
    let cached = PADDING_CACHE.get(bytes);
    if (!cached) {
        cached = new CPadding(bytes);
        PADDING_CACHE.set(bytes, cached);
    }
    return cached;
}

export function pad<const O extends FieldOptions = {}>(bytes: number, options?: O): CPadding<O> {
    return new CPadding(bytes, options);
}

export function isCPadding(value: unknown): value is CPadding {
    return value instanceof CPadding;
}

/**
 * String type for fixed-length character arrays
 * Takes length as a generic parameter
 */
export class CString<L extends number, const O extends FieldOptions = {}> extends CDataField<string, O> {
    public readonly length!: L;
    private readonly encoding: BufferEncoding;

    constructor(length: L, encoding: BufferEncoding = 'utf8', options?: O) {
        super(options);
        this.length = length;
        this.encoding = encoding;
    }

    /**
     * Read a string from buffer
     */
    read(buffer: Buffer, offset: number, endian: Endian): string {
        const bytes = buffer.subarray(offset, offset + this.length);
        // Find null terminator if present
        let nullIndex = bytes.indexOf(0);
        if (nullIndex === -1) {
            nullIndex = this.length;
        }
        // Convert bytes to string, trimming null bytes
        return bytes.subarray(0, nullIndex).toString(this.encoding);
    }

    /**
     * Write a string to buffer
     */
    write(buffer: Buffer, offset: number, value: string, endian: Endian): void {
        // Convert string to bytes
        const stringBytes = Buffer.from(value, this.encoding);
        
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
 * Wide string type for fixed-length wchar_t arrays (UTF-16, 2 bytes per character)
 * Takes character count as a generic parameter (not byte count)
 */
export class CWString<L extends number, const O extends FieldOptions = {}> extends CDataField<string, O> {
    public readonly length!: L;

    constructor(length: L, options?: O) {
        super(options);
        this.length = length;
    }

    private swapUtf16ByteOrder(bytes: Buffer): Buffer {
        const swapped = Buffer.from(bytes);
        for (let i = 0; i < swapped.length - 1; i += 2) {
            const first = swapped[i];
            swapped[i] = swapped[i + 1];
            swapped[i + 1] = first;
        }
        return swapped;
    }

    /**
     * Read a wide string from buffer (UTF-16LE/UTF-16BE based on endian)
     */
    read(buffer: Buffer, offset: number, endian: Endian): string {
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
        const stringBytes = bytes.subarray(0, lengthToRead);
        const littleEndianBytes = endian === 'little'
            ? stringBytes
            : this.swapUtf16ByteOrder(stringBytes);
        return littleEndianBytes.toString('utf16le');
    }

    /**
     * Write a wide string to buffer (UTF-16LE/UTF-16BE based on endian)
     */
    write(buffer: Buffer, offset: number, value: string, endian: Endian): void {
        const byteLength = this.length * 2;
        // Convert string to UTF-16LE bytes
        const stringBytes = Buffer.from(value, 'utf16le');
        
        // Trim if too long
        const bytesToWrite = stringBytes.length > byteLength ? stringBytes.subarray(0, byteLength) : stringBytes;
        
        const outputBytes = endian === 'little'
            ? bytesToWrite
            : this.swapUtf16ByteOrder(bytesToWrite);
        outputBytes.copy(buffer, offset);
        
        // Pad with zeros if necessary
        if (outputBytes.length < byteLength) {
            buffer.fill(0, offset + outputBytes.length, offset + byteLength);
        }
    }

    getSize(): number {
        return this.length * 2; // Each wchar_t is 2 bytes
    }
}

export class CMagicNumber<N extends number, PT extends CPrimitive, const O extends FieldOptions = {}> extends CDataField<N, O> {
    private magic: N;
    private type: PT;

    constructor(magic: N, type: PT, options?: O) {
        super(options);
        this.magic = magic;
        this.type = type;
    }
    
    getSize(): number {
        return getPrimitiveTypeSize(this.type);
    }

    read(buffer: Buffer, offset: number, endian: Endian): N {
        const value = readPrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength), offset, this.type, endian == 'little');

        if (value !== this.magic) {
            throw new Error(`Magic number mismatch: expected ${this.magic}, got ${value} at offset ${offset}`);
        }

        return this.magic;
    }
    
    write(buffer: Buffer, offset: number, value: N, endian: Endian): void {
        writePrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength), offset, this.type, value, endian == 'little');
    }
}

export class CMagicString<S extends string, const O extends FieldOptions = {}> extends CDataField<S, O> {
    private magic: S;

    constructor(magic: S, options?: O) {
        super(options);
        this.magic = magic;
    }

    getSize(): number {
        return this.magic.length;
    }

    read(buffer: Buffer, offset: number, endian: Endian): S {
        const magic = buffer.subarray(offset, offset + this.magic.length);
        if (magic.toString('utf8') !== this.magic) {
            throw new Error(`Magic string mismatch: expected ${this.magic}, got ${magic.toString('utf8')}`);
        }
        return this.magic;
    }

    write(buffer: Buffer, offset: number, value: S, endian: Endian): void {
        buffer.write(this.magic, offset);
    }
}

export class CBitfield<const K extends readonly string[], T extends CPrimitive, const O extends FieldOptions = {}> extends CDataField<{
    [Key in K[number]]: boolean;
}, O> {
    private keys: readonly string[];
    private type: T;

    constructor(keys: K, type: T, options?: O) {
        super(options);
        this.keys = keys;
        this.type = type;
    }

    getSize(): number {
        return getPrimitiveTypeSize(this.type);
    }

    read(buffer: Buffer, offset: number, endian: Endian): {
        [Key in K[number]]: boolean;
    } {
        const value = readPrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength), offset, this.type, endian === 'little');
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
    }, endian: Endian): void {
        let result = 0;
        for (let i = 0; i < this.keys.length; i++) {
            const key = this.keys[i];
            result |= (value[key as K[number]] ? 1 : 0) << i;
        }
        writePrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength), offset, this.type, result, endian === 'little');
    }
}

type EnumKeys<T> = T extends readonly string[] 
    ? T[number]
    : T extends Record<infer K, number>
    ? K extends string
        ? K
        : keyof T & string
    : never;

/**
 * Enum type for C-style enums where a numeric value represents one of several named options
 * Takes either:
 * - An array of enum key names (for 0-based sequential enums)
 * - An object mapping enum key names to their numeric values (for non-sequential enums)
 * Reads/writes as the numeric value of the enum
 */
export class CEnum<const T extends readonly string[] | Record<string, number>, PT extends CPrimitive, const O extends FieldOptions = {}> extends CDataField<EnumKeys<T>, O> {
    private keys: readonly string[];
    private valueMap: Map<string, number>;
    private keyMap: Map<number, string>;
    private type: PT;

    constructor(keysOrMap: T, type: PT, options?: O) {
        super(options);
        this.type = type;
        
        if (Array.isArray(keysOrMap)) {
            // Sequential enum (0-based)
            this.keys = keysOrMap;
            this.valueMap = new Map();
            this.keyMap = new Map();
            for (let i = 0; i < keysOrMap.length; i++) {
                const key = keysOrMap[i];
                this.valueMap.set(key, i);
                this.keyMap.set(i, key);
            }
        } else {
            // Non-sequential enum with explicit values
            this.keys = Object.keys(keysOrMap) as readonly string[];
            this.valueMap = new Map();
            this.keyMap = new Map();
            for (const [key, value] of Object.entries(keysOrMap)) {
                this.valueMap.set(key, value);
                this.keyMap.set(value, key);
            }
        }
    }

    getSize(): number {
        return getPrimitiveTypeSize(this.type);
    }

    read(buffer: Buffer, offset: number, endian: Endian): EnumKeys<T> {
        const value = readPrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength), offset, this.type, endian === 'little');
        const numericValue = Number(value);
        const key = this.keyMap.get(numericValue);
        if (key !== undefined) {
            return key as EnumKeys<T>;
        }
        throw new Error(`Enum value ${numericValue} is not a valid enum value`);
    }
    
    write(buffer: Buffer, offset: number, value: EnumKeys<T>, endian: Endian): void {
        const mappedValue = this.valueMap.get(value);
        if (mappedValue === undefined) {
            throw new Error(`Invalid enum key: ${value}`);
        }
        writePrimitiveValue(new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength), offset, this.type, mappedValue, endian === 'little');
    }
}

/**
 * Union type for C-style unions where multiple structs share the same memory location
 * Takes an object where keys are member names and values are Struct instances
 * The size is the maximum size of all structs
 * 
 * All structs start at the same offset and share the same memory.
 * You can read/write any struct by its member name.
 */
export class CUnion<S extends Record<string, CTypes.Struct<CTypes.StructSchema>>, const O extends FieldOptions = {}> extends CDataField<{
    [K in keyof S]?: CTypes.infer<S[K]>
}, O> {
    private members: S;
    private memberNames: string[];
    private structs: CTypes.Struct<CTypes.StructSchema>[];
    private maxSize: number;

    constructor(members: S, options?: O) {
        super(options);
        this.members = members;
        this.memberNames = Object.keys(members);
        this.structs = Object.values(members);
        
        // Calculate maximum size of all structs
        this.maxSize = 0;
        for (const struct of this.structs) {
            const structSize = struct.getSize();
            this.maxSize = Math.max(this.maxSize, structSize);
        }
    }

    getSize(): number {
        return this.maxSize;
    }

    /**
     * Read a union value. Returns an object with all members.
     * All members are read from the same offset (they share memory).
     * If any member fails to read, it will be undefined.
     */
    read(buffer: Buffer, offset: number, endian: Endian): {
        [K in keyof S]?: CTypes.infer<S[K]>
    } {
        const result: {
            [K in keyof S]?: CTypes.infer<S[K]>
        } = {};
        for (let i = 0; i < this.memberNames.length; i++) {
            const name = this.memberNames[i];
            const struct = this.structs[i];
            try {
                result[name as keyof S] = struct.read(buffer, offset, endian) as CTypes.infer<S[keyof S]>;
            } catch {
                // If member fails to read, keep it undefined
                result[name as keyof S] = undefined;
            }
        }
        return result;
    }

    /**
     * Write a union value. The value should be an object with member names as keys.
     * All members are written to the same offset (they share memory).
     * If multiple members are provided, the last one wins (they overwrite each other).
     */
    write(buffer: Buffer, offset: number, value: {
        [K in keyof S]?: CTypes.infer<S[K]>
    }, endian: Endian): void {
        // Write the first provided member
        for (const name of this.memberNames) {
            if (value[name] !== undefined) {
                const struct = this.members[name];
                const structBuffer = struct.write(value[name] as Record<string, any>, endian);
                structBuffer.copy(buffer, offset);
                return; // Only write one member since they all share memory
            }
        }
        // If no member was provided, throw an error
        throw new Error('No union member provided for write operation');
    }

    /**
     * Read a specific union member by name
     */
    readMember<K extends keyof S>(buffer: Buffer, offset: number, memberName: K, endian: Endian): CTypes.infer<S[K]> {
        const struct = this.members[memberName];
        if (!struct) {
            throw new Error(`Union member '${String(memberName)}' not found`);
        }
        return struct.read(buffer, offset, endian) as CTypes.infer<S[K]>;
    }

    /**
     * Write a specific union member by name
     */
    writeMember<K extends keyof S>(buffer: Buffer, offset: number, memberName: K, value: CTypes.infer<S[K]>, endian: Endian): void {
        const struct = this.members[memberName];
        if (!struct) {
            throw new Error(`Union member '${String(memberName)}' not found`);
        }
        const structBuffer = struct.write(value as Record<string, any>, endian);
        structBuffer.copy(buffer, offset);
    }
}