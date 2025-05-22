import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp'
import { PrismaService } from "src/db/prisma.service";
import { HALO3_BUILD_NUMBER, HALO3_TU1_BUILD_NUMBER, HALO3_TU2_BUILD_NUMBER } from "./constants";
import { access, mkdir, rm, stat, writeFile } from "fs/promises";
import { join } from "path";
import { FILESHARE_FOLDER } from "../constants";
import dedent from "dedent";
import { Prisma } from "src/generated/prisma";
import { z } from "zod";
import { URLSearchParams } from "url";
import { h32 } from 'xxhashjs';
import { createReadStream } from "fs";
const IS_FILESHARE_ENABLED = true;
const FILESHARE_UNAVAILABLE_MESSAGE = 'Pardon our dust! File Share is currently Unavailable.'

const MEGABYTE = 1024 * 1024;
const UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA = 25 * MEGABYTE;
const UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA = 6;
const DOWNLOAD_ENDPOINT = '/gameapi/FilesDownload.ashx';

const OFFER_IDS = {
    HALO3_BUNGIE_PRO: 0x4D5307E60CCF002n,
    HALO3ODST_BUNGIE_PRO: 0x4D5308770CCF0002n,
    HALO3ODST_REACH_BETA: 0x4D5308770CCF0004n,
}

export const FileShareSlotFileTypeSchema = z.enum([
    'GameVariantCtf',
    'GameVariantSlayer',
    'GameVariantOddball',
    'GameVariantKing',
    'GameVariantJuggernaut',
    'GameVariantTerritories',
    'GameVariantAssault',
    'GameVariantInfection',
    'GameVariantVip',
    'MapVariant',
    'Film',
    'FilmClip',
    'Screenshot',
]);
type FileShareSlotFileType = z.infer<typeof FileShareSlotFileTypeSchema>;


type InvalidFileShareSlot = {
    number: number,
    id: string,
    state: 'Invalid'
}

type PartialFileShareSlot = {
    number: number,
    id: string,
    state: 'Partial'
    sizeBytes: number
}

type ReadyFileShareSlot = {
    number: number,
    id: string,
    state: 'Ready',
    name: string,
    author: string,
    authorXuid: bigint,
    authorXuidIsOnline: boolean,
    description: string,
    sizeBytes: bigint,
    fileType: FileShareSlotFileType,
    timestampSeconds: bigint,
    lengthSeconds: number,
    campaignId: number,
    mapId: number,
    gameEngineType: number,
    campaignDifficulty: number,
    gameId: bigint
}

type ODSTReadyFileShareSlot = ReadyFileShareSlot & {
    campaignInsertionPoint: number,
    campaignSurvivalEnabled: boolean,
}

type FileShareSlot = InvalidFileShareSlot | ReadyFileShareSlot | PartialFileShareSlot;
type ODSTFileShareSlot = InvalidFileShareSlot | ODSTReadyFileShareSlot | PartialFileShareSlot;

type FileShare = {
    quotaBytes: number,
    quotaSlots: number,
    visibleSlots: number,
    subscriptionHash: number,
    message?: string,
    slots: FileShareSlot[],
}

type ODSTFileShare = {
    quotaBytes: number,
    quotaSlots: number,
    visibleSlots: number,
    subscriptionHash: number,
    message?: string,
    slots: ODSTFileShareSlot[],
}

type FileShareSubscriptionStatus = 'NeverSubscribed' | 'Subscribed' | 'SubscribedRenew' | 'Expired';
type FileShareSubscription = {
    status: FileShareSubscriptionStatus,
    /** Offer ID which is opened when pressing the Bungie PRO button. */
    nextOfferId: bigint,
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
} | {
    status: FileShareSubscriptionStatus,
}

