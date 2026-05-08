import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp'
import { PrismaService } from "src/db/prisma.service";
import { access, mkdir, rm, stat, writeFile } from "fs/promises";
import { join } from "path";
import { FILESHARE_FOLDER, HALO3_UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA, HALO3_UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA, HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA, HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA, SCREENSHOTS_FOLDER } from "../../constants";
import dedent from "dedent";
import { h32 } from 'xxhashjs';
import { DiscordWebhookService } from "../services/discordwebhook.service";
import { xuidToHexString } from "src/xbox/xuid";
import { HALOREACH_BUILD_NUMBERS } from "./constants";
import { UploadService } from "../services/upload.service";
import { randomBytes } from "crypto";
import { blf } from "src/blf";
import { HaloReach } from "../blf";
import { c } from "src/cstruct";
import { createReadStream } from "fs";
import { Decimal } from "@prisma/client/runtime/library";
const IS_FILESHARE_ENABLED = true;
const FILESHARE_UNAVAILABLE_MESSAGE = 'Pardon our dust! File Share is currently Unavailable.'

const HALOREACH_FILESHARE_FOLDER = join(FILESHARE_FOLDER, 'haloreach');

const MEGABYTE = 1024 * 1024;
const UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA = 25 * MEGABYTE;
const UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA = 0;
const DOWNLOAD_ENDPOINT = '/gameapi_omaha/FilesStartDownload.ashx';

const SHAREDFILE_MIME = 'application/x-reach-sharedfile'

const ENABLE_DEBUG_MIME = true;
const DEBUG_MIME = SHAREDFILE_MIME

const OFFER_IDS = {
}

const PACKAGE_NAMES = {
}

type FileShareSubscriptionStatus = 'NeverSubscribed' | 'Subscribed' | 'SubscribedRenew' | 'Expired';

type FileShareSubscription = {
    status: FileShareSubscriptionStatus,
    /** Offer ID which is opened when pressing the Bungie PRO button. */
    nextOfferId: bigint, //u64
    /** Text label for Bungie PRO button in the start menu. */
    hqButton: string
    /** Text that shows when hovering the Bungie PRO button in the start menu. */
    hqMessage: string,
    /** Text that displays on the Bungie PRO button displayed in the file share. */
    fileShareButton: string,
    /** Text that displays on the right pane when hovering the Bungie PRO button in the file share. */
    fileShareMessage: string,
    /** Text that displays on the bottom pane when hovering the Bungie PRO button in the file share. */
    fileShareHelp: string,
    justSubscribedMessage: string,
    /** Text that displays if you're subscribed to Bungie PRO and you press the Bungie PRO button in the file share. */
    currentlySubscribedMessage: string,
    overQuotaMessage: string,
    subscriptionEndTimestamp: bigint,
    subscriptionHash: number,
    portalButton: string,
    portalOfferCount: number,
    portalOfferId: bigint, //u64
    portalExecutePackageFileName: string,
    portalExecuteImageFileName: string,
    portalExecuteLaunchData: bigint, //u64
} | {
    status: FileShareSubscriptionStatus,
}

const serverIdToString = (serverId: BigInt | Decimal) => {
    if (serverId instanceof Decimal) {
        serverId = BigInt(serverId.toString());
    }
    return serverId.toString(16).toLowerCase().padStart(16, '0');
}

