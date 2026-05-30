import {
    BadRequestException,
    Inject,
    Injectable,
    ServiceUnavailableException,
    UnauthorizedException,
} from "@nestjs/common";
import { find_chunk } from "@blamnetwork/blf";
import {
    e_file_type,
    s_blf_chunk_content_header,
    s_content_item_campaign_metadata,
    s_content_item_film_metadata,
    s_content_item_firefight_metadata,
    s_content_item_game_variant_metadata,
    s_content_item_matchmaking_metadata,
} from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import { reach_file_share } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { randomBytes } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import {
    BLAMNET_SYSTEM_XUID,
    FILESHARE_FOLDER,
    HALOREACH_BUNGIE_FAVOURITES_SLOT_QUOTA,
    HALOREACH_BUNGIE_FAVOURITES_SYSTEM_XUID,
    HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA,
    HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA,
    isBlamNetworkXuid,
    isReachAdminFileshareXuid,
} from "src/constants";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { HALOREACH_BUILD_NUMBERS } from "src/lsp/haloreach/constants";
import { UploadService } from "src/lsp/services/upload.service";
import { xuidToHexString } from "src/xbox/xuid";

const IS_FILESHARE_ENABLED = true;
const FILESHARE_WELCOME_MESSAGE =
    "Pardon our dust! File Share support is currently in Beta, some features may be unavailable.";
const HALOREACH_FILESHARE_FOLDER = join(FILESHARE_FOLDER, "haloreach");
const SHAREDFILE_MIME = "application/x-reach-sharedfile";
const ENABLE_DEBUG_MIME = true;
const DEBUG_MIME = SHAREDFILE_MIME;

const serverIdToString = (serverId: BigInt | Decimal) => {
    if (serverId instanceof Decimal) {
        serverId = BigInt(serverId.toString());
    }
    return serverId.toString(16).toLowerCase().padStart(16, "0");
};

