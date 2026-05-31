import { BadRequestException, Body, Controller, Delete, Get, Header, Headers, Inject, NotFoundException, Param, ParseIntPipe, Post, Query, StreamableFile } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { EXAMPLE_XUID } from "src/constants";
import { parseXuid } from "src/xbox/xuid";
import { PrismaService } from "src/db/prisma.service";
import { Halo3FileShareService } from "../services/halo3fileshare.service";
import { HALO3_UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA, HALO3_UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA, HALO3_MAX_ACTIVE_TRANSFERS } from "src/constants";
import { buildFileshareSearchFilter, fileshareUniqueIdPartition } from "../fileshare-search";

@ApiTags('Halo 3: ODST')
@Controller('/halo3odst')
export class Halo3ODSTController {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly fileshareService: Halo3FileShareService,
    ) { }

    @Get('/players/:xuid/screenshots')
    @ApiParam({ name: 'xuid' })
    async listPlayerScreenshotsByXuid(
        @Param('xuid') xuid: string,
    ) {
        const screenshots = await this.prisma.odst_blind_screenshot.findMany({
            where: {
                author_id: xuid as any,
            },
            orderBy: {
                date: 'desc',
            },
            take: 48,
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            }
        });
        return screenshots.map(sc => ({
            id: sc.id,
            header: {
                filename: sc.name,
                description: sc.description,
            },
            author: sc.author,
            date: sc.date,
        }));
    }

    @Get('/fileshare/:shareId/:slotId/view')
    @ApiOperation({
        summary: 'View Fileshare Screenshot',
        description: 'Returns a JPEG screenshot from fileshare by share ID and slot number (Halo 3: ODST).'
    })
    @Header('Content-Type', 'image/jpeg')
    @ApiParam({ name: 'shareId' })
    @ApiParam({ name: 'slotId' })
    async viewFileshareScreenshot(
        @Param('shareId') shareId: string,
        @Param('slotId') slotId: string,
    ) {
        const slotNumber = parseInt(slotId, 10);
        return new StreamableFile(
            Uint8Array.from(await this.fileshareService.viewOdstFileshareScreenshot(shareId, slotNumber)),
            { disposition: "filename=screenshot.jpg" }
        );
    }

    @Get('/players/by-gamertag/:gamertag/screenshots')
    @ApiParam({ name: 'gamertag' })
    async listPlayerScreenshotsByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const screenshots = await this.prisma.odst_blind_screenshot.findMany({
            where: {
                author: gamertag,
            },
            orderBy: {
                date: 'desc',
            },
            take: 48,
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            }
        });
        return screenshots.map(sc => ({
            id: sc.id,
            header: {
                filename: sc.name,
                description: sc.description,
            },
            author: sc.author,
            date: sc.date,
        }));
    }

    @Get('/players/by-gamertag/:gamertag/fileshare')
    @ApiParam({ name: 'gamertag' })
    async listPlayerFileShareByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const sr = await this.prisma.halo3_service_record.findFirst({
            where: { player_name: gamertag },
            select: { player_xuid: true },
        });
        if (!sr?.player_xuid) {
            return {
                id: '',
                ownerId: '',
                visibleSlots: 0,
                quotaBytes: HALO3_UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA,
                quotaSlots: HALO3_UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA,
                subscriptionHash: 0,
                slots: [],
            };
        }

        const shareId = String(sr.player_xuid);
        const share = await this.prisma.halo3_file_share.findUnique({
            where: { share_id: shareId },
            select: {
                share_id: true,
                quota_slots: true,
                quota_bytes: true,
                lastHash: true,
            },
        });

        const files = await this.prisma.halo3_file_share_file.findMany({
            where: { share_id: shareId, is_uploaded: true, is_odst: true },
            orderBy: { slot: 'asc' },
            select: {
                id: true,
                slot: true,
                unique_id: true,
                name: true,
                description: true,
                author: true,
                file_type: true,
                author_is_xuid_online: true,
                author_id: true,
                size_in_bytes: true,
                date: true,
                length_seconds: true,
                campaign_id: true,
                map_id: true,
                game_engine_type: true,
                campaign_difficulty: true,
                hopper_id: true,
                game_id: true,
                campaign_insertion_point: true,
                campaign_survival_enabled: true,
            }
        });

        return {
            id: String(share?.share_id ?? shareId),
            ownerId: String(share?.share_id ?? shareId),
            visibleSlots: files.length,
            quotaBytes: share?.quota_bytes ?? HALO3_UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA,
            quotaSlots: share?.quota_slots ?? HALO3_UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA,
            subscriptionHash: share?.lastHash ?? 0,
            slots: files.map(f => ({
                id: f.id,
                uniqueId: String(f.unique_id ?? ''),
                slotNumber: f.slot,
                header: {
                    buildNumber: 0,
                    mapVersion: 0,
                    uniqueId: String(f.unique_id ?? ''),
                    filename: f.name ?? '',
                    description: f.description ?? '',
                    author: f.author ?? '',
                    filetype: f.file_type,
                    authorXuidIsOnline: !!f.author_is_xuid_online,
                    authorXuid: f.author_id ? String(f.author_id) : '',
                    size: Number(f.size_in_bytes ?? 0),
                    date: f.date?.toISOString() ?? '',
                    lengthSeconds: f.length_seconds ?? 0,
                    campaignId: f.campaign_id ?? 0,
                    mapId: f.map_id ?? 0,
                    gameEngineType: f.game_engine_type ?? 0,
                    campaignDifficulty: f.campaign_difficulty ?? 0,
                    hopperId: f.hopper_id ?? 0,
                    gameId: f.game_id ? Number(f.game_id) : 0,
                    campaignInsertionPoint: f.campaign_insertion_point ?? 0,
                    campaignSurvivalEnabled: !!f.campaign_survival_enabled,
                }
            })),
        };
    }

    @Get('/fileshare/files')
    @ApiOperation({
        summary: 'List All Fileshare Files (ODST)',
        description: 'Returns a paginated list of Halo 3: ODST fileshare files with optional filtering by file type.'
    })
    async listAllFileshareFiles(
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 50,
        @Query('fileType') fileType?: string,
        @Query('search') search?: string,
    ) {
        const skip = (page - 1) * pageSize;

        let fileTypes: number[] = [];
        if (fileType) {
            switch (fileType) {
                case 'maps':
                    fileTypes = [10];
                    break;
                case 'gametypes':
                    fileTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    break;
                case 'films':
                    fileTypes = [11, 12];
                    break;
                case 'screenshots':
                    fileTypes = [13];
                    break;
            }
        }
        const fileTypeFilter = fileTypes.length > 0
            ? `AND file_type IN (${fileTypes.join(', ')})`
            : '';
        const searchFilter = buildFileshareSearchFilter(search, 'name', 'description', 'author');
        const uniqueIdPartition = fileshareUniqueIdPartition('unique_id', 'id');

        const filesQuery = `
            WITH ranked_files AS (
                SELECT
                    id, slot, unique_id, name, description, author, file_type,
                    author_is_xuid_online, author_id, size_in_bytes, date,
                    length_seconds, campaign_id, map_id, game_engine_type,
                    campaign_difficulty, hopper_id, game_id, campaign_insertion_point,
                    share_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY ${uniqueIdPartition}
                        ORDER BY date DESC NULLS LAST
                    ) as rn
                FROM halo3.file_share_slot
                WHERE is_uploaded = true AND is_odst = true ${fileTypeFilter}
            )
            SELECT
                id, slot, unique_id, name, description, author, file_type,
                author_is_xuid_online, author_id, size_in_bytes, date,
                length_seconds, campaign_id, map_id, game_engine_type,
                campaign_difficulty, hopper_id, game_id, campaign_insertion_point,
                share_id
            FROM ranked_files
            WHERE rn = 1 ${searchFilter}
            ORDER BY date DESC NULLS LAST
            LIMIT ${pageSize} OFFSET ${skip}
        `;

        const files = await this.prisma.$queryRawUnsafe<Array<{
            id: string;
            slot: number;
            unique_id: bigint;
            name: string | null;
            description: string | null;
            author: string | null;
            file_type: number;
            author_is_xuid_online: boolean | null;
            author_id: bigint | null;
            size_in_bytes: bigint;
            date: Date | null;
            length_seconds: number | null;
            campaign_id: number | null;
            map_id: number | null;
            game_engine_type: number | null;
            campaign_difficulty: number | null;
            hopper_id: number | null;
            game_id: bigint | null;
            campaign_insertion_point: number | null;
            share_id: string;
        }>>(filesQuery);

        const totalQuery = `
            WITH ranked_files AS (
                SELECT
                    name, description, author,
                    ROW_NUMBER() OVER (
                        PARTITION BY ${uniqueIdPartition}
                        ORDER BY date DESC NULLS LAST
                    ) as rn
                FROM halo3.file_share_slot
                WHERE is_uploaded = true AND is_odst = true ${fileTypeFilter}
            )
            SELECT COUNT(*) as count
            FROM ranked_files
            WHERE rn = 1 ${searchFilter}
        `;
        const totalResult = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(totalQuery);
        const total = Number(totalResult[0]?.count ?? 0);

        return {
            data: files.map(f => ({
                id: f.id,
                uniqueId: String(f.unique_id ?? ''),
                slotNumber: f.slot,
                shareId: f.share_id,
                header: {
                    buildNumber: 0,
                    mapVersion: 0,
                    uniqueId: String(f.unique_id ?? ''),
                    filename: f.name ?? '',
                    description: f.description ?? '',
                    author: f.author ?? '',
                    filetype: f.file_type,
                    authorXuidIsOnline: !!f.author_is_xuid_online,
                    authorXuid: f.author_id ? String(f.author_id) : '',
                    size: Number(f.size_in_bytes ?? 0),
                    date: f.date?.toISOString() ?? '',
                    lengthSeconds: f.length_seconds ?? 0,
                    campaignId: f.campaign_id ?? 0,
                    mapId: f.map_id ?? 0,
                    gameEngineType: f.game_engine_type ?? 0,
                    campaignDifficulty: f.campaign_difficulty ?? 0,
                    hopperId: f.hopper_id ?? 0,
                    gameId: f.game_id ? Number(f.game_id) : 0,
                    campaignInsertionPoint: f.campaign_insertion_point ?? 0,
                    campaignSurvivalEnabled: false,
                }
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    @Get('/screenshots')
    @ApiOperation({
        summary: 'List Screenshots',
        description: 'Returns paginated Halo 3: ODST screenshots across all users, optionally filtered by gamertag.',
    })
    async listScreenshots(
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 48,
        @Query('gamertag') gamertag?: string,
    ) {
        const skip = (page - 1) * pageSize;

        const where = gamertag ? { author: gamertag } : {};

        const [screenshots, total] = await Promise.all([
            this.prisma.odst_blind_screenshot.findMany({
                where,
                orderBy: {
                    date: 'desc',
                },
                skip,
                take: pageSize,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    author: true,
                    date: true,
                }
            }),
            this.prisma.odst_blind_screenshot.count({ where }),
        ]);

        return {
            data: screenshots.map(sc => ({
                id: sc.id,
                header: {
                    filename: sc.name,
                    description: sc.description,
                },
                author: sc.author,
                date: sc.date,
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    @Get('/recent-screenshots')
    @ApiOperation({
        summary: 'Get Recent Screenshots',
        description: 'Returns the last 15 Halo 3: ODST screenshots across all users.',
    })
    async getRecentScreenshots() {
        const screenshots = await this.prisma.odst_blind_screenshot.findMany({
            orderBy: {
                date: 'desc',
            },
            take: 15,
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            }
        });
        return screenshots.map(sc => ({
            id: sc.id,
            header: {
                filename: sc.name,
                description: sc.description,
            },
            author: sc.author,
            date: sc.date,
        }));
    }

    @Get('/screenshots/:id/view')
    @ApiOperation({
        summary: 'View Screenshot',
        description: 'Returns an uploaded Halo 3: ODST JPEG screenshot.'
    })
    @Header('Content-Type', 'image/jpeg')
    async viewScreenshot(
        @Param('id') id: string,
    ) {
        return new StreamableFile(
            Uint8Array.from(await this.fileshareService.viewOdstBlindScreenshot(id))
        );
    }

    @Get('/screenshots/:id')
    @ApiOperation({
        summary: 'Get Screenshot',
        description: 'Returns metadata for a single Halo 3: ODST screenshot by ID.',
    })
    async getScreenshot(
        @Param('id') id: string,
    ) {
        const screenshot = await this.prisma.odst_blind_screenshot.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            }
        });

        if (!screenshot) {
            throw new NotFoundException('Screenshot not found');
        }

        return {
            id: screenshot.id,
            header: {
                filename: screenshot.name,
                description: screenshot.description,
            },
            author: screenshot.author,
            date: screenshot.date,
        };
    }

    @Post('/fileshare/transfer')
    @ApiOperation({
        summary: 'Create Fileshare Transfer (ODST)',
        description: 'Creates a Halo 3: ODST fileshare transfer for the logged-in user to download a file.',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    async createFileshareTransfer(
        @Headers('x-xuid') xuid: string,
        @Body() body: { fileId: string },
    ) {
        const fileId = body.fileId;
        const playerXuid = parseXuid(xuid).toString();

        const file = await this.prisma.halo3_file_share_file.findUnique({
            where: { id: fileId },
        });

        if (!file) {
            throw new NotFoundException('File not found');
        }

        if (!file.is_odst) {
            throw new BadRequestException('File is not a Halo 3: ODST file share item');
        }

        if (!file.is_uploaded) {
            throw new BadRequestException('File is not yet uploaded');
        }

        const existingTransfer = await this.prisma.halo3_file_share_transfer.findUnique({
            where: {
                player_xuid_file_id: {
                    player_xuid: playerXuid,
                    file_id: fileId,
                }
            },
        });

        if (existingTransfer) {
            return { success: true };
        }

        const transferCount = await this.prisma.halo3_file_share_transfer.count({
            where: {
                player_xuid: playerXuid,
            },
        });

        if (transferCount >= HALO3_MAX_ACTIVE_TRANSFERS) {
            throw new BadRequestException(`You have reached the maximum of ${HALO3_MAX_ACTIVE_TRANSFERS} active transfers. Please complete your transfers by launching Halo 3 or Halo 3: ODST on your Xbox 360, or cancel existing transfers before adding new ones.`);
        }

        await this.prisma.halo3_file_share_transfer.create({
            data: {
                player_xuid: playerXuid,
                file_id: fileId,
                is_odst: true,
            },
        });

        this.logger.log(`[FileShare ODST] Transfer created for user ${playerXuid} to file ${fileId}`);
        return { success: true };
    }

    @Get('/fileshare/transfers')
    @ApiOperation({
        summary: 'Get Pending Fileshare Transfers (ODST)',
        description: 'Returns pending Halo 3: ODST fileshare transfers for the logged-in user.',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    async getPendingTransfers(
        @Headers('x-xuid') xuid: string,
    ) {
        const playerXuid = parseXuid(xuid).toString();

        const transfers = await this.prisma.halo3_file_share_transfer.findMany({
            where: {
                player_xuid: playerXuid,
                is_odst: true,
            },
            include: {
                file: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        author: true,
                        file_type: true,
                        date: true,
                        share_id: true,
                        slot: true,
                        game_engine_type: true,
                        map_id: true,
                    }
                }
            },
            orderBy: [
                {
                    file: {
                        date: 'desc'
                    }
                }
            ]
        });

        return {
            transfers: transfers.map(t => ({
                fileId: t.file_id,
                fileName: t.file.name,
                fileDescription: t.file.description,
                fileAuthor: t.file.author,
                fileType: t.file.file_type,
                fileDate: t.file.date,
                shareId: t.file.share_id.toString(),
                slot: t.file.slot,
                gameEngineType: t.file.game_engine_type ?? null,
                mapId: t.file.map_id ?? null,
            })),
            maxTransfers: HALO3_MAX_ACTIVE_TRANSFERS,
        };
    }

    @Delete('/fileshare/transfers/:fileId')
    @ApiOperation({
        summary: 'Delete Fileshare Transfer (ODST)',
        description: 'Deletes a pending Halo 3: ODST fileshare transfer for the logged-in user.',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    @ApiParam({ name: 'fileId' })
    async deleteTransfer(
        @Headers('x-xuid') xuid: string,
        @Param('fileId') fileId: string,
    ) {
        const playerXuid = parseXuid(xuid).toString();

        const existing = await this.prisma.halo3_file_share_transfer.findUnique({
            where: {
                player_xuid_file_id: {
                    player_xuid: playerXuid,
                    file_id: fileId,
                }
            },
        });
        if (!existing?.is_odst) {
            throw new NotFoundException('Transfer not found');
        }

        await this.prisma.halo3_file_share_transfer.delete({
            where: {
                player_xuid_file_id: {
                    player_xuid: playerXuid,
                    file_id: fileId,
                }
            }
        });

        this.logger.log(`[FileShare ODST] Transfer deleted for user ${playerXuid} for file ${fileId}`);
        return { success: true };
    }
}
