import { c } from "../cstruct";
import { blf } from ".";

const BlfChunkStartOfFileSchema = blf.createChunkSchema({
    name: '_blf',
    majorVersion: 1,
    minorVersion: 2,
    endian: 'big',
    fields: [
        { name: 'bom', type: new c.MagicNumber(0xFFFE, 'u16') },
        { name: 'fileName', type: new c.String(32) },
        { name: 'padding', type: 'padding', count: 2 },
    ]
});

const BlfChunkAuthorSchema = blf.createChunkSchema({
    name: 'athr',
    majorVersion: 3,
    minorVersion: 1,
    endian: 'big',
    fields: [
        { name: 'programName', type: new c.String(16) },
        { name: 'buildNumberSequence', type: 'u32' },
        { name: 'buildNumber', type: 'u32' },
        { name: 'buildString', type: new c.String(28) },
        { name: 'authorName', type: new c.String(16) },
    ]
});

const BlfFileSchema = blf.createFileSchema([BlfChunkStartOfFileSchema, BlfChunkAuthorSchema]);

type s_blf_file = blf.infer<typeof BlfFileSchema>;

test('read BlfChunkAuthor', () => {
    const hexDump = '617468720000005000030001626C665F6C69622076312E31352E37000000000100002F2631323037302E30382E30392E30352E323033312E68616C6F335F736800000000000000000000000000000000';
    const buffer = Buffer.from(hexDump, 'hex');
    const unpacked = BlfChunkAuthorSchema.read(buffer);
    expect(unpacked.programName).toEqual('blf_lib v1.15.7');
    expect(unpacked.buildNumberSequence).toEqual(1);
    expect(unpacked.buildNumber).toEqual(12070);
    expect(unpacked.buildString).toEqual('12070.08.09.05.2031.halo3_sh');
    expect(unpacked.authorName).toEqual('');
});

test('read blf file', () => {
    const hexDump = '5F626C660000003000010002FFFE68616C6F332075736572000000000000000000000000000000000000000000000000617468720000005000030001626C665F6C69622076312E31352E37000000000100002F2631323037302E30382E30392E30352E323033312E68616C6F335F736800000000000000000000000000000000';
    const buffer = Buffer.from(hexDump, 'hex');
    const unpacked = BlfFileSchema.read(buffer);
    expect(unpacked._blf.fileName).toEqual('halo3 user');
    expect(unpacked.athr.programName).toEqual('blf_lib v1.15.7');
    expect(unpacked.athr.buildNumberSequence).toEqual(1);
    expect(unpacked.athr.buildNumber).toEqual(12070);
    expect(unpacked.athr.buildString).toEqual('12070.08.09.05.2031.halo3_sh');
    expect(unpacked.athr.authorName).toEqual('');
});

test('write blf file', () => {
    const packed = BlfFileSchema.write({
        _blf: {
            bom: 0xFFFE,
            fileName: 'halo3 user',
        },
        athr: {
            programName: 'blf_lib v1.15.7',
            buildNumberSequence: 1,
            buildNumber: 12070,
            buildString: '12070.08.09.05.2031.halo3_sh',
            authorName: '',
        },
    });
    expect(packed.toString('hex').toUpperCase()).toEqual('5F626C660000003000010002FFFE68616C6F332075736572000000000000000000000000000000000000000000000000617468720000005000030001626C665F6C69622076312E31352E37000000000100002F2631323037302E30382E30392E30352E323033312E68616C6F335F736800000000000000000000000000000000');
});