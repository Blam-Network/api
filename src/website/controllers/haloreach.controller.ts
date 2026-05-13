import { BadRequestException, Body, Controller, Delete, Get, Header, Headers, NotFoundException, Param, ParseIntPipe, Post, Query, StreamableFile } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "src/db/prisma.service";
import {
    EXAMPLE_XUID,
    HALOREACH_MAX_ACTIVE_TRANSFERS,
    HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA,
    HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA,
} from "src/constants";
import { HaloReachFileShareService } from "../services/haloreachfileshare.service";
import { parseXuid } from "src/xbox/xuid";

function mapReachServiceRecord(sr: {
    player_xuid: { toString(): string };
    player_name: string;
    appearance_flags: number;
    primary_color: number;
    secondary_color: number;
    tertiary_color: number;
    is_elite: number;
    foreground_emblem: number;
    background_emblem: number;
    emblem_flags: number;
    emblem_primary_color: number;
    emblem_secondary_color: number;
    emblem_background_color: number;
    model_permutations_1: number;
    model_permutations_2: number;
    model_permutations_3: number;
    model_permutations_4: number;
    model_permutations_5: number;
    model_permutations_6: number;
    model_permutations_7: number;
    model_permutations_8: number;
    non_model_customization_1: number;
    non_model_customization_2: number;
    non_model_customization_3: number;
    non_model_customization_4: number;
    service_tag: string;
    campaign_progress: number;
    supply_depot_pct: number;
    commendation_unlock_pct: number;
    grade: number;
    sub_grade: number;
    cheat_flags: { toString(): string };
    ban_flags: { toString(): string };
    matchmade_games_played: number;
}) {
    return {
        id: sr.player_xuid.toString(),
        playerName: sr.player_name,
        appearanceFlags: sr.appearance_flags,
        primaryColor: sr.primary_color,
        secondaryColor: sr.secondary_color,
        tertiaryColor: sr.tertiary_color,
        model: sr.is_elite,
        foregroundEmblem: sr.foreground_emblem,
        backgroundEmblem: sr.background_emblem,
        emblemFlags: sr.emblem_flags,
        emblemPrimaryColor: sr.emblem_primary_color,
        emblemSecondaryColor: sr.emblem_secondary_color,
        emblemBackgroundColor: sr.emblem_background_color,
        serviceTag: sr.service_tag,
        campaignProgress: sr.campaign_progress,
        supplyDepotPct: sr.supply_depot_pct,
        commendationUnlockPct: sr.commendation_unlock_pct,
        grade: sr.grade,
        subGrade: sr.sub_grade,
        cheatFlags: sr.cheat_flags.toString(),
        banFlags: sr.ban_flags.toString(),
        matchmadeGamesPlayed: sr.matchmade_games_played,
        modelPermutations: [
            sr.model_permutations_1,
            sr.model_permutations_2,
            sr.model_permutations_3,
            sr.model_permutations_4,
            sr.model_permutations_5,
            sr.model_permutations_6,
            sr.model_permutations_7,
            sr.model_permutations_8,
        ],
        nonModelCustomization: [
            sr.non_model_customization_1,
            sr.non_model_customization_2,
            sr.non_model_customization_3,
            sr.non_model_customization_4,
        ],
        highestSkill: 0,
        totalEXP: 0,
        rank: 0,
        unknownInsignia: 0,
        unknownInsignia2: 0,
        firstPlayed: null as Date | null,
        lastPlayed: null as Date | null,
        gamesCompleted: sr.matchmade_games_played,
    };
}

