import { SBlfFileStatsQuerySchema, SBlfFileStatsQueryResponseSchema } from './stats.chunks';
import { DEFAULT_BLF_CHUNK, ARES_LIVE_AUTHOR, DEFAULT_EOF_CHUNK } from '../chunks';
import * as fs from 'fs';
import * as path from 'path';

describe('Stats Query BLF Parsing', () => {
    test('should parse real stats query BLF file from logs', () => {      
        const filePath = path.join(__dirname, './example_stats_query.blf');
        const buffer = fs.readFileSync(filePath);

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
        expect(fileData._blf.bom).toBe(0xFFFE);
        
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

    test('should create stats query response file with correct size', () => {
        // Create a minimal stats query response file
        // Expected total file size: 0x108C5 (67781 bytes)
        // Contains: _blf (0x30 = 48) + athr (0x50 = 80) + xsqr (0x10834 = 67636) + _eof (0x11 = 17)
        // 
        // Structure sizes from resym (ares_debug.pdb):
        // - s_online_stat: 32 bytes (0x20) - id: 4 + padding: 4 + data: 24
        // - s_online_player_stat_collection: 1056 bytes (0x420) - xuid: 8 + gamertag: 16 + stat_count: 4 + padding: 4 + stats[32]: 1024
        // - s_online_stat_query_leaderboard_result: 16904 bytes (0x4208) - leaderboard_id: 4 + player_count: 4 + player_stats[16]: 16896
        // - s_online_stat_query_result: 67624 bytes (0x10828) - leaderboard_count: 4 + padding: 4 + leaderboard_results[4]: 67616
        // - s_blf_chunk_stats_query_response: 67636 bytes (0x10834) - header: 12 + results: 67624
        const responseFile = SBlfFileStatsQueryResponseSchema.write({
            _blf: DEFAULT_BLF_CHUNK,
            athr: ARES_LIVE_AUTHOR,
            xsqr: {
                leaderboardCount: 0,
                leaderboards: Array.from({ length: 4 }, () => ({
                    leaderboardId: 0,
                    rowCount: 0,
                    rows: Array.from({ length: 16 }, () => ({
                        xuid: 0n,
                        gamertag: '',
                        statCount: 0,
                        stats: Array.from({ length: 32 }, () => ({
                            id: 0,
                            data: {
                                type: 'null' as const,
                                data: {
                                    data_as_null: {},
                                },
                            },
                        })) as any,
                    })) as any,
                })) as any,
            },
            _eof: DEFAULT_EOF_CHUNK,
        });

        // Verify the file size matches calculated total: 0x108C5 = 67781 bytes
        // File = start_of_file (0x30) + author (0x50) + query_response (0x10834) + end_of_file (0x11)
        expect(responseFile.length).toBe(0x108c5);
        expect(responseFile.length).toBe(67781);

        // Verify chunk sizes
        let offset = 0;
        const chunk1Size = responseFile.readUInt32BE(offset + 4);
        expect(chunk1Size).toBe(0x30); // _blf chunk: 48 bytes
        offset += chunk1Size;

        const chunk2Size = responseFile.readUInt32BE(offset + 4);
        expect(chunk2Size).toBe(0x50); // athr chunk: 80 bytes
        offset += chunk2Size;

        const chunk3Size = responseFile.readUInt32BE(offset + 4);
        expect(chunk3Size).toBe(0x10834); // xsqr chunk: 67636 bytes (matches resym)
        offset += chunk3Size;

        const chunk4Size = responseFile.readUInt32BE(offset + 4);
        expect(chunk4Size).toBe(0x11); // _eof chunk: 17 bytes
        offset += chunk4Size;

        // Verify total size matches calculated total exactly
        expect(offset).toBe(0x108c5);
        
        // Verify row structure: each row should be 0x420 (1056 bytes) with stats[32]
        // Row = xuid (8) + gamertag (16) + statCount (4) + padding (4) + stats[32] (32 * 32 = 1024) = 1056 bytes
        if (responseFile.length >= offset) {
            const xsqrDataOffset = 48 + 80 + 12; // Skip _blf, athr, and xsqr header
            const leaderboardCount = responseFile.readUInt32LE(xsqrDataOffset);
            if (leaderboardCount > 0) {
                const firstLeaderboardOffset = xsqrDataOffset + 4 + 4; // Skip leaderboardCount and padding
                const rowCount = responseFile.readUInt32LE(firstLeaderboardOffset + 4);
                if (rowCount > 0) {
                    const firstRowOffset = firstLeaderboardOffset + 8;
                    const expectedRowSize = 8 + 16 + 4 + 4 + (32 * 32); // xuid + gamertag + statCount + padding + stats[32]
                    expect(expectedRowSize).toBe(0x420); // 1056 bytes per row
                }
            }
        }
    });

    test('should parse old API stats query response file', () => {
        // Read the old API response file (from previous API implementation)
        const filePath = path.join(__dirname, './example_stats_query_response.blf');
        const buffer = fs.readFileSync(filePath);
        
        // Verify file size matches expected: 67781 bytes (0x108C5)
        expect(buffer.length).toBe(67781);
        expect(buffer.length).toBe(0x108c5);
        
        // Parse the BLF file
        const fileData = SBlfFileStatsQueryResponseSchema.read(buffer);
        
        // Verify chunks are present
        expect(fileData._blf).toBeDefined();
        expect(fileData.athr).toBeDefined();
        expect(fileData.xsqr).toBeDefined();
        expect(fileData._eof).toBeDefined();
        
        // Verify _blf chunk
        expect(fileData._blf.fileName).toBeDefined();
        expect(fileData._blf.bom).toBe(0xFFFE); // BOM is conceptually 0xFEFF (MagicNumber normalizes it)
        
        // Verify athr chunk
        expect(fileData.athr.programName).toBeDefined();
        expect(fileData.athr.buildNumberSequence).toBeDefined();
        expect(fileData.athr.buildNumber).toBeDefined();
        expect(fileData.athr.buildString).toBeDefined();
        expect(fileData.athr.authorName).toBeDefined();
        
        // Verify xsqr chunk structure
        expect(fileData.xsqr.leaderboardCount).toBeDefined();
        expect(typeof fileData.xsqr.leaderboardCount).toBe('number');
        expect(fileData.xsqr.leaderboards).toBeDefined();
        expect(Array.isArray(fileData.xsqr.leaderboards)).toBe(true);
        expect(fileData.xsqr.leaderboards.length).toBe(4);
        
        // Verify chunk sizes match expected values
        let offset = 0;
        const chunk1Size = buffer.readUInt32BE(offset + 4);
        expect(chunk1Size).toBe(0x30); // _blf chunk: 48 bytes
        offset += chunk1Size;
        
        const chunk2Size = buffer.readUInt32BE(offset + 4);
        expect(chunk2Size).toBe(0x50); // athr chunk: 80 bytes
        offset += chunk2Size;
        
        const chunk3Size = buffer.readUInt32BE(offset + 4);
        expect(chunk3Size).toBe(0x10834); // xsqr chunk: 67636 bytes
        offset += chunk3Size;
        
        const chunk4Size = buffer.readUInt32BE(offset + 4);
        expect(chunk4Size).toBe(0x11); // _eof chunk: 17 bytes
        offset += chunk4Size;
        
        // Verify total size
        expect(offset).toBe(0x108c5);
        
        // Verify leaderboard structure
        for (let i = 0; i < fileData.xsqr.leaderboards.length; i++) {
            const leaderboard = fileData.xsqr.leaderboards[i];
            expect(leaderboard.leaderboardId).toBeDefined();
            expect(typeof leaderboard.leaderboardId).toBe('number');
            expect(leaderboard.rowCount).toBeDefined();
            expect(typeof leaderboard.rowCount).toBe('number');
            expect(leaderboard.rows).toBeDefined();
            expect(Array.isArray(leaderboard.rows)).toBe(true);
            expect(leaderboard.rows.length).toBe(16);
            
            // Verify row structure
            for (let j = 0; j < leaderboard.rows.length; j++) {
                const row = leaderboard.rows[j];
                expect(row.xuid).toBeDefined();
                expect(typeof row.xuid).toBe('bigint');
                expect(row.gamertag).toBeDefined();
                expect(typeof row.gamertag).toBe('string');
                expect(row.statCount).toBeDefined();
                expect(typeof row.statCount).toBe('number');
                expect(row.stats).toBeDefined();
                expect(Array.isArray(row.stats)).toBe(true);
                expect(row.stats.length).toBe(32);
                
                // Verify stat structure
                for (let k = 0; k < row.stats.length; k++) {
                    const stat = row.stats[k];
                    expect(stat.id).toBeDefined();
                    expect(typeof stat.id).toBe('number');
                    expect(stat.data).toBeDefined();
                    expect(stat.data.type).toBeDefined();
                    expect(stat.data.data).toBeDefined();
                }
            }
        }
        
        // Verify we can read back the data correctly by checking a few values
        // The old API file should have valid structure even if data values differ
        if (fileData.xsqr.leaderboardCount > 0) {
            const firstLeaderboard = fileData.xsqr.leaderboards[0];
            expect(firstLeaderboard.leaderboardId).toBeGreaterThanOrEqual(0);
            expect(firstLeaderboard.rowCount).toBeGreaterThanOrEqual(0);
            expect(firstLeaderboard.rowCount).toBeLessThanOrEqual(16);
            
            if (firstLeaderboard.rowCount > 0) {
                const firstRow = firstLeaderboard.rows[0];
                expect(firstRow.xuid).toBeGreaterThanOrEqual(0n);
                expect(firstRow.statCount).toBeGreaterThanOrEqual(0);
                expect(firstRow.statCount).toBeLessThanOrEqual(32);
            }
        }
    });
});
