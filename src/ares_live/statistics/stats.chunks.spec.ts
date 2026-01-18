import { SBlfFileStatsQuerySchema } from './stats.chunks';

describe('Stats Query BLF Parsing', () => {
    test('should parse real stats query BLF file from logs', () => {
        // Hex dump from actual request (837 bytes)
        // Contains: _blf chunk (48) + athr chunk (80) + xsqq chunk (692) + _eof chunk (17)
        const hexDump = '5f626c660000003000010002feff737461747320717565727900000000000000000000000000000000000000000000006174687200000050000300010000000000000000000000000000000075000000ffffffff756e747261636b65642076657273696f6e00000000000000000000007836400000000000000000000000000078737171000002b4000100000100000099ec86dee0515d580000000000150f1dbff77f00008253b0b6dc2b00008d22b8bef77f0000000000000000000038d371b66901000030e0aa6cfe7f0000ffffffffffffffff70f66f9b4500000084552a6ffe7f0000c08915ed50020000a7a5a2bff77f000000000000000000002912a1bff77f000018cb71b669010000ffffff02000000010000000b0000000400050006000800070009000b000a000c000d000e000000000100000000000000000000000000000090f66f9b45000000540f016ffe7f0000b0f66f9b45000000f050326ffe7f00000000000001000000681800000000000010080000000000001434806bfd7f0000f0f66f9b45000000fc00ef70fe7f0000f0f66f9b4500000200000002000000020003009b45000000540f016ffe7f00000000000000000000000000000000000000000000000000000000000000000000f0f86f9b45000000443b806bfd7f000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000cd5bf6bef77f00000000000000000000000000000000000000000000000000000000000000000000e7f86f9b45000000bb051dbff77f0000000000000000000000000000000000006915530600000000b73617ed50020000000000000000000088527fd8f77f000090527fd801000000f3071dbff77f0000001d6fb669010000a082c5bef77f00000000000000000000fc5dc5bef77f000088527fd8f77f000088527fd8f77f0000180000001800000018071dbff77f0000000000000000000023824abff77f000000000000000000000000000000000000d254b0b618000000077931bff77f000068f979b669010000d35cc5bef77f005f656f6600000011000100010000033400';
        
        const buffer = Buffer.from(hexDump, 'hex');
        expect(buffer.length).toBe(837);
        
        // Debug: Check chunk boundaries
        let offset = 0;
        const chunk1Size = buffer.readUInt32BE(offset + 4);
        offset += chunk1Size;
        const chunk2Size = buffer.readUInt32BE(offset + 4);
        offset += chunk2Size;
        const chunk3Size = buffer.readUInt32BE(offset + 4);
        console.log('Chunk sizes:', chunk1Size, chunk2Size, chunk3Size);
        console.log('Chunk 3 (xsqq) starts at:', offset, 'length:', chunk3Size);
        console.log('Remaining buffer from chunk 3 start:', buffer.length - offset);
        
        // Parse the BLF file
        const fileData = SBlfFileStatsQuerySchema.read(buffer);
        
        // Verify chunks are present
        expect(fileData._blf).toBeDefined();
        expect(fileData.athr).toBeDefined();
        expect(fileData.xsqq).toBeDefined();
        expect(fileData._eof).toBeDefined();
        
        // Verify _blf chunk
        expect(fileData._blf.fileName).toBe('stats query');
        expect(fileData._blf.bom).toBe(0xFEFF);
        
        // Verify athr chunk
        expect(fileData.athr.programName).toBeDefined();
        expect(fileData.athr.buildNumberSequence).toBeDefined();
        expect(fileData.athr.buildNumber).toBeDefined();
        expect(fileData.athr.buildString).toBeDefined();
        expect(fileData.athr.authorName).toBeDefined();
        
        // Verify xsqq chunk structure
        expect(fileData.xsqq.xuidCount).toBeDefined();
        expect(fileData.xsqq.xuids).toBeDefined();
        expect(Array.isArray(fileData.xsqq.xuids)).toBe(true);
        expect(fileData.xsqq.xuids.length).toBe(16);
        expect(fileData.xsqq.specCount).toBeDefined();
        expect(fileData.xsqq.specs).toBeDefined();
        expect(Array.isArray(fileData.xsqq.specs)).toBe(true);
        expect(fileData.xsqq.specs.length).toBe(4);
        
        // Verify specs structure
        for (const spec of fileData.xsqq.specs) {
            expect(spec.viewId).toBeDefined();
            expect(spec.numColumnIds).toBeDefined();
            expect(spec.columnIds).toBeDefined();
            expect(Array.isArray(spec.columnIds)).toBe(true);
            expect(spec.columnIds.length).toBe(64);
        }
    });
});
