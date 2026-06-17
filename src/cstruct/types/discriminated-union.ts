import { FieldOptions, StructFieldType } from "../field";
import { Endian } from "../field-type";
import type { cImpl as CTypes } from "../impl";

export type UnionWhen = (parent: Record<string, unknown>) => boolean;

export type UnionArmInput<S extends StructFieldType = StructFieldType> = readonly [S, UnionWhen];

export type UnionArmSchema<A extends UnionArmInput> =
    A extends readonly [infer S, UnionWhen]
        ? S extends CTypes.Struct<infer F>
            ? CTypes.StructSchemaToTS<F>
            : never
        : never;

export type UnionOfArms<Arms extends readonly UnionArmInput[]> = UnionArmSchema<Arms[number]>;

export function arm<S extends StructFieldType>(struct: S, when: UnionWhen): UnionArmInput<S> {
    return [struct, when];
}

export function when<S extends StructFieldType, const V extends number | string>(
    value: V,
    struct: S,
    discriminant: (parent: Record<string, unknown>) => number | string,
): UnionArmInput<S> {
    return [struct, (parent) => discriminant(parent) === value];
}

function parseArms(arms: readonly UnionArmInput[]): {
    structs: StructFieldType[];
    whens: UnionWhen[];
} {
    if (arms.length === 0) {
        throw new Error("discriminatedUnion requires at least one arm");
    }

    const structs: StructFieldType[] = [];
    const whens: UnionWhen[] = [];

    for (const input of arms) {
        if (!Array.isArray(input) || input.length !== 2 || typeof input[1] !== "function") {
            throw new Error("Union arm requires c.arm(Struct, (parent) => ...) or c.when(value, Struct, (parent) => ...)");
        }
        structs.push(input[0]);
        whens.push(input[1]);
    }

    return { structs, whens };
}

function buildSelect(whens: UnionWhen[]): (parent: Record<string, unknown>) => number | null {
    return (parent) => {
        const index = whens.findIndex((when) => when(parent));
        return index >= 0 ? index : null;
    };
}

/** Discriminated union slot: one active arm selected from parent fields, or null. */
export class CDiscriminatedUnion<
    const Arms extends readonly UnionArmInput[] = readonly UnionArmInput[],
    const O extends FieldOptions = {},
> {
    readonly __cdiscriminatedUnion = true as const;
    readonly arms: Arms;
    readonly inactiveSize: number;
    readonly size: number;
    readonly options: O;
    private readonly armStructs: StructFieldType[];
    private readonly select: (parent: Record<string, unknown>) => number | null;

    constructor(options: { size: number }, arms: Arms, fieldOptions?: O) {
        const { structs, whens } = parseArms(arms);
        this.arms = arms;
        this.armStructs = structs;
        this.select = buildSelect(whens);
        this.inactiveSize = options.size;
        this.options = (fieldOptions ?? {}) as O;

        let maxSize = options.size;
        for (const struct of structs) {
            maxSize = Math.max(maxSize, struct.getSize());
        }
        this.size = maxSize;

        for (const struct of structs) {
            if (struct.getSize() > this.size) {
                throw new Error(
                    `discriminatedUnion arm size ${struct.getSize()} exceeds union slot size ${this.size}`,
                );
            }
        }
    }

    getSize(): number {
        return this.size;
    }

    read(buffer: Buffer, offset: number, endian: Endian, parent: Record<string, unknown>): UnionOfArms<Arms> | null {
        const index = this.select(parent);
        if (index === null) {
            return null;
        }
        return this.armStructs[index].read(buffer, offset, endian) as UnionOfArms<Arms>;
    }

    write(
        buffer: Buffer,
        offset: number,
        value: UnionOfArms<Arms> | null | undefined,
        endian: Endian,
        parent: Record<string, unknown>,
    ): void {
        if (value === null || value === undefined) {
            buffer.fill(0, offset, offset + this.size);
            return;
        }

        const index = this.select(parent);
        if (index === null) {
            throw new Error("discriminatedUnion: no arm matches parent discriminant for write");
        }

        const armBuffer = this.armStructs[index].write(value as Record<string, unknown>, endian);
        armBuffer.copy(buffer, offset);
        if (armBuffer.length < this.size) {
            buffer.fill(0, offset + armBuffer.length, offset + this.size);
        }
    }
}

export function discriminatedUnion<const Arms extends readonly UnionArmInput[]>(
    options: { size: number },
    ...arms: Arms
): CDiscriminatedUnion<Arms> {
    return new CDiscriminatedUnion(options, arms);
}

export function isCDiscriminatedUnion(value: unknown): value is CDiscriminatedUnion {
    return (
        typeof value === "object" &&
        value !== null &&
        "__cdiscriminatedUnion" in value &&
        (value as CDiscriminatedUnion).__cdiscriminatedUnion === true
    );
}