@ApiTags('Halo: Reach')
@Controller('/haloreach')
export class HaloReachController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly fileshareService: HaloReachFileShareService,
    ) { }

    @Get('/players/:xuid/servicerecord')
    @ApiParam({ name: 'xuid' })
    async getServiceRecordByXuid(
        @Param('xuid') xuid: string,
    ) {
        const sr = await this.prisma.reach_service_record.findUnique({
            where: { player_xuid: xuid as any },
        });
        if (!sr) {
            return {};
        }
        return mapReachServiceRecord(sr);
    }

    @Get('/players/by-gamertag/:gamertag/servicerecord')
    @ApiParam({ name: 'gamertag' })
    async getServiceRecordByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const decodedGamertag = decodeURIComponent(gamertag);
        const sr = await this.prisma.reach_service_record.findFirst({
            where: { player_name: decodedGamertag },
        });
        if (!sr) {
            return {};
        }
        return mapReachServiceRecord(sr);
    }

    @Get('/players/:xuid/screenshots')
    @ApiParam({ name: 'xuid' })
    async listPlayerScreenshotsByXuid(
        @Param('xuid') xuid: string,
    ) {
        const screenshots = await this.prisma.reach_blind_screenshot.findMany({
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
            },
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

    @Get('/players/by-gamertag/:gamertag/screenshots')
    @ApiParam({ name: 'gamertag' })
    async listPlayerScreenshotsByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const decodedGamertag = decodeURIComponent(gamertag);
        const screenshots = await this.prisma.reach_blind_screenshot.findMany({
            where: {
                author: decodedGamertag,
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
            },
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

    @Get('/players/by-gamertag/:gamertag/fileshare')
    @ApiParam({ name: 'gamertag' })
    async listPlayerFileShareByGamertag(
        @Param('gamertag') gamertag: string,
    ) {
        const decodedGamertag = decodeURIComponent(gamertag);
        const sr = await this.prisma.reach_service_record.findFirst({
            where: { player_name: decodedGamertag },
            select: { player_xuid: true },
        });
        if (!sr?.player_xuid) {
            return {
                id: '',
                ownerId: '',
                visibleSlots: 0,
                quotaBytes: HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA,
                quotaSlots: HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA,
                subscriptionHash: 0,
                slots: [],
            };
        }

        const shareId = sr.player_xuid.toString();
        const share = await this.prisma.reach_file_share.findUnique({
            where: { share_id: shareId as any },
            select: {
                share_id: true,
                quota_slots: true,
                quota_bytes: true,
                lastHash: true,
            },
        });

        const files = await this.prisma.reach_file_share_file.findMany({
            where: { share_id: shareId as any, is_uploaded: true },
            orderBy: { modified_at: 'desc' },
            select: {
                id: true,
                unique_id: true,
                name: true,
                description: true,
                creator_name: true,
                file_type: true,
                creator_is_xuid_online: true,
                creator_xuid: true,
                size_in_bytes: true,
                modified_at: true,
                created_at: true,
                length_seconds: true,
                campaign_id: true,
                map_id: true,
                game_engine_type: true,
                campaign_difficulty: true,
                hopper_identifier: true,
                campaign_insertion_point: true,
            },
        });

        return {
            id: share?.share_id?.toString() ?? shareId,
            ownerId: share?.share_id?.toString() ?? shareId,
            visibleSlots: files.length,
            quotaBytes: share?.quota_bytes ?? HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA,
            quotaSlots: share?.quota_slots ?? HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA,
            subscriptionHash: share?.lastHash ?? 0,
            slots: files.map((f, index) => ({
                id: f.id.toString(),
                uniqueId: f.unique_id != null ? f.unique_id.toString() : '',
                slotNumber: index,
                header: {
                    buildNumber: 0,
                    mapVersion: 0,
                    uniqueId: f.unique_id != null ? f.unique_id.toString() : '',
                    filename: f.name ?? '',
                    description: f.description ?? '',
                    author: f.creator_name ?? '',
                    filetype: f.file_type ?? 0,
                    authorXuidIsOnline: !!f.creator_is_xuid_online,
                    authorXuid: f.creator_xuid != null ? f.creator_xuid.toString() : '',
                    size: Number(f.size_in_bytes?.toString() ?? 0),
                    date: (f.modified_at ?? f.created_at)?.toISOString() ?? '',
                    lengthSeconds: f.length_seconds ?? 0,
                    campaignId: f.campaign_id ?? 0,
                    mapId: f.map_id ?? 0,
                    gameEngineType: f.game_engine_type ?? 0,
                    campaignDifficulty: f.campaign_difficulty ?? 0,
                    hopperId: f.hopper_identifier ?? 0,
                    gameId: 0,
                    campaignInsertionPoint: f.campaign_insertion_point ?? 0,
                    campaignSurvivalEnabled: false,
                },
            })),
        };
    }

    @Get('/fileshare/files')
    @ApiOperation({
        summary: 'List All Fileshare Files',
        description:
            'Paginated list of uploaded Reach fileshare files. `fileType` uses Reach file type values (screenshots=2, films=3–4, map variants=5, game variants=6).',
    })
    async listAllFileshareFiles(
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 48,
        @Query('fileType') fileType?: string,
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

        const filesQuery = `
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
                campaign_difficulty,
                hopper_identifier,
                campaign_insertion_point
            FROM reach.file_share_file
            WHERE is_uploaded = true ${fileTypeFilter}
            ORDER BY COALESCE(modified_at, created_at) DESC NULLS LAST
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
                campaign_difficulty: number | null;
                hopper_identifier: number | null;
                campaign_insertion_point: number | null;
            }>
        >(filesQuery);

        const totalQuery = `
            SELECT COUNT(*)::bigint AS count
            FROM reach.file_share_file
            WHERE is_uploaded = true ${fileTypeFilter}
        `;
        const totalResult = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(totalQuery);
        const total = Number(totalResult[0]?.count ?? 0);

        return {
            data: files.map(f => ({
                id: f.id,
                uniqueId: f.unique_id ?? '',
                slotNumber: 0,
                shareId: f.share_id,
                header: {
                    buildNumber: 0,
                    mapVersion: 0,
                    uniqueId: f.unique_id ?? '',
                    filename: f.name ?? '',
                    description: f.description ?? '',
                    author: f.creator_name ?? '',
                    filetype: f.file_type ?? 0,
                    authorXuidIsOnline: !!f.creator_is_xuid_online,
                    authorXuid: f.creator_xuid ?? '',
                    size: Number(f.size_in_bytes ?? 0),
                    date: f.date?.toISOString() ?? '',
                    lengthSeconds: f.length_seconds ?? 0,
                    campaignId: f.campaign_id ?? 0,
                    mapId: f.map_id ?? 0,
                    gameEngineType: f.game_engine_type ?? 0,
                    campaignDifficulty: f.campaign_difficulty ?? 0,
                    hopperId: f.hopper_identifier ?? 0,
                    gameId: 0,
                    campaignInsertionPoint: f.campaign_insertion_point ?? 0,
                    campaignSurvivalEnabled: false,
                },
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
        description: 'Returns paginated blind screenshots across all users, optionally filtered by gamertag.',
    })
    async listScreenshots(
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 48,
        @Query('gamertag') gamertag?: string,
    ) {
        const skip = (page - 1) * pageSize;

        const where = gamertag ? { author: gamertag } : {};

        const [screenshots, total] = await Promise.all([
            this.prisma.reach_blind_screenshot.findMany({
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
                },
            }),
            this.prisma.reach_blind_screenshot.count({ where }),
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

    @Get('/screenshots/:id/view')
    @ApiOperation({
        summary: 'View Screenshot',
        description: 'Returns an uploaded Halo: Reach JPEG screenshot.',
    })
    @Header('Content-Type', 'image/jpeg')
    async viewScreenshot(
        @Param('id') id: string,
    ) {
        return new StreamableFile(
            Uint8Array.from(await this.fileshareService.viewBlindScreenshot(id)),
        );
    }

    @Get('/screenshots/:id')
    @ApiOperation({
        summary: 'Get Screenshot',
        description: 'Returns metadata for a single blind screenshot by ID.',
    })
    async getScreenshot(
        @Param('id') id: string,
    ) {
        const screenshot = await this.prisma.reach_blind_screenshot.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                description: true,
                author: true,
                date: true,
            },
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
                file_id: fileId as any,
            },
        });

        return { success: true };
    }

    @Get('/fileshare/transfers')
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
                mapId: t.file.map_id ?? null,
            })),
            maxTransfers: HALOREACH_MAX_ACTIVE_TRANSFERS,
        };
    }

    @Delete('/fileshare/transfers/:fileId')
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