@Injectable()
export class HaloReachFileShareUploadService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly uploadService: UploadService,
    ) {}

    public uploadFileComplete = async (
        shareXuid: BigInt,
        file: Express.Multer.File,
        uniqueId: BigInt,
        fileType: number,
        uncompressedSize: number,
    ): Promise<{ serverId: string; shareId: string }> => {
        const compressedSize = file.buffer.length;
        const serverIdHex = await this.initiateNewUpload(
            shareXuid,
            shareXuid,
            uniqueId,
            fileType,
            uncompressedSize,
            compressedSize,
        );
        const serverId = BigInt(`0x${serverIdHex}`);
        await this.finalizeFileUpload(file, shareXuid, shareXuid, serverId);
        return {
            serverId: serverIdHex.toUpperCase(),
            shareId: xuidToHexString(shareXuid),
        };
    };

    public deleteFileshareFile = async (shareXuid: BigInt, serverId: BigInt) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        await this.deleteFileFromShare(shareXuid, serverId);
    };

    private generateRandomI64(): bigint {
        let v = BigInt(`0x${randomBytes(8).toString("hex")}`);
        if (v < 0) {
            v = -v;
        }
        return v;
    }

    private applyDebugMime = (file: Express.Multer.File) => {
        if (ENABLE_DEBUG_MIME && file.mimetype === "application/octet-stream") {
            file.mimetype = DEBUG_MIME;
        }
    };

    private getFileShare = async (
        viewerXuid: BigInt,
        ownerXuid: BigInt,
    ): Promise<reach_file_share | null> => {
        const ownsFileshare = viewerXuid === ownerXuid;

        let fileShare = await this.prisma.reach_file_share.findUnique({
            where: {
                share_id: ownerXuid.toString(),
            },
        });

        if (!fileShare && (ownsFileshare || isReachAdminFileshareXuid(ownerXuid))) {
            if (ownerXuid === HALOREACH_BUNGIE_FAVOURITES_SYSTEM_XUID) {
                fileShare = await this.prisma.reach_file_share.create({
                    data: {
                        share_id: ownerXuid.toString(),
                        quota_slots: HALOREACH_BUNGIE_FAVOURITES_SLOT_QUOTA,
                        quota_bytes: 0x7fffffff,
                        message: null,
                        lastHash: 0,
                        unsubscribe_stage: null,
                    },
                });
            } else if (ownerXuid === BLAMNET_SYSTEM_XUID) {
                fileShare = await this.prisma.reach_file_share.create({
                    data: {
                        share_id: ownerXuid.toString(),
                        quota_slots: 0xff,
                        quota_bytes: 0x7fffffff,
                        message: null,
                        lastHash: 0,
                        unsubscribe_stage: null,
                    },
                });
            } else {
                fileShare = await this.prisma.reach_file_share.create({
                    data: {
                        share_id: ownerXuid.toString(),
                        message: FILESHARE_WELCOME_MESSAGE,
                    },
                });
            }
        }

        return fileShare;
    };

    private initiateNewUpload = async (
        uploaderXuid: BigInt,
        shareXuid: BigInt,
        uniqueId: BigInt,
        fileType: number,
        uncompressedSize: number,
        compressedSize: number,
    ): Promise<string> => {
        if (!IS_FILESHARE_ENABLED) {
            this.logger.warn(
                `[FileShare] ${uploaderXuid} tried to upload into share but fileshare is disabled.`,
            );
            throw new ServiceUnavailableException();
        }

        if (uploaderXuid !== shareXuid) {
            this.logger.warn(`[FileShare] ${uploaderXuid} tried to upload into share ${shareXuid}`);
            throw new UnauthorizedException("Can't upload to someone elses file share.");
        }

        const fileshare = await this.getFileShare(uploaderXuid, shareXuid);

        return await this.prisma.$transaction(async (tx) => {
            await tx.reach_file_share_file.deleteMany({
                where: {
                    share_id: shareXuid.toString(),
                    is_uploaded: false,
                },
            });

            const currentFileCount = await tx.reach_file_share_file.count({
                where: {
                    share_id: shareXuid.toString(),
                },
            });

            const quotaSlots =
                fileshare?.quota_slots ?? HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA;
            if (currentFileCount >= quotaSlots && !isBlamNetworkXuid(shareXuid)) {
                this.logger.warn(`[FileShare] ${uploaderXuid} tried to upload beyond their slot quota.`);
                throw new BadRequestException("Your file share is full.");
            }

            const usedSlots = await this.prisma.reach_file_share_file.findMany({
                where: {
                    share_id: shareXuid.toString(),
                },
                select: {
                    compressed_size: true,
                },
            });
            const quotaSpace =
                fileshare?.quota_bytes ?? HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA;
            const usedSpace = usedSlots
                .map((slot) => slot.compressed_size)
                .reduce((acc, cur) => acc + cur, 0);
            if (usedSpace + compressedSize > quotaSpace && !isBlamNetworkXuid(shareXuid)) {
                this.logger.warn(
                    `[FileShare] ${uploaderXuid} tried to upload beyond their slot byte quota.`,
                );
                throw new BadRequestException("This file is too large to store.");
            }

            const serverId = this.generateRandomI64();
            const fileShareSlot = await tx.reach_file_share_file.create({
                data: {
                    id: serverId.toString(),
                    share_id: shareXuid.toString(),
                    compressed_size: compressedSize,
                    file_type: fileType,
                    size_in_bytes: uncompressedSize,
                    unique_id: uniqueId.toString(),
                },
            });

            this.logger.log(
                `[FileShare] User ${xuidToHexString(uploaderXuid)} started uploading file ${fileShareSlot.id}`,
            );

            return serverId.toString(16).padStart(16, "0");
        });
    };

    private finalizeFileUpload = async (
        file: Express.Multer.File,
        uploaderXuid: BigInt,
        shareXuid: BigInt,
        serverId: BigInt,
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        this.applyDebugMime(file);

        if (file.mimetype !== SHAREDFILE_MIME) {
            throw new BadRequestException(`Invalid filetype ${file.mimetype}`);
        }

        if (uploaderXuid !== shareXuid) {
            throw new UnauthorizedException("Can't upload to someone elses file share.");
        }

        const chdr = new s_blf_chunk_content_header();
        const found_chdr = find_chunk(file.buffer, chdr, "big");
        let game_variant_data: s_content_item_game_variant_metadata | undefined;
        let film_data: s_content_item_film_metadata | undefined;
        let matchmaking_data: s_content_item_matchmaking_metadata | undefined;
        let campaign_data: s_content_item_campaign_metadata | undefined;
        let firefight_data: s_content_item_firefight_metadata | undefined;

        switch (chdr.metadata.general.file_type) {
            case e_file_type.Film | e_file_type.FilmClip: {
                film_data = chdr.metadata.file_type_data as s_content_item_film_metadata;
            }
            case e_file_type.GameVariant: {
                game_variant_data =
                    chdr.metadata.file_type_data as s_content_item_game_variant_metadata;
            }
        }
        switch (chdr.metadata.general.activity) {
            case 3: {
                matchmaking_data =
                    chdr.metadata.activity_data as s_content_item_matchmaking_metadata;
            }
        }
        switch (chdr.metadata.general.game_mode) {
            case 1: {
                campaign_data = chdr.metadata.game_mode_data as s_content_item_campaign_metadata;
            }
            case 2: {
                firefight_data = chdr.metadata.game_mode_data as s_content_item_firefight_metadata;
            }
        }

        if (!found_chdr) {
            await this.uploadService.storeUploadedFile(file);
            throw new BadRequestException("No header found for upload.");
        }

        const supportedVersions = [
            HALOREACH_BUILD_NUMBERS.RELEASE_TU0,
            HALOREACH_BUILD_NUMBERS.RELEASE_TU1,
        ];

        if (!supportedVersions.includes(chdr.build_number)) {
            this.logger.warn(
                `[FileShare] Got a file with build number ${chdr.build_number}, rejecting.`,
            );
            throw new BadRequestException("Bad Version: The file is unsupported.");
        }

        const destinationFolder = join(
            process.cwd(),
            HALOREACH_FILESHARE_FOLDER,
            xuidToHexString(shareXuid),
        );
        await mkdir(destinationFolder, { recursive: true });
        await writeFile(
            join(destinationFolder, serverId.toString(16).padStart(16, "0")),
            file.buffer,
            { flag: "a+" },
        );
        await this.prisma.reach_file_share_file.update({
            where: {
                id: serverId.toString(),
            },
            data: {
                share_id: shareXuid.toString(),
                compressed_size: file.buffer.length,
                is_uploaded: true,
                uploaded_at: new Date(),

                unique_id: chdr.metadata.general.unique_id.toString(),
                file_type: chdr.metadata.general.file_type,
                megalo_category_index: chdr.metadata.display.megalo_category_index,
                size_in_bytes: chdr.metadata.general.size_in_bytes,
                activity: chdr.metadata.general.activity,
                game_mode: chdr.metadata.general.game_mode,
                game_engine_type: chdr.metadata.general.game_engine_type,
                map_id: chdr.metadata.general.map_id,

                created_at: chdr.metadata.creation_history.timestamp.toISOString(),
                creator_name: chdr.metadata.creation_history.name,
                creator_xuid: chdr.metadata.creation_history.xuid.toString(),
                creator_is_xuid_online: chdr.metadata.creation_history.is_online,

                modified_at: chdr.metadata.modification_history.timestamp.toISOString(),
                modifier_name: chdr.metadata.modification_history.name,
                modifier_xuid: chdr.metadata.modification_history.xuid.toString(),
                modifier_is_xuid_online: chdr.metadata.modification_history.is_online,

                name: chdr.metadata.name,
                description: chdr.metadata.description,

                icon_index: game_variant_data?.icon_index,
                length_seconds: film_data?.seconds,
                hopper_identifier: matchmaking_data?.hopper_identifier,
                campaign_id: campaign_data?.campaign_id,
                campaign_difficulty: campaign_data?.campaign_difficulty,
                campaign_insertion_point: campaign_data?.campaign_insertion_point,
                campaign_metagame_scoring: campaign_data?.campaign_metagame_scoring,
                campaign_primary_skulls: campaign_data?.campaign_primary_skulls,
                campaign_secondary_skulls: campaign_data?.campaign_secondary_skulls,
                firefight_difficulty: firefight_data?.firefight_difficulty,
                firefight_primary_skulls: firefight_data?.firefight_primary_skulls,
                firefight_secondary_skulls: firefight_data?.firefight_secondary_skulls,
            },
        });
    };

    private deleteFileFromShare = async (shareXuid: BigInt, serverId: BigInt) => {
        if (
            !(await this.prisma.reach_file_share_file.findUnique({
                where: {
                    id_share_id: {
                        share_id: shareXuid.toString(),
                        id: serverId.toString(),
                    },
                },
            }))
        ) {
            return;
        }

        await this.prisma.reach_file_share_file.delete({
            where: {
                id_share_id: {
                    share_id: shareXuid.toString(),
                    id: serverId.toString(),
                },
            },
        });

        const filePath = join(
            process.cwd(),
            HALOREACH_FILESHARE_FOLDER,
            xuidToHexString(shareXuid),
            serverIdToString(serverId),
        );

        await rm(filePath, { force: true });
    };
}
