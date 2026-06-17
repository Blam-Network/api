import { c } from "./index";

@c.class()
class Header {
    @c.field(c.u16())
    magic!: number;

    @c.field(c.u32(), { padBefore: 2 })
    length!: number;
}

@c.class()
class Point {
    @c.field(c.i16())
    x!: number;

    @c.field(c.i16())
    y!: number;
}

@c.class()
class Shape {
    @c.field(Point)
    origin!: Point;

    @c.field(c.array(c.u8(), 4))
    rgba!: number[];
}

const Outer = c.struct({
    header: c.class(Header),
    shape: c.class(Shape),
});

describe("c.class decorators", () => {
    it("reads and writes a decorated class", () => {
        const data = { magic: 0xbeef, length: 42 };
        const buffer = c.writeClass(Header, data);
        expect(buffer.length).toBe(c.sizeofClass(Header));
        expect(c.readClass(Header, buffer)).toEqual(data);
    });

    it("supports nested decorated classes", () => {
        const data = { origin: { x: 10, y: -3 }, rgba: [255, 128, 0, 255] };
        const buffer = c.writeClass(Shape, data);
        expect(c.readClass(Shape, buffer)).toEqual(data);
    });

    it("embeds decorated classes in c.struct via c.class()", () => {
        const data = {
            header: { magic: 0x1234, length: 99 },
            shape: { origin: { x: 1, y: 2 }, rgba: [0, 0, 0, 0] },
        };
        const buffer = Outer.write(data);
        expect(Outer.read(buffer)).toEqual(data);
    });

    it("supports field padding options", () => {
        expect(c.sizeofClass(Header)).toBe(8);
    });
});