@Injectable()
export class HaloReachFileShareService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly discordWebhookService: DiscordWebhookService,
        private readonly uploadService: UploadService,
    ) { }

    private generateRandomU64(): bigint {
        return BigInt(`0x${randomBytes(8).toString('hex')}`);
    }

    private applyDebugMime = (file: Express.Multer.File) => {
        if (ENABLE_DEBUG_MIME && file.mimetype === 'application/octet-stream') {
            file.mimetype = DEBUG_MIME;
        }
    }

    // If the fileshare subscription hash doesn't match the subscription hash, we refetch the subscription.
    private getShareSubscriptionHash = async (response: 'subscription' | 'fileshare', shareXuid: number): Promise<{
        currentHash: number,
        isUnsubscribing: boolean,
    }> => {
        const fileShare = await this.prisma.halo3_file_share.findUnique({
            where: {
                share_id: shareXuid
            }
        })

        if (!fileShare) return {
            currentHash: 0,
            isUnsubscribing: false,
        };

        let currentHash = 0;
        // Nothing has been overrided, no subscription hash.
        if (
            fileShare.quota_bytes !== null
            || fileShare.quota_slots !== null
            || fileShare.message !== null
        ) {
            const hasher = h32().init(0);
            hasher.update(JSON.stringify({
                quotaSlots: fileShare?.quota_slots || UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA,
                quotaBytes: fileShare?.quota_bytes || UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA,
                message: fileShare?.message
            }))
    
            // returns a u32, we want i32
            currentHash = hasher.digest().toNumber();
            if (currentHash & 0x80000000) 
                currentHash = -(currentHash & 0x7FFFFFFF)
        }

        const hasUnsubbed = currentHash === 0 && fileShare.lastHash !== 0;
        let isUnsubscribing = false;
        // There's a limitaiton with halo where if you want to live update fileshare settings,
        // you need to use a subscription hash to do so. However, the subscription hash can only
        // be set if the Bungie PRO button is show, which is undesirable.
        // To circumvent this, we have some complex logic:
        // 1. file share is called, user has ubsubbed
        //      we return a bogus subscription hash to cause the game to refetch later...
        // 2. subscription is called, we need to prepare by returning subscription hash 0,
        //      but we need to enable the Bungie Pro button to do so which is undesirable...
        // 3. Because we returned a bogus hash earlier, the file share is req'd again.
        //      We return another bogus hash to cause another fetch of the subscription file.
        // 4. Subscription file is refetched, this time we return no hash, we still have 0 in memory.
        // 5. File hash is req'd again, we can finally return the zero'd subasciption hash.
        let unsubStage: number | null = null;
        if (response === 'fileshare' && hasUnsubbed && fileShare.unsubscribe_stage == null)
            unsubStage = 1;
        else if (response === 'subscription' && fileShare.unsubscribe_stage == 1)
            unsubStage = 2;
        else if (response === 'fileshare' && fileShare.unsubscribe_stage == 2)
            unsubStage = 3;
        else if (response === 'subscription' && fileShare.unsubscribe_stage == 3)
            unsubStage = 4;
        else if (response === 'fileshare' && fileShare.unsubscribe_stage == 4)
            unsubStage = null;

        if (unsubStage !== null) {
            isUnsubscribing = true;
        }

        if (unsubStage == 1)
            currentHash = 1;
        else if (unsubStage == 3)
            currentHash = 2;
        
        await this.prisma.halo3_file_share.update({
            where: {
                share_id: shareXuid,
            },
            data: {
                lastHash: currentHash,
                unsubscribe_stage: unsubStage,
            }
        });

        return {
            currentHash,
            isUnsubscribing
        };
    }

    private fileshareSubscriptionResponse = (subscription: FileShareSubscription) => {
        if ('nextOfferId' in subscription) {
            return dedent.withOptions({
                trimWhitespace: false,
            })(`\
                Status: ${subscription.status}
                NextOfferID: ${subscription.nextOfferId || 0}
                HQButton: ${subscription.hqButton}
                HQMessage: ${subscription.hqMessage}
                FileShareButton: ${subscription.fileShareButton}
                FileShareMessage: ${subscription.fileShareMessage}
                FileShareHelp: ${subscription.fileShareHelp}
                JustSubscribedMessage: ${subscription.justSubscribedMessage}
                CurrentlySubscribedMessage: ${subscription.currentlySubscribedMessage}
                OverQuotaMessage: ${subscription.overQuotaMessage}
                SubscriptionSecondsPast19700101: ${subscription.subscriptionEndTimestamp}
                SubscriptionHash: ${subscription.subscriptionHash}
                PortalButton: ${subscription.portalButton}
                PortalOfferCount: ${subscription.portalOfferCount}
                PortalOfferID: ${subscription.portalOfferId}
                PortalExecutePackageFilename: ${subscription.portalExecutePackageFileName}
                PortalExecuteImageFilename: ${subscription.portalExecuteImageFileName}
                PortalExecuteLaunchData: ${subscription.portalExecuteLaunchData}
            `);
        }

        return dedent.withOptions({
            trimWhitespace: false,
        })(`\
            Status: ${subscription.status}
        `);
    }

    public getUploadProgress = async (
        uploaderXuid: number,
        shareXuid: number,
        slot: number,
        serverId: string,
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            throw new ServiceUnavailableException();
        }

        const filePath = join(
            process.cwd(),
            HALOREACH_FILESHARE_FOLDER,
            shareXuid.toString(16).padStart(16, '0'),
            slot.toString(),
        );

        try {
            await access(filePath);
            return (await stat(filePath)).size;
        } catch (e) {
            throw new NotFoundException('File not found.')
        }
    }

    public getSubscription = async (userXuid: number, locale: string) => {        
        return this.fileshareSubscriptionResponse({
            status: 'Subscribed',
        })
    }


    public handleBlindFileUpload = async (
        file: Express.Multer.File, 
        uploaderXuid: BigInt, 
        machineId: BigInt,
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        this.applyDebugMime(file);

        if (file.mimetype !== SHAREDFILE_MIME) {
            throw new BadRequestException('Invalid filetype.')
        }

        let chdr: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_content_header | undefined = undefined;
        let scnd: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_screenshot_data | undefined = undefined;

        const releaseScreenshot = BLF.haloreach_12065_11_08_24_1738_tu1actual.read_blind_screenshot(file.buffer);
        if (releaseScreenshot && releaseScreenshot.chdr.build_number == HALOREACH_BUILD_NUMBERS.RELEASE_TU1) {
            chdr = releaseScreenshot.chdr;
            scnd = releaseScreenshot.scnd;
        }

        const betaScreenshot = BLF.haloreach_09730_10_04_09_1309_omaha_delta.read_blind_screenshot(file.buffer);
        if (betaScreenshot && (
            betaScreenshot.chdr.build_number == HALOREACH_BUILD_NUMBERS.BETA_PUBLIC
            || betaScreenshot.chdr.build_number == HALOREACH_BUILD_NUMBERS.BETA_PRIVATE_TU1
        )) {
            chdr = betaScreenshot.chdr;
            scnd = betaScreenshot._cmp;
        }

        const privateBetaScreenshot = BLF.haloreach_09449_10_03_25_1545_omaha_beta.read_blind_screenshot(file.buffer);
        if (privateBetaScreenshot && (
            privateBetaScreenshot.chdr.build_number == HALOREACH_BUILD_NUMBERS.BETA_PRIVATE_TU1
            || privateBetaScreenshot.chdr.build_number == HALOREACH_BUILD_NUMBERS.BETA_PRIVATE
            || privateBetaScreenshot.chdr.build_number == HALOREACH_BUILD_NUMBERS.ALPHA_PRIVATE
        )) {
            chdr = privateBetaScreenshot.chdr;
            scnd = privateBetaScreenshot._cmp;
        }

        if (!chdr || !scnd) {
            this.logger.warn(`[FileShare] Got an unsupported blind file.`)
            throw new BadRequestException("Bad Version: The file is unsupported.")
        }

        const destinationFolder = join(
            process.cwd(),
            SCREENSHOTS_FOLDER,
            'haloreach',
            xuidToHexString(uploaderXuid),
        );
        await mkdir(destinationFolder, { recursive: true })
        const screenshotData = await this.prisma.reach_blind_screenshot.create({
            data: {
                author: chdr.metadata.creator_name,
                author_id: uploaderXuid.toString(),
                author_is_xuid_online: chdr.metadata.creator_xuid_is_online,
                difficulty: chdr.metadata.campaign_data?.campaign_difficulty || chdr.metadata.firefight_data?.firefight_difficulty,
                campaign_id: chdr.metadata.campaign_data?.campaign_id,
                date: chdr.metadata.creation_time,
                description: chdr.metadata.description,
                file_type: chdr.metadata.file_type,
                game_engine_type: chdr.metadata.game_engine_type,
                game_mode: chdr.metadata.game_mode,
                activity: chdr.metadata.activity,
                game_id: chdr.metadata.game_id.toString(),
                length_seconds: chdr.metadata.film_data?.seconds,
                map_id: chdr.metadata.map_id,
                name: chdr.metadata.name,
                size_in_bytes: chdr.metadata.size_in_bytes.toString(),
                unique_id: chdr.metadata.unique_id.toString(),
                parent_unique_id: chdr.metadata.parent_unique_id.toString(),
                root_unique_id: chdr.metadata.root_unique_id.toString(),
                hopper_id: chdr.metadata.matchmaking_data?.hopper_identifier,
                jpeg_length: scnd.jpeg_data.length,
                build_number: chdr.build_number,
            },
            select: {
                id: true,
            }
        });
        
        if (!screenshotData) {
            throw new InternalServerErrorException('Failed to save screenshot.');
        }

        await writeFile(join(
            destinationFolder,
            screenshotData.id,
        ), file.buffer);

        // Try to send a discord message, but dont wait on it.
        this.discordWebhookService.sendHaloReachScreenshot({
            authorXuid: chdr.metadata.creator_xuid,
            authorName: chdr.metadata.creator_name,
            name: chdr.metadata.name,
            description: chdr.metadata.description,
            imageUrl: `https://halo3.blam.network/haloreach/screenshots/${screenshotData.id}/view`
        }).catch((err) => this.logger.error(`Failed to send screenshot to discord: ${err}`))
    }

    private getFileShare = async (viewerXuid: BigInt, ownerXuid: BigInt) => {
        const ownsFileshare = viewerXuid === ownerXuid;

        let fileShare = await this.prisma.reach_file_share.findUnique({
            where: {
                share_id: ownerXuid.toString(),
            }
        })

        if (!fileShare && ownsFileshare) {
            fileShare = await this.prisma.reach_file_share.create({
                data: {
                    share_id: ownerXuid.toString(),
                }
            })
        }

        return fileShare;
    }

    public initiateNewUpload = async (
        uploaderXuid: BigInt,
        shareXuid: BigInt,
        uniqueId: BigInt,
        fileType: number,
        uncompressedSize: number,
        compressedSize: number,
    ): Promise<string> => {
        if (!IS_FILESHARE_ENABLED) {
            this.logger.warn(`[FileShare] ${uploaderXuid} tried to upload into share but fileshare is disabled.`);
            throw new ServiceUnavailableException();
        }

        if (uploaderXuid !== shareXuid) {
            this.logger.warn(`[FileShare] ${uploaderXuid} tried to upload into share ${shareXuid}`);
            throw new UnauthorizedException("Can't upload to someone elses file share.")
        }

        const fileshare = await this.getFileShare(uploaderXuid, shareXuid);

        // tx prevents over-quota errors from concurrent uploads.
        return await this.prisma.$transaction(async (tx) => {
            // If the user has an abandoned upload, remove it. Uploads are single-file.
            await tx.reach_file_share_file.deleteMany({
                where: {
                    share_id: shareXuid.toString(),
                    is_uploaded: false,
                }
            })

            // if the fileshare is full or there isn't enough space for this file, reject.
            const currentFileCount = await tx.reach_file_share_file.count({
                where: {
                    share_id: shareXuid.toString()
                }
            })

            const quotaSlots = fileshare?.quota_slots ?? HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA;
            if (currentFileCount > quotaSlots) {
                this.logger.warn(`[FileShare] ${uploaderXuid} tried to upload beyond their slot quota.`);
                throw new BadRequestException("Your file share is full.")
            }

            const usedSlots = await this.prisma.reach_file_share_file.findMany({
                where: {
                    share_id: shareXuid.toString()
                },
                select: {
                    compressed_size: true,
                }
            })
            const quotaSpace = fileshare?.quota_bytes ?? HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA;
            const usedSpace = usedSlots.map(slot => slot.compressed_size).reduce((acc, cur) => acc + cur, 0)
            if (usedSpace + compressedSize > quotaSpace) {
                this.logger.warn(`[FileShare] ${uploaderXuid} tried to upload beyond their slot byte quota.`);
                throw new BadRequestException("This file is too large to store.");
            }

            const serverId = this.generateRandomU64();
            const fileShareSlot = await tx.reach_file_share_file.create({
                data: {
                    id: serverId.toString(),
                    share_id: shareXuid.toString(),
                    compressed_size: compressedSize,
                    file_type: fileType,
                    size_in_bytes: uncompressedSize,
                    unique_id: uniqueId.toString(),
                }
            });

            this.logger.log(`[FileShare] User ${uploaderXuid} started uploading file ${fileShareSlot.id}`);

            return serverId.toString(16).padStart(16, '0');
        });
    }

    public handleFileUpload = async (
        file: Express.Multer.File, 
        machineId: BigInt,
        uploaderXuid: BigInt, 
        shareXuid: BigInt, 
        serverId: BigInt
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        this.applyDebugMime(file);

        if (file.mimetype !== SHAREDFILE_MIME) {
            throw new BadRequestException(`Invalid filetype ${file.mimetype}`)
        }

        if (uploaderXuid !== shareXuid) {
            throw new UnauthorizedException("Can't upload to someone elses file share.")
        }

        const contentHeader = BLF.haloreach_12065_11_08_24_1738_tu1actual.read_content_header(file.buffer);
        if (!contentHeader) { 
            await this.uploadService.storeUploadedFile(file);
            throw new BadRequestException('No header found for upload.'); 
        }

        if (contentHeader.build_number !== HALOREACH_BUILD_NUMBERS.RELEASE_TU1) {
            this.logger.warn(`[FileShare] Got a file with build number ${contentHeader.build_number}, rejecting.`)
            throw new BadRequestException("Bad Version: The file is unsupported.")
        }

        const destinationFolder = join(
            process.cwd(),
            HALOREACH_FILESHARE_FOLDER,
            xuidToHexString(shareXuid),
        );
        await mkdir(destinationFolder, { recursive: true })
        await writeFile(join(
            destinationFolder,
            serverId.toString(16).padStart(16, '0'),
        ), file.buffer, { flag: 'a+' });
        await this.prisma.reach_file_share_file.update({
            where: {
                id: serverId.toString(),
            },
            data: {
                share_id: shareXuid.toString(),
                compressed_size: file.buffer.length,
                is_uploaded: true,

                unique_id: contentHeader.metadata.unique_id.toString(),
                file_type: contentHeader.metadata.file_type,
                megalo_category_index: contentHeader.metadata.megalo_category_index,
                size_in_bytes: contentHeader.metadata.size_in_bytes.toString(),
                activity: contentHeader.metadata.activity,
                game_mode: contentHeader.metadata.game_mode,
                game_engine_type: contentHeader.metadata.game_engine_type,
                map_id: contentHeader.metadata.map_id,

                created_at: contentHeader.metadata.creation_time,
                creator_name: contentHeader.metadata.creator_name,
                creator_xuid: uploaderXuid.toString(),
                creator_is_xuid_online: contentHeader.metadata.creator_xuid_is_online,

                modified_at: contentHeader.metadata.modification_time,
                modifier_name: contentHeader.metadata.modifier_name,
                modifier_xuid: contentHeader.metadata.modifier_xuid.toString(),
                modifier_is_xuid_online: contentHeader.metadata.modifier_xuid_is_online,

                name: contentHeader.metadata.name,
                description: contentHeader.metadata.description,

                icon_index: contentHeader.metadata.game_variant_data?.icon_index,
                length_seconds: contentHeader.metadata.film_data?.seconds,
                hopper_identifier: contentHeader.metadata.matchmaking_data?.hopper_identifier,
                campaign_id: contentHeader.metadata.campaign_data?.campaign_id,
                campaign_difficulty: contentHeader.metadata.campaign_data?.campaign_difficulty,
                campaign_insertion_point: contentHeader.metadata.campaign_data?.campaign_insertion_point,
                campaign_metagame_scoring: contentHeader.metadata.campaign_data?.campaign_metagame_scoring,
                campaign_primary_skulls: contentHeader.metadata.campaign_data?.campaign_primary_skulls,
                campaign_secondary_skulls: contentHeader.metadata.campaign_data?.campaign_secondary_skulls,
                firefight_difficulty: contentHeader.metadata.firefight_data?.firefight_difficulty,
                firefight_secondary_skulls: contentHeader.metadata.firefight_data?.firefight_secondary_skulls,
            }
        });
    }

    public viewFileShare = async (viewerXuid: BigInt, shareXuid: BigInt, locale: string) => {

        
        if (!IS_FILESHARE_ENABLED) {
            const fileCatalogSchema = blf.createFileSchema([
                HaloReach.v12065.s_blf_chunk_start_of_file,
                blf.createChunkSchema({
                    name: 'fitm',
                    majorVersion: 4,
                    minorVersion: 0,
                    endian: 'big',
                    pack: 1,
                    fields: [
                        { name: 'online_file_listing', type: HaloReach.v12065.s_online_file_listing(0, FILESHARE_UNAVAILABLE_MESSAGE.length) },
                    ],
                }),
                HaloReach.v12065.s_blf_chunk_end_of_file,
              ]);

            return fileCatalogSchema.write({
                _blf: {
                    name: 'test',
                    byte_order_mark: 0xfffe,
                },
                fitm: {
                    online_file_listing: {
                        xuid: 0n,
                        gamertag: '',
                        entry_count: 0,
                        unknown1: 0,
                        unknown12: [0, 0, 0, 0, 0, 0, 0, 0],
                        quota_byte_count: 0,
                        quota_slot_count: 0,
                        slot_count: 0,
                        message_length: FILESHARE_UNAVAILABLE_MESSAGE.length,
                        entries: [],
                        message: FILESHARE_UNAVAILABLE_MESSAGE,
                    }
                },
                _eof: {
                    file_size: 0,
                    authentication_type: 0,
                }
            })
        }

        const ownsFileshare = viewerXuid === shareXuid;
        const fileShare = await this.getFileShare(viewerXuid, shareXuid);

        if (!fileShare) {
            const fileCatalogSchema = blf.createFileSchema([
                HaloReach.v12065.s_blf_chunk_start_of_file,
                blf.createChunkSchema({
                    name: 'fitm',
                    majorVersion: 4,
                    minorVersion: 0,
                    endian: 'big',
                    pack: 1,
                    fields: [
                        { name: 'online_file_listing', type: HaloReach.v12065.s_online_file_listing(0, 0) },
                    ],
                }),
                HaloReach.v12065.s_blf_chunk_end_of_file,
              ]);

            return fileCatalogSchema.write({
                _blf: {
                    name: 'test',
                    byte_order_mark: 0xfffe,
                },
                fitm: {
                    online_file_listing: {
                        xuid: 0n,
                        gamertag: '',
                        entry_count: 0,
                        unknown1: 0,
                        unknown12: [0, 0, 0, 0, 0, 0, 0, 0],
                        quota_byte_count: 0,
                        quota_slot_count: 0,
                        slot_count: 0,
                        message_length: 0,
                        entries: [],
                        message: '',
                    }
                },
                _eof: {
                    file_size: 0,
                    authentication_type: 0,
                }
            })
        }

        let listing_entries: c.infer<typeof HaloReach.v12065.s_online_file_metadata>[] = [];

        const fileShareFiles = await this.prisma.reach_file_share_file.findMany({
            where: {
                share_id: shareXuid.toString(),
                is_uploaded: true,
            }
        });

        if (fileShareFiles) {
            const fileshareFolder = join(
                process.cwd(),
                HALOREACH_FILESHARE_FOLDER,
                xuidToHexString(shareXuid),
            );

            for (const file of fileShareFiles) {
                try {
                    await access(join(fileshareFolder, BigInt(file.id.toString()).toString(16).padStart(16, '0')))

                    const entry: c.infer<typeof HaloReach.v12065.s_online_file_metadata> = {
                        general: {
                            id: BigInt(file.id.toString()),
                            file_type: file.file_type ?? 0,
                            unknown1: 0,
                            megalo_category_index: file.megalo_category_index ?? 0,
                            unknown2: 0,
                            size_in_bytes: file.size_in_bytes?.toNumber() ?? 0,
                            activity: file.activity ?? 0,
                            game_mode: file.game_mode ?? 0,
                            game_engine_type: file.game_engine_type ?? 0,
                            unknown3: [0, 0, 0, 0, 0, 0, 0, 0],
                            map_id: file.map_id ?? 0,
                        },
                        created: {
                            timestamp: file.created_at ?? new Date(),
                            xuid: 0n,
                            name: file.creator_name ?? '',
                            is_online: file.creator_is_xuid_online ? 1 : 0,
                        },
                        modified: {
                            timestamp: file.modified_at ?? new Date(),
                            xuid: 0n,
                            name: file.modifier_name ?? '',
                            is_online: file.modifier_is_xuid_online ? 1 : 0,
                        },
                        name: file.name ?? '',
                        description: file.description ?? '',
                        game_variant_or_film: file.file_type == 3 ? {
                            film: {
                                seconds: file.length_seconds ?? 0,
                            },
                        } : file.file_type == 6 ? {
                            game_variant: {
                                icon_index: file.icon_index ?? 0,
                            },
                        } : {
                            pad: {}
                        },
                        matchmaking: file.activity == 3 ? {
                            metadata: {
                                hopper_identifier: file.hopper_identifier ?? 0,
                            },
                        } : {
                            pad: {}
                        },
                        campaign_or_firefight: file.game_mode == 1 ? {
                            campaign: {
                                campaign_id: file.campaign_id ?? 0,
                                campaign_difficulty: file.campaign_difficulty ?? 0,
                                campaign_metagame_scoring: file.campaign_metagame_scoring ?? 0,
                                campaign_insertion_point: file.campaign_insertion_point ?? 0,
                                campaign_primary_skulls: file.campaign_primary_skulls ?? 0,
                                campaign_secondary_skulls: file.campaign_secondary_skulls ?? 0,
                            },
                        } : file.activity == 2 ? {
                            firefight: {
                                firefight_difficulty: file.firefight_difficulty ?? 0,
                                firefight_primary_skulls: file.firefight_primary_skulls ?? 0,
                                firefight_secondary_skulls: file.firefight_secondary_skulls ?? 0,
                            },
                        } : {
                            pad: {}
                        },
                        unknown: 0,
                    };
                    listing_entries.push(entry);

                    console.log(listing_entries[1].game_variant_or_film);

                } catch (err) {
                    this.logger.error(`[FileShare] Failed to access file, share ${xuidToHexString(shareXuid)}, file ${serverIdToString(file.id)}`);
                }
            }
        }

        if (fileShare?.message) {
            if (ownsFileshare) {
                // The user has seen the message, destroy it to prevent repeats.
                await this.prisma.halo3_file_share.update({
                    where: {
                        share_id: shareXuid.toString(),
                    },
                    data: {
                        message: null
                    }
                })
            } else {
                // Dont show the message to other users.
                fileShare.message = null;
            }
        }

        const validEntries = listing_entries.filter((entry) => {
            if (!entry || typeof entry !== 'object') return false;
            if (!entry.general || typeof entry.general !== 'object') return false;
            if (typeof entry.general.id !== 'bigint') return false;
            if (!entry.created || !entry.modified) return false;
            if (typeof entry.name !== 'string' || typeof entry.description !== 'string') return false;
            return true;
        });
        const serializedEntries: c.infer<typeof HaloReach.v12065.s_online_file_metadata>[] = validEntries.map((entry) => ({
            general: {
                id: entry.general.id,
                file_type: entry.general.file_type,
                unknown1: entry.general.unknown1,
                megalo_category_index: entry.general.megalo_category_index,
                unknown2: entry.general.unknown2,
                size_in_bytes: entry.general.size_in_bytes,
                activity: entry.general.activity,
                game_mode: entry.general.game_mode,
                game_engine_type: entry.general.game_engine_type,
                unknown3: [...entry.general.unknown3] as [number, number, number, number, number, number, number, number],
                map_id: entry.general.map_id,
            },
            created: {
                timestamp: entry.created.timestamp,
                xuid: entry.created.xuid,
                name: entry.created.name,
                is_online: entry.created.is_online,
            },
            modified: {
                timestamp: entry.modified.timestamp,
                xuid: entry.modified.xuid,
                name: entry.modified.name,
                is_online: entry.modified.is_online,
            },
            name: entry.name,
            description: entry.description,
            game_variant_or_film: entry.game_variant_or_film,
            matchmaking: entry.matchmaking,
            campaign_or_firefight: entry.campaign_or_firefight,
            unknown: entry.unknown,
        }));

        const fileCatalogSchema = blf.createFileSchema([
            HaloReach.v12065.s_blf_chunk_start_of_file,
            blf.createChunkSchema({
                name: 'fitm',
                majorVersion: 4,
                minorVersion: 0,
                endian: 'big',
                pack: 1,
                fields: [
                    { name: 'online_file_listing', type: HaloReach.v12065.s_online_file_listing(serializedEntries.length, fileShare.message?.length ?? 0) },
                ],
            }),
            HaloReach.v12065.s_blf_chunk_end_of_file,
          ]);

        return fileCatalogSchema.write({
            _blf: {
                name: 'test',
                byte_order_mark: 0xfffe,
            },
            fitm: {
                online_file_listing: {
                    xuid: 0n,
                    gamertag: '',
                    entry_count: serializedEntries.length,
                    unknown1: 0,
                    unknown12: [0, 0, 0, 0, 0, 0, 0, 0],
                    quota_byte_count: fileShare.quota_bytes ?? HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA,
                    quota_slot_count: fileShare.quota_slots ?? HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA,
                    slot_count: serializedEntries.length,
                    message_length: fileShare.message?.length ?? 0,
                    entries: serializedEntries,
                    message: fileShare.message ?? '',
                }
            },
            _eof: {
                file_size: 0,
                authentication_type: 0,
            }
        })
    }

    public stageDownload = async (
        machineId: BigInt,
        downloaderXuid: BigInt,
        shareXuid: BigInt,
        serverId: BigInt,
        startPosition: number,
        fromAutoqueue: number,
        view: number,
        preview: number,
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        const fileShareSlot = await this.prisma.reach_file_share_file.findUnique({
            where: {
                id_share_id: {
                    id: serverId.toString(),
                    share_id: shareXuid.toString(),
                }
            }
        });

        if (!fileShareSlot) {
            throw new NotFoundException("File not found.")
        }

        const downloadParams = new URLSearchParams({
            userId: xuidToHexString(downloaderXuid),
            shareId: xuidToHexString(shareXuid),
            startPosition: startPosition.toString(),
            serverId: serverIdToString(serverId),
        });

        return dedent.withOptions({
            trimWhitespace: false,
        })(`\
            Size: ${fileShareSlot.compressed_size}
            FullSize: ${Number(fileShareSlot.size_in_bytes)}
            InitialUrl: ${DOWNLOAD_ENDPOINT}?${downloadParams.toString()}
        `);
    }

    public getDownloadStream = async (
        downloaderXuid: BigInt,
        shareXuid: BigInt,
        serverId: BigInt,
        startPosition: number,
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            throw new ServiceUnavailableException();
        }

        const filePath = join(
            process.cwd(),
            HALOREACH_FILESHARE_FOLDER,
            xuidToHexString(shareXuid),
            serverIdToString(serverId),
        );

        try {
            await access(filePath);
            const size = (await stat(filePath)).size;
            return {
                stream: createReadStream(filePath, {
                    start: startPosition
                }),
                size
            }
        } catch (e) {
            throw new NotFoundException('File not found.')
        }
    }

    public deleteFile = async (userXuid: BigInt, shareXuid: BigInt, serverId: BigInt) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        if (userXuid !== shareXuid) {
            this.logger.error(`[FileShare] User ${userXuid} tried to delete file ${serverIdToString(serverId)} from share ${shareXuid}`)
            throw new UnauthorizedException();
        }

        if (!await this.prisma.reach_file_share_file.findUnique( {
            where: {
                id_share_id: {
                    share_id: shareXuid.toString(),
                    id: serverId.toString(),
                }
            }
        })) {
            // Sometimes the game send delete requests twice, so we need to handle that gracefully.
            return;
        }

        await this.prisma.reach_file_share_file.delete({
            where: {
                id_share_id: {
                    share_id: shareXuid.toString(),
                    id: serverId.toString(),
                }
            }
        })

        const filePath = join(
            process.cwd(),
            HALOREACH_FILESHARE_FOLDER,
            xuidToHexString(shareXuid),
            serverIdToString(serverId),
        )

        await rm(filePath);
    }
}

