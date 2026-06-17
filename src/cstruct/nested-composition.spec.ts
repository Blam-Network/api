import { c } from "./index";

// --- struct containing class ---

@c.class()
class ChunkHeader {
    @c.field(c.MagicNumber(0xbeef, c.u16()))
    magic!: number;

    @c.field(c.u32())
    size!: number;
}

const BlfChunkSchema = c.struct({
    header: c.class(ChunkHeader),
    payload: c.array(c.u8(), 4),
});

// --- class containing struct ---

const Vec3Schema = c.struct({
    x: c.f32(),
    y: c.f32(),
    z: c.f32(),
});

@c.class()
class Entity {
    @c.field(c.u32())
    id!: number;

    @c.field(Vec3Schema)
    position!: c.infer<typeof Vec3Schema>;
}

// struct -> class -> struct (Entity embeds Vec3Schema)
const WorldSchema = c.struct({
    chunk: c.class(ChunkHeader),
    player: c.class(Entity),
});

describe("struct/class composition", () => {
    describe("struct containing class", () => {
        it("round-trips a decorated class embedded via c.class()", () => {
            const data = {
                header: { magic: 0xbeef, size: 128 },
                payload: [1, 2, 3, 4],
            };

            const buffer = BlfChunkSchema.write(data);
            expect(BlfChunkSchema.read(buffer)).toEqual(data);
            expect(buffer.length).toBe(BlfChunkSchema.getSize());
        });
    });

    describe("class containing struct", () => {
        it("infers nested struct field types from the schema", () => {
            type Position = c.infer<typeof Vec3Schema>;
            const _typeCheck: Position = { x: 0, y: 0, z: 0 };
            expect(_typeCheck).toEqual({ x: 0, y: 0, z: 0 });

            type Id = c.infer<ReturnType<typeof c.u32>>;
            const _idCheck: Id = 1;
            expect(_idCheck).toBe(1);

            const rgbaField = c.array(c.u8(), 4);
            type Rgba = c.infer<typeof rgbaField>;
            const _rgbaCheck: Rgba = [0, 0, 0, 255];
            expect(_rgbaCheck).toEqual([0, 0, 0, 255]);
        });

        it("round-trips a nested c.struct via @c.field(Struct)", () => {
            const data = {
                id: 42,
                position: { x: 1.5, y: -2.25, z: 0 },
            };

            const buffer = c.writeClass(Entity, data);
            expect(c.readClass(Entity, buffer)).toEqual(data);
            expect(c.sizeofClass(Entity)).toBe(16);
        });
    });

    describe("struct containing class containing struct", () => {
        it("round-trips when a struct embeds a class that embeds another struct", () => {
            const data = {
                chunk: { magic: 0xbeef, size: 128 },
                player: { id: 7, position: { x: 1, y: 2, z: 3 } },
            };

            const buffer = WorldSchema.write(data);
            expect(WorldSchema.read(buffer)).toEqual(data);
            expect(buffer.length).toBe(WorldSchema.getSize());
        });
    });
});
