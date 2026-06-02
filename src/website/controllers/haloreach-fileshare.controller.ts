import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Header,
    Headers,
    NotFoundException,
    Param,
    ParseIntPipe,
    Post,
    Query,
    StreamableFile,
    UnauthorizedException,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { ApiConsumes, ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/db/prisma.service";
import {
    EXAMPLE_XUID,
    HALOREACH_MAX_ACTIVE_TRANSFERS,
    isBlamNetworkXuid,
    isReachAdminFileshareXuid,
} from "src/constants";
import { HaloReachFileShareService } from "../services/haloreachfileshare.service";
import { FileShareUploadService } from "../services/haloreach/fileshare.service";
import { JwtService } from "../services/jwt.service";
import { parseXuid } from "src/xbox/xuid";
import { buildFileshareSearchFilter, fileshareUniqueIdPartition } from "../fileshare-search";
import { lookupReachFileshareUploader } from "../fileshare-uploader";
import { mapReachFileShareFileToApi } from "../reach-file-response";
import { queryReachFileshareTypeTotals } from "../fileshare-type-totals";

const REACH_SHAREDFILE_MIME = 'application/x-reach-sharedfile';

function parseReachUniqueId(uniqueId: string): bigint {
    const trimmed = uniqueId.trim();
    if (/^[0-9a-fA-F]{16}$/.test(trimmed)) {
        return BigInt(`0x${trimmed}`);
    }
    return BigInt(trimmed);
}

@ApiTags('Halo: Reach')
@ApiTags('File Share')
@Controller('/haloreach/fileshare')
export class HaloReachFileshareController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly fileshareService: HaloReachFileShareService,
        private readonly fileshareUploadService: FileShareUploadService,
        private readonly jwtService: JwtService,
    ) { }

    @Get('/:shareId/:slotId/view')
    @ApiOperation({
        summary: 'View Fileshare Screenshot',
        description:
            'Returns a JPEG screenshot from Reach fileshare. The second path segment is the file server id (decimal string), not a Halo 3-style slot index.',
    })
    @Header('Content-Type', 'image/jpeg')
    @ApiParam({
        name: 'shareId',
        description: 'File owner XUID as 16-char hex (same format as Halo 3 fileshare URLs).',
    })
    @ApiParam({ name: 'slotId', description: 'File server id (decimal), same as listing `id`.' })
    async viewFileshareScreenshot(
        @Param('shareId') shareId: string,
        @Param('slotId') slotId: string,
    ) {
        return new StreamableFile(
            Uint8Array.from(await this.fileshareService.viewFileshareScreenshot(shareId, slotId)),
            { disposition: 'filename=screenshot.jpg' },
        );
    }

    @Get('/files')
    @ApiOperation({
        summary: 'List All Fileshare Files',
        description:
            'Paginated list of uploaded Reach fileshare files. `fileType` uses Reach file type values (screenshots=2, films=3–4, map variants=5, game variants=6).',
    })
    async listAllFileshareFiles(
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 50,
        @Query('fileType') fileType?: string,
        @Query('shareId') shareIdHex?: string,
        @Query('search') search?: string,
    ) {
        const skip = (page - 1) * pageSize;

        let fileTypes: number[] = [];
        if (fileType) {
            switch (fileType) {
                case 'maps':
                    fileTypes = [5];
                    break;
                case 'gametypes':
                    fileTypes = [6];
                    break;
                case 'films':
                    fileTypes = [3, 4];
                    break;
                case 'screenshots':
                    fileTypes = [2];
                    break;
            }
        }
        const fileTypeFilter =
            fileTypes.length > 0 ? `AND file_type IN (${fileTypes.join(', ')})` : '';

        let shareIdFilter = '';
        if (shareIdHex) {
            shareIdFilter = `AND share_id = ${parseXuid(shareIdHex).toString()}`;
        }
        const searchFilter = buildFileshareSearchFilter(search, 'name', 'description', 'creator_name');
        const uniqueIdPartition = fileshareUniqueIdPartition('unique_id', 'id');

        const filesQuery = `
            WITH ranked_files AS (
                SELECT
                    id::text AS id,
                    share_id::text AS share_id,
                    unique_id::text AS unique_id,
                    name,
                    description,
                    creator_name,
                    file_type,
                    creator_is_xuid_online,
                    creator_xuid::text AS creator_xuid,
                    size_in_bytes::text AS size_in_bytes,
                    COALESCE(modified_at, created_at) AS date,
                    length_seconds,
                    campaign_id,
                    map_id,
                    game_engine_type,
                    icon_index,
                    game_id::text AS game_id,
                    campaign_difficulty,
                    hopper_identifier,
                    campaign_insertion_point,
                    ROW_NUMBER() OVER (
                        PARTITION BY ${uniqueIdPartition}
                        ORDER BY COALESCE(modified_at, created_at) DESC NULLS LAST
                    ) AS rn
                FROM reach.file_share_file
                WHERE is_uploaded = true ${fileTypeFilter}${shareIdFilter}
            )
            SELECT
                id,
                share_id,
                unique_id,
                name,
                description,
                creator_name,
                file_type,
                creator_is_xuid_online,
                creator_xuid,
                size_in_bytes,
                date,
                length_seconds,
                campaign_id,
                map_id,
                game_engine_type,
                icon_index,
                game_id,
                campaign_difficulty,
                hopper_identifier,
                campaign_insertion_point
            FROM ranked_files
            WHERE rn = 1 ${searchFilter}
            ORDER BY date DESC NULLS LAST
            LIMIT ${pageSize} OFFSET ${skip}
        `;

        const files = await this.prisma.$queryRawUnsafe<
            Array<{
                id: string;
                share_id: string;
                unique_id: string | null;
                name: string | null;
                description: string | null;
                creator_name: string | null;
                file_type: number | null;
                creator_is_xuid_online: boolean | null;
                creator_xuid: string | null;
                size_in_bytes: string | null;
                date: Date | null;
                length_seconds: number | null;
                campaign_id: number | null;
                map_id: number | null;
                game_engine_type: number | null;
                icon_index: number | null;
                game_id: string | null;
                campaign_difficulty: number | null;
                hopper_identifier: number | null;
                campaign_insertion_point: number | null;
            }>
        >(filesQuery);

        const totalQuery = `
            WITH ranked_files AS (
                SELECT
                    name,
                    description,
                    creator_name,
                    ROW_NUMBER() OVER (
                        PARTITION BY ${uniqueIdPartition}
                        ORDER BY COALESCE(modified_at, created_at) DESC NULLS LAST
                    ) AS rn
                FROM reach.file_share_file
                WHERE is_uploaded = true ${fileTypeFilter}${shareIdFilter}
            )
            SELECT COUNT(*)::bigint AS count
            FROM ranked_files
            WHERE rn = 1 ${searchFilter}
        `;
        const totalResult = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(totalQuery);
        const total = Number(totalResult[0]?.count ?? 0);
        const totalsByType = await queryReachFileshareTypeTotals(this.prisma, {
            search,
            shareIdFilter,
        });

        return {
            data: files.map(f => mapReachFileShareFileToApi({
                ...f,
                game_id: f.game_id ? new Prisma.Decimal(f.game_id) : null,
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
            totalsByType,
        };
    }

    @Get('/files/:fileId/related-files')
    @ApiOperation({
        summary: 'List Related Fileshare Files (Reach)',
        description: 'Returns uploaded Reach fileshare files with the same game_id as the given file.',
    })
    @ApiParam({ name: 'fileId', description: 'Reach file server id (decimal string).' })
    async getRelatedFileshareFiles(@Param('fileId') fileId: string) {
        const sourceFile = await this.prisma.reach_file_share_file.findUnique({
            where: { id: fileId as any },
            select: { game_id: true, is_uploaded: true },
        });

        if (
            !sourceFile?.is_uploaded ||
            sourceFile.game_id == null ||
            sourceFile.game_id.toString() === '0'
        ) {
            return { data: [] };
        }

        const files = await this.prisma.reach_file_share_file.findMany({
            where: {
                game_id: sourceFile.game_id,
                is_uploaded: true,
                id: { not: fileId as any },
            },
            orderBy: [{ modified_at: 'desc' }, { created_at: 'desc' }],
            take: 20,
        });

        return {
            data: files.map(f => mapReachFileShareFileToApi(f)),
        };
    }

    @Get('/files/:fileId')
    @ApiOperation({
        summary: 'Get Fileshare File (Reach)',
        description: 'Returns metadata for a single Reach fileshare file by ID.',
    })
    @ApiParam({ name: 'fileId', description: 'Reach file server id (decimal string).' })
    async getFileshareFile(@Param('fileId') fileId: string) {
        const file = await this.prisma.reach_file_share_file.findUnique({
            where: { id: fileId as any },
        });

        if (!file || !file.is_uploaded) {
            throw new NotFoundException('File not found');
        }

        const uploaderInfo = await lookupReachFileshareUploader(this.prisma, file.share_id);

        return {
            ...(uploaderInfo ?? {}),
            ...mapReachFileShareFileToApi(file),
        };
    }

    @Post('/upload')
    @ApiOperation({
        summary: 'Upload Reach Fileshare File',
        description:
            'Uploads a Reach shared file in one request. Authenticated via NextAuth JWT (Bearer). ' +
            'Uploads to the caller\'s file share by default; system file shares require admin.',
    })
    @ApiConsumes('multipart/form-data')
    @ApiHeader({ name: 'Authorization', description: 'NextAuth JWT (Bearer token)' })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFileshareFile(
        @Headers('Authorization') authorization: string,
        @UploadedFile() file: Express.Multer.File | undefined,
        @Body('uniqueId') uniqueIdRaw: string,
        @Body('fileType') fileTypeRaw: string,
        @Body('uncompressedSize') uncompressedSizeRaw: string,
        @Body('shareId') shareIdHex?: string,
    ) {
        if (!authorization?.startsWith('Bearer ')) {
            throw new BadRequestException('Authorization header with Bearer JWT is required');
        }
        if (!file) {
            throw new BadRequestException('file is required');
        }
        if (
            typeof uniqueIdRaw !== 'string' ||
            typeof fileTypeRaw !== 'string' ||
            typeof uncompressedSizeRaw !== 'string'
        ) {
            throw new BadRequestException('uniqueId, fileType, and uncompressedSize are required');
        }

        const { user: jwtUser } = await this.jwtService.validateJwtToken(authorization);
        const authXuid = BigInt(jwtUser.xuid);
        const shareXuid = shareIdHex ? parseXuid(shareIdHex) : authXuid;

        if (isReachAdminFileshareXuid(shareXuid)) {
            const user = await this.prisma.bnet_user.findUnique({
                where: { player_xuid: authXuid.toString() },
            });
            const canUpload =
                user?.is_admin === true ||
                (user?.is_uploader === true && isBlamNetworkXuid(shareXuid));
            if (!canUpload) {
                throw new ForbiddenException(
                    'You do not have permission to upload to this system file share.',
                );
            }
        } else if (shareXuid !== authXuid) {
            throw new UnauthorizedException("Can't upload to someone else's file share.");
        }

        const fileType = Number.parseInt(fileTypeRaw, 10);
        const uncompressedSize = Number.parseInt(uncompressedSizeRaw, 10);
        if (Number.isNaN(fileType) || Number.isNaN(uncompressedSize)) {
            throw new BadRequestException('Invalid numeric upload parameters');
        }

        const uniqueId = parseReachUniqueId(uniqueIdRaw);

        if (isReachAdminFileshareXuid(shareXuid)) {
            const existing = await this.prisma.reach_file_share_file.findFirst({
                where: {
                    share_id: shareXuid.toString(),
                    unique_id: uniqueId.toString(),
                    is_uploaded: true,
                },
            });
            if (existing) {
                throw new ConflictException(
                    'A file with this unique ID already exists on the system file share.',
                );
            }
        }

        file.mimetype = REACH_SHAREDFILE_MIME;

        return this.fileshareUploadService.uploadFileComplete(
            shareXuid,
            file,
            uniqueId,
            fileType,
            uncompressedSize,
        );
    }

    @Delete('/files/:fileId')
    @ApiOperation({
        summary: 'Delete Reach Fileshare File',
        description:
            'Deletes an uploaded Reach fileshare file. Authenticated via NextAuth JWT (Bearer). ' +
            'System file shares require admin.',
    })
    @ApiHeader({ name: 'Authorization', description: 'NextAuth JWT (Bearer token)' })
    @ApiParam({ name: 'fileId', description: 'Reach file server id (decimal string).' })
    async deleteFileshareFile(
        @Headers('Authorization') authorization: string,
        @Param('fileId') fileId: string,
        @Query('shareId') shareIdHex?: string,
    ) {
        if (!authorization?.startsWith('Bearer ')) {
            throw new BadRequestException('Authorization header with Bearer JWT is required');
        }
        if (!shareIdHex) {
            throw new BadRequestException('shareId query parameter is required');
        }

        const { user: jwtUser } = await this.jwtService.validateJwtToken(authorization);
        const authXuid = BigInt(jwtUser.xuid);
        const shareXuid = parseXuid(shareIdHex);

        if (isReachAdminFileshareXuid(shareXuid)) {
            const user = await this.prisma.bnet_user.findUnique({
                where: { player_xuid: authXuid.toString() },
            });
            if (!user?.is_admin) {
                throw new ForbiddenException('Admin access is required to delete from the system file share.');
            }
        } else if (shareXuid !== authXuid) {
            throw new UnauthorizedException("Can't delete from someone else's file share.");
        }

        const file = await this.prisma.reach_file_share_file.findUnique({
            where: {
                id_share_id: {
                    share_id: shareXuid.toString(),
                    id: fileId,
                },
            },
        });

        if (!file) {
            throw new NotFoundException('File not found');
        }

        if (!file.is_uploaded) {
            throw new BadRequestException('File is not yet uploaded');
        }

        await this.fileshareUploadService.deleteFileshareFile(shareXuid, BigInt(fileId));

        return { success: true };
    }

    @Post('/transfer')
    @ApiOperation({
        summary: 'Create Fileshare Transfer (Reach)',
        description: 'Creates a fileshare transfer for the logged-in user to download a file in Halo: Reach.',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    async createFileshareTransfer(
        @Headers('x-xuid') xuid: string,
        @Body() body: { fileId: string },
    ) {
        const fileId = body.fileId;
        const playerXuid = parseXuid(xuid).toString();

        const file = await this.prisma.reach_file_share_file.findUnique({
            where: { id: fileId as any },
        });

        if (!file) {
            throw new NotFoundException('File not found');
        }

        if (!file.is_uploaded) {
            throw new BadRequestException('File is not yet uploaded');
        }

        const existingTransfer = await this.prisma.reach_file_share_transfer.findUnique({
            where: {
                player_xuid_file_id: {
                    player_xuid: playerXuid,
                    file_id: fileId as any,
                },
            },
        });

        if (existingTransfer) {
            return { success: true };
        }

        const transferCount = await this.prisma.reach_file_share_transfer.count({
            where: {
                player_xuid: playerXuid,
            },
        });

        if (transferCount >= HALOREACH_MAX_ACTIVE_TRANSFERS) {
            throw new BadRequestException(
                `You have reached the maximum of ${HALOREACH_MAX_ACTIVE_TRANSFERS} active transfers. Please complete your transfers by launching Halo: Reach on your Xbox 360, or cancel existing transfers before adding new ones.`,
            );
        }

        await this.prisma.reach_file_share_transfer.create({
            data: {
                player_xuid: playerXuid,
                file_id: fileId,
            },
        });

        return { success: true };
    }

    @Get('/transfers')
    @ApiOperation({
        summary: 'Get Pending Fileshare Transfers (Reach)',
        description: 'Returns pending fileshare transfers for the logged-in user.',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    async getPendingTransfers(@Headers('x-xuid') xuid: string) {
        const playerXuid = parseXuid(xuid).toString();

        const transfers = await this.prisma.reach_file_share_transfer.findMany({
            where: {
                player_xuid: playerXuid,
            },
            include: {
                file: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        creator_name: true,
                        file_type: true,
                        modified_at: true,
                        created_at: true,
                        share_id: true,
                        map_id: true,
                        game_engine_type: true,
                        icon_index: true,
                    },
                },
            },
            orderBy: [
                {
                    file: {
                        modified_at: 'desc',
                    },
                },
            ],
        });

        return {
            transfers: transfers.map(t => ({
                fileId: t.file_id.toString(),
                fileName: t.file.name,
                fileDescription: t.file.description,
                fileAuthor: t.file.creator_name,
                fileType: t.file.file_type,
                fileDate: (t.file.modified_at ?? t.file.created_at)?.toISOString() ?? '',
                shareId: t.file.share_id.toString(),
                slot: 0,
                gameEngineType: t.file.game_engine_type ?? null,
                iconIndex: t.file.icon_index ?? null,
                mapId: t.file.map_id ?? null,
            })),
            maxTransfers: HALOREACH_MAX_ACTIVE_TRANSFERS,
        };
    }

    @Delete('/transfers/:fileId')
    @ApiOperation({
        summary: 'Delete Fileshare Transfer (Reach)',
        description: 'Deletes a pending fileshare transfer for the logged-in user.',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    @ApiParam({ name: 'fileId', description: 'Reach file server id (decimal string).' })
    async deleteTransfer(@Headers('x-xuid') xuid: string, @Param('fileId') fileId: string) {
        const playerXuid = parseXuid(xuid).toString();

        await this.prisma.reach_file_share_transfer.delete({
            where: {
                player_xuid_file_id: {
                    player_xuid: playerXuid,
                    file_id: fileId as any,
                },
            },
        });

        return { success: true };
    }
}
