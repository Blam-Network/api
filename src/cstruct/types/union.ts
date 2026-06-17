import { FieldOptions } from "../field";
import { CFieldType, Endian } from "../field-type";
import type { cImpl as CTypes } from "../impl";

/** C-style union where multiple structs share the same memory location. */
export class CUnion<S extends Record<string, CTypes.Struct<CTypes.StructFields>>, const O extends FieldOptions = {}> extends CFieldType<{
    [K in keyof S]?: CTypes.infer<S[K]>;
}, O> {
    private members: S;
    private memberNames: string[];
    private structs: CTypes.Struct<CTypes.StructFields>[];
    private maxSize: number;

    constructor(members: S, options?: O) {
        super(options);
        this.members = members;
        this.memberNames = Object.keys(members);
        this.structs = Object.values(members);

        this.maxSize = 0;
        for (const struct of this.structs) {
            this.maxSize = Math.max(this.maxSize, struct.getSize());
        }
    }

    getSize(): number {
        return this.maxSize;
    }

    read(buffer: Buffer, offset: number, endian: Endian): {
        [K in keyof S]?: CTypes.infer<S[K]>;
    } {
        const result: { [K in keyof S]?: CTypes.infer<S[K]> } = {};
        for (let i = 0; i < this.memberNames.length; i++) {
            const name = this.memberNames[i];
            const struct = this.structs[i];
            try {
                result[name as keyof S] = struct.read(buffer, offset, endian) as CTypes.infer<S[keyof S]>;
            } catch {
                result[name as keyof S] = undefined;
            }
        }
        return result;
    }

    write(
        buffer: Buffer,
        offset: number,
        value: { [K in keyof S]?: CTypes.infer<S[K]> },
        endian: Endian,
    ): void {
        for (const name of this.memberNames) {
            if (value[name] !== undefined) {
                const struct = this.members[name];
                const structBuffer = struct.write(value[name] as Record<string, unknown>, endian);
                structBuffer.copy(buffer, offset);
                return;
            }
        }
        throw new Error("No union member provided for write operation");
    }

    readMember<K extends keyof S>(buffer: Buffer, offset: number, memberName: K, endian: Endian): CTypes.infer<S[K]> {
        const struct = this.members[memberName];
        if (!struct) {
            throw new Error(`Union member '${String(memberName)}' not found`);
        }
        return struct.read(buffer, offset, endian) as CTypes.infer<S[K]>;
    }

    writeMember<K extends keyof S>(
        buffer: Buffer,
        offset: number,
        memberName: K,
        value: CTypes.infer<S[K]>,
        endian: Endian,
    ): void {
        const struct = this.members[memberName];
        if (!struct) {
            throw new Error(`Union member '${String(memberName)}' not found`);
        }
        const structBuffer = struct.write(value as Record<string, unknown>, endian);
        structBuffer.copy(buffer, offset);
    }
}