type ODSTFileShareSubscription = {
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

@Injectable()
export class Halo3FileShareService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    // If the fileshare subscription hash doesn't match the subscription hash, we refetch the subscription.
    private getShareSubscriptionHash = async (response: 'subscription' | 'fileshare', shareXuid: number): Promise<{
        currentHash: number,
        isUnsubscribing: boolean,
    }> => {
        const fileShare = await this.prisma.file_share.findUnique({
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

        console.log(`getting subscription hash for ${response}, returning ${currentHash}, unsubscribing = ${isUnsubscribing}`)
        
        await this.prisma.file_share.update({
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

    private fileCatalogResponse = (options: FileShare) => {
        const slotsResponse = options.slots.map(slot => {
            switch (slot.state) {
                case 'Ready':
                    return dedent(`
                        StartSlot: ${slot.number}
                          Guid: ${slot.id}
                          State: ${slot.state}
                          Name: ${slot.name}
                          Description: ${slot.description}
                          Author: ${slot.author}
                          AuthorXuid: ${slot.authorXuid}
                          AuthorXuidIsOnline: ${slot.authorXuidIsOnline ? 1 : 0}
                          SizeBytes: ${slot.sizeBytes}
                          FileType: ${slot.fileType}
                          SecondsPast19700101: ${slot.timestampSeconds}
                          LengthSeconds: ${slot.lengthSeconds}
                          CampaignID: ${slot.campaignId}
                          MapID: ${slot.mapId}
                          GameEngineType: ${slot.gameEngineType}
                          CampaignDifficulty: ${slot.campaignDifficulty}
                          GameID: ${slot.gameId}
                        EndSlot
                    `)
                case 'Partial':
                    return dedent(`
                        StartSlot: ${slot.number}
                          Guid: ${slot.id}
                          State: ${slot.state}
                          SizeBytes: ${slot.sizeBytes}
                        EndSlot
                    `);
                case 'Invalid':
                default:
                    return dedent(`
                        StartSlot: ${slot.number}
                          Guid: ${slot.id}
                          State: ${slot.state}
                        EndSlot
                    `)
            }
        }).join('\r\n')

        const shareResponse = dedent.withOptions({
            trimWhitespace: false,
        })(`\
                QuotaBytes: ${options.quotaBytes || 0}
                QuotaSlots: ${options.quotaSlots || 0}
                SlotCount: ${options.slots.length || 0}
                VisibleSlots: ${options.visibleSlots || 0}
                SubscriptionHash: ${options.subscriptionHash || 0}
                Message: ${options.message || ''}
            `)

        return `${shareResponse}${slotsResponse}\0`;
    }

    private fileCatalogResponseODST = (options: ODSTFileShare) => {
        const slotsResponse = options.slots.map(slot => {
            switch (slot.state) {
                case 'Ready':
                    return dedent(`
                        StartSlot: ${slot.number}
                          Guid: ${slot.id}
                          State: ${slot.state}
                          Name: ${slot.name}
                          Description: ${slot.description}
                          Author: ${slot.author}
                          AuthorXuid: ${slot.authorXuid}
                          AuthorXuidIsOnline: ${slot.authorXuidIsOnline ? 1 : 0}
                          CampaignInsertionPoint: ${slot.campaignInsertionPoint ?? 0}
                          SizeBytes: ${slot.sizeBytes}
                          FileType: ${slot.fileType}
                          SecondsPast19700101: ${slot.timestampSeconds}
                          LengthSeconds: ${slot.lengthSeconds}
                          CampaignID: ${slot.campaignId}
                          MapID: ${slot.mapId}
                          GameEngineType: ${slot.gameEngineType}
                          CampaignDifficulty: ${slot.campaignDifficulty}
                          CampaignSurvivalEnabled: ${slot.campaignSurvivalEnabled ? 1 : 0}
                          GameID: ${slot.gameId}
                        EndSlot
                    `)
                case 'Partial':
                    return dedent(`
                        StartSlot: ${slot.number}
                          Guid: ${slot.id}
                          State: ${slot.state}
                          SizeBytes: ${slot.sizeBytes}
                        EndSlot
                    `);
                case 'Invalid':
                default:
                    return dedent(`
                        StartSlot: ${slot.number}
                          Guid: ${slot.id}
                          State: ${slot.state}
                        EndSlot
                    `)
            }
        }).join('\r\n')

        const shareResponse = dedent.withOptions({
            trimWhitespace: false,
        })(`\
                QuotaBytes: ${options.quotaBytes || 0}
                QuotaSlots: ${options.quotaSlots || 0}
                SlotCount: ${options.slots.length || 0}
                VisibleSlots: ${options.visibleSlots || 0}
                SubscriptionHash: ${options.subscriptionHash || 0}
                Message: ${options.message || ''}
            `)

        return `${shareResponse}${slotsResponse}\0`;
    }

    private fileshareUnavailableResponse = (
        message: string = FILESHARE_UNAVAILABLE_MESSAGE
    ) => {
        return this.fileCatalogResponse({
            quotaBytes: 0,
            quotaSlots: 0,
            visibleSlots: 0,
            subscriptionHash: 0,
            message: message,
            slots: [],
        })
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
            `);
        }

        return dedent.withOptions({
            trimWhitespace: false,
        })(`\
            Status: ${subscription.status}
        `);
    }

    private fileshareSubscriptionResponseODST = (subscription: ODSTFileShareSubscription) => {
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

    public viewFileShare = async (viewerXuid: number, shareXuid: number, locale: string) => {
        if (!IS_FILESHARE_ENABLED) {
            return this.fileshareUnavailableResponse();
        }

        const ownsFileshare = viewerXuid === shareXuid;

        let fileShare = await this.prisma.file_share.findUnique({
            where: {
                share_id: shareXuid,
            }
        })

        if (!fileShare && ownsFileshare) {
            fileShare = await this.prisma.file_share.create({
                data: {
                    share_id: shareXuid,
                }
            })
        }

        if (!fileShare) {
            throw new NotFoundException("No file share.")
        }

        let slots: FileShareSlot[] = [];

        const fileShareSlots = await this.prisma.file_share_slot.findMany({
            where: {
                share_id: shareXuid
            }
        });

        if (fileShareSlots) {
            const fileshareFolder = join(
                process.cwd(),
                FILESHARE_FOLDER,
                shareXuid.toString(16).toUpperCase().padStart(16, '0'),
            );

            await Promise.all(fileShareSlots.map(async slot => {
                try {
                    await access(join(fileshareFolder, slot.slot.toString()))

                    // These fields are unavailable for some files still being uploaded.
                    if (slot.name !== null
                        && slot.description !== null
                        && slot.author !== null
                        && slot.length_seconds !== null
                        && slot.campaign_difficulty !== null
                        && slot.campaign_id !== null
                        && slot.map_id !== null
                        && slot.game_engine_type !== null
                        && slot.game_id !== null
                        && slot.date !== null
                        && slot.author_id !== null
                        && slot.author_is_xuid_online !== null
                    ) {
                        slots.push({
                            number: slot.slot,
                            id: slot.id,
                            state: 'Ready',
                            name: slot.name,
                            description: slot.description,
                            author: slot.author,
                            authorXuid: BigInt(String(slot.author_id)),
                            authorXuidIsOnline: slot.author_is_xuid_online,
                            sizeBytes: BigInt(String(slot.compressed_size)),
                            fileType: Object.values(FileShareSlotFileTypeSchema.Values)[slot.file_type - 1],
                            timestampSeconds: BigInt(String(Number(slot.date))),
                            lengthSeconds: slot.length_seconds,
                            campaignDifficulty: slot.campaign_difficulty,
                            campaignId: slot.campaign_id,
                            mapId: slot.map_id,
                            gameEngineType: slot.game_engine_type,
                            gameId: BigInt(String(Number(slot.game_id))),
                        })
                    }
                } catch (err) {
                    this.logger.error(`[FileShare] Failed to access file, share ${shareXuid}, slot ${slot.slot}`);
                    slots.push({
                        number: slot.slot,
                        state: 'Invalid',
                        id: slot.id,
                    })
                }
            }))
        }

        if (fileShare?.message) {
            if (ownsFileshare) {
                // The user has seen the message, destroy it to prevent repeats.
                await this.prisma.file_share.update({
                    where: {
                        share_id: shareXuid,
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

        let subscriptionHash = await this.getShareSubscriptionHash('fileshare', shareXuid);

        return this.fileCatalogResponse({
            quotaBytes: fileShare.quota_bytes || UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA,
            quotaSlots: fileShare.quota_slots || UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA,
            visibleSlots: fileShare.quota_slots || UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA,
            subscriptionHash: subscriptionHash.currentHash,
            message: fileShare.message ?? undefined,
            slots,
        });
    }

    public viewFileShareODST = async (viewerXuid: number, shareXuid: number, locale: string) => {
        if (!IS_FILESHARE_ENABLED) {
            return this.fileshareUnavailableResponse();
        }

        const ownsFileshare = viewerXuid === shareXuid;

        let fileShare = await this.prisma.file_share.findUnique({
            where: {
                share_id: shareXuid,
            }
        })

        if (!fileShare && ownsFileshare) {
            fileShare = await this.prisma.file_share.create({
                data: {
                    share_id: shareXuid,
                }
            })
        }

        if (!fileShare) {
            throw new NotFoundException("No file share.")
        }

        let slots: ODSTFileShareSlot[] = [];

        const fileShareSlots = await this.prisma.file_share_slot.findMany({
            where: {
                share_id: shareXuid
            }
        });

        if (fileShareSlots) {
            const fileshareFolder = join(
                process.cwd(),
                FILESHARE_FOLDER,
                shareXuid.toString(16).toUpperCase().padStart(16, '0'),
            );

            await Promise.all(fileShareSlots.map(async slot => {
                try {
                    await access(join(fileshareFolder, slot.slot.toString()))

                    // These fields are unavailable for some files still being uploaded.
                    if (slot.name !== null
                        && slot.description !== null
                        && slot.author !== null
                        && slot.length_seconds !== null
                        && slot.campaign_difficulty !== null
                        && slot.campaign_id !== null
                        && slot.map_id !== null
                        && slot.game_engine_type !== null
                        && slot.game_id !== null
                        && slot.date !== null
                        && slot.author_id !== null
                        && slot.author_is_xuid_online !== null
                    ) {
                        slots.push({
                            number: slot.slot,
                            id: slot.id,
                            state: 'Ready',
                            name: slot.name,
                            description: slot.description,
                            author: slot.author,
                            authorXuid: BigInt(String(slot.author_id)),
                            authorXuidIsOnline: slot.author_is_xuid_online,
                            sizeBytes: BigInt(String(slot.compressed_size)),
                            fileType: Object.values(FileShareSlotFileTypeSchema.Values)[slot.file_type - 1],
                            timestampSeconds: BigInt(String(Number(slot.date))),
                            lengthSeconds: slot.length_seconds,
                            campaignDifficulty: slot.campaign_difficulty,
                            campaignInsertionPoint: slot.campaign_insertion_point ?? 0,
                            campaignSurvivalEnabled: slot.campaign_survival_enabled ?? false,
                            campaignId: slot.campaign_id,
                            mapId: slot.map_id,
                            gameEngineType: slot.game_engine_type,
                            gameId: BigInt(String(Number(slot.game_id))),
                        })
                    }
                } catch (err) {
                    this.logger.error(`[FileShare] Failed to access file, share ${shareXuid}, slot ${slot.slot}`);
                    slots.push({
                        number: slot.slot,
                        state: 'Invalid',
                        id: slot.id,
                    })
                }
            }))
        }

        if (fileShare?.message) {
            if (ownsFileshare) {
                // The user has seen the message, destroy it to prevent repeats.
                await this.prisma.file_share.update({
                    where: {
                        share_id: shareXuid,
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

        let subscriptionHash = await this.getShareSubscriptionHash('fileshare', shareXuid);

        return this.fileCatalogResponseODST({
            quotaBytes: fileShare.quota_bytes || UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA,
            quotaSlots: fileShare.quota_slots || UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA,
            visibleSlots: fileShare.quota_slots || UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA,
            subscriptionHash: subscriptionHash.currentHash,
            message: fileShare.message ?? undefined,
            slots,
        });
    }

    public stageDownload = async (
        downloaderXuid: number,
        shareXuid: number,
        slot: number,
        serverId: string,
        startPosition: number,
        fromAutoqueue: number,
        view: number,
        preview: number,
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        const fileShareSlot = await this.prisma.file_share_slot.findUnique({
            where: {
                share_id_slot: {
                    share_id: shareXuid,
                    slot,
                }
            }
        });

        if (!fileShareSlot) {
            throw new NotFoundException("File not found.")
        }

        let downloadParams = new URLSearchParams({
            userId: downloaderXuid.toString().padStart(16, '0'),
            shareId: shareXuid.toString(16).padStart(16, '0'),
            slot: slot.toString(),
            startPosition: startPosition.toString(),
            serverId,
        })

        return dedent(`
            Size: ${fileShareSlot.compressed_size}
            FullSize: ${Number(fileShareSlot.size_in_bytes)}
            InitialUrl: ${DOWNLOAD_ENDPOINT}?${downloadParams.toString()}
        `)
    }

    public getDownloadStream = async (
        downloaderXuid: number,
        shareXuid: number,
        slot: number,
        serverId: string,
        startPosition: number,
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            throw new ServiceUnavailableException();
        }

        const filePath = join(
            process.cwd(),
            FILESHARE_FOLDER,
            shareXuid.toString(16).toUpperCase().padStart(16, '0'),
            slot.toString(),
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
            FILESHARE_FOLDER,
            shareXuid.toString(16).toUpperCase().padStart(16, '0'),
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
        const subscriptionHash = await this.getShareSubscriptionHash('subscription', userXuid);
        
        if (subscriptionHash.currentHash || subscriptionHash.isUnsubscribing) {
            return this.fileshareSubscriptionResponse({
                status: !subscriptionHash.isUnsubscribing ? 'Subscribed' : 'Expired',
                subscriptionHash: subscriptionHash.currentHash,
                nextOfferId: OFFER_IDS.HALO3_BUNGIE_PRO,
                hqButton: 'Bungie Pro',
                hqMessage: 'Expand your file share with Bungie Pro!',
                fileShareButton: 'Bungie Pro',
                fileShareMessage: 'Expand your file share to 24 slots and 250 Megabytes of forged maps, saved films, screenshots or gametypes!',
                fileShareHelp: 'Press  to view Bungie Pro offers.',
                justSubscribedMessage: "Welcome to Bungie PRO!",
                currentlySubscribedMessage: 'You already have an active Bungie Pro subscription.',
                overQuotaMessage: 'You have exceeded your file-share quote. Please make more space before uploading new files.',
                subscriptionEndTimestamp: !subscriptionHash.isUnsubscribing ? BigInt(Number.MAX_SAFE_INTEGER) : 0n,
            })
        }
        
        return this.fileshareSubscriptionResponse({
            status: 'NeverSubscribed',
        })
    }

    public getSubscriptionODST = async (
        userXuid: number,
        locale: string,
        gameRegion?: number,
        profileRegion?: number,
        isDebug?: boolean,
    ) => {
        const subscriptionHash = await this.getShareSubscriptionHash('subscription', userXuid);

        if (subscriptionHash.currentHash || subscriptionHash.isUnsubscribing || isDebug) {
            return this.fileshareSubscriptionResponseODST({
                status: !subscriptionHash.isUnsubscribing ? 'Subscribed' : 'Expired',
                subscriptionHash: subscriptionHash.currentHash,
                nextOfferId: OFFER_IDS.HALO3ODST_BUNGIE_PRO,
                hqButton: 'Bungie Pro',
                hqMessage: 'Expand your file share with Bungie Pro!',
                fileShareButton: 'Bungie Pro',
                fileShareMessage: 'Expand your file share to 24 slots and 250 Megabytes of forged maps, saved films, screenshots or gametypes!',
                fileShareHelp: 'Press  to view Bungie Pro offers.',
                justSubscribedMessage: "Welcome to Bungie PRO!",
                currentlySubscribedMessage: 'You already have an active Bungie Pro subscription.',
                overQuotaMessage: 'You have exceeded your file-share quote. Please make more space before uploading new files.',
                subscriptionEndTimestamp: !subscriptionHash.isUnsubscribing ? BigInt(Number.MAX_SAFE_INTEGER) : 0n,
                portalButton: 'PLAY THE BETA',
                portalExecuteImageFileName: "Portal Execute Image File Name",
                portalExecuteLaunchData: 123n,
                portalExecutePackageFileName: 'Portal Execute Package File Name',
                portalOfferCount: 1,
                portalOfferId: OFFER_IDS.HALO3ODST_REACH_BETA
            })
        }
        
        return this.fileshareSubscriptionResponse({
            status: 'NeverSubscribed',
        })
    }

    public initiateNewUpload = async (
        uploaderXuid: number,
        shareXuid: number,
        slot: number,
        uniqueId: number,
        fileType: number,
        uncompressedSize: number,
        compressedSize: number,
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        if (uploaderXuid !== shareXuid) {
            throw new UnauthorizedException("Can't upload to someone elses file share.")
        }

        // if the slot is already full they can't upload without first deleting.
        if (await this.prisma.file_share_slot.findUnique({ where: { share_id_slot: { share_id: shareXuid, slot } } })) {
            throw new BadRequestException('File share slot already full!');
        }

        const fileShareSlot = await this.prisma.file_share_slot.create({
            data: {
                share_id: shareXuid,
                slot,
                compressed_size: compressedSize,
                file_type: fileType,
                size_in_bytes: uncompressedSize,
                unique_id: uniqueId,
            }
        });

        this.logger.log(`[FileShare] User ${uploaderXuid} started uploading into slot ${slot}`);

        return fileShareSlot.id;
    }

    public deleteFile = async (userXuid: number, shareXuid, slot: number, serverId: string) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        if (userXuid !== shareXuid) {
            this.logger.error(`[FileShare] User ${userXuid} tried to delete file ${slot} from share ${shareXuid}`)
            throw new UnauthorizedException();
        }

        await this.prisma.file_share_slot.delete({
            where: {
                share_id_slot: {
                    share_id: shareXuid,
                    slot
                }
            }
        })

        const filePath = join(
            process.cwd(),
            FILESHARE_FOLDER,
            shareXuid.toString(16).toUpperCase().padStart(16, '0'),
            slot.toString(),
        )

        await rm(filePath);
    }

    public handleFileUpload = async (
        file: Express.Multer.File, 
        uploaderXuid: number, 
        shareXuid: number, 
        slot: number, 
        serverId: string
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        if (uploaderXuid !== shareXuid) {
            throw new UnauthorizedException("Can't upload to someone elses file share.")
        }

        const contentHeader = BLF.halo3_12070_08_09_05_2031_halo3_ship.read_content_header(file.buffer);
        if (!contentHeader) throw new BadRequestException('No header found for upload.');

        if (contentHeader.build_number !== HALO3_BUILD_NUMBER
            && contentHeader.build_number !== HALO3_TU1_BUILD_NUMBER
            && contentHeader.build_number !== HALO3_TU2_BUILD_NUMBER) {
            this.logger.warn(`[FileShare] Got a file with build number ${contentHeader.build_number}, rejecting.`)
            throw new BadRequestException("Bad Version: The file is unsupported.")
        }

        const destinationFolder = join(
            process.cwd(),
            FILESHARE_FOLDER,
            shareXuid.toString(16).toUpperCase().padStart(16, '0'),
        );
        await mkdir(destinationFolder, { recursive: true })
        await writeFile(join(
            destinationFolder,
            slot.toString(),
        ), file.buffer, { flag: 'a+' });
        await this.prisma.file_share_slot.update({
            where: {
                id: serverId,
            },
            data: {
                share_id: shareXuid,
                slot,
                compressed_size: file.buffer.length,

                author: contentHeader.metadata.author,
                author_id: contentHeader.metadata.author_id.toString(),
                author_is_xuid_online: contentHeader.metadata.author_is_xuid_online,
                campaign_difficulty: contentHeader.metadata.campaign_difficulty,
                campaign_id: contentHeader.metadata.campaign_id,
                date: contentHeader.metadata.date,
                description: contentHeader.metadata.description,
                file_type: contentHeader.metadata.file_type,
                game_engine_type: contentHeader.metadata.game_engine_type,
                game_id: contentHeader.metadata.game_id.toString(),
                hopper_id: contentHeader.metadata.hopper_id,
                length_seconds: contentHeader.metadata.length_seconds,
                map_id: contentHeader.metadata.map_id,
                name: contentHeader.metadata.name,
                size_in_bytes: contentHeader.metadata.size_in_bytes.toString(),
                unique_id: contentHeader.metadata.unique_id.toString(),
            }
        });
    }

    public handleFileUploadODST = async (
        file: Express.Multer.File, 
        uploaderXuid: number, 
        shareXuid: number, 
        slot: number,
        serverId: string,
    ) => {
        if (!IS_FILESHARE_ENABLED) {
            return new ServiceUnavailableException();
        }

        if (uploaderXuid !== shareXuid) {
            throw new UnauthorizedException("Can't upload to someone elses file share.")
        }

        const contentHeader = BLF.halo3odst_13895_09_04_27_2201_atlas_release.read_content_header(file.buffer);
        if (!contentHeader) throw new BadRequestException('No header found for upload.');

        if (contentHeader.build_number !== HALO3_BUILD_NUMBER
            && contentHeader.build_number !== HALO3_TU1_BUILD_NUMBER
            && contentHeader.build_number !== HALO3_TU2_BUILD_NUMBER) {
            this.logger.warn(`[FileShare] Got a file with build number ${contentHeader.build_number}, rejecting.`)
            throw new BadRequestException("Bad Version: The file is unsupported.")
        }

        const destinationFolder = join(
            process.cwd(),
            FILESHARE_FOLDER,
            shareXuid.toString(16).toUpperCase().padStart(16, '0'),
        );
        await mkdir(destinationFolder, { recursive: true })
        await writeFile(join(
            destinationFolder,
            slot.toString(),
        ), file.buffer, { flag: 'a+' });
        await this.prisma.file_share_slot.update({
            where: {
                id: serverId
            },
            data: {
                share_id: shareXuid,
                slot,
                compressed_size: file.buffer.length,

                author: contentHeader.metadata.author,
                author_id: contentHeader.metadata.author_id.toString(),
                author_is_xuid_online: contentHeader.metadata.author_is_xuid_online,
                campaign_difficulty: contentHeader.metadata.campaign_difficulty,
                campaign_id: contentHeader.metadata.campaign_id,
                date: contentHeader.metadata.date,
                description: contentHeader.metadata.description,
                file_type: contentHeader.metadata.file_type,
                game_engine_type: contentHeader.metadata.game_engine_type,
                game_id: contentHeader.metadata.game_id.toString(),
                length_seconds: contentHeader.metadata.length_seconds,
                map_id: contentHeader.metadata.map_id,
                name: contentHeader.metadata.name,
                size_in_bytes: contentHeader.metadata.size_in_bytes.toString(),
                unique_id: contentHeader.metadata.unique_id.toString(),
                campaign_insertion_point: contentHeader.metadata.campaign_insertion_point,
                campaign_survival_enabled: contentHeader.metadata.campaign_survival_enabled,
            }
        });
    }
}

