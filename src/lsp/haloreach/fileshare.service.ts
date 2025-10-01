import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp'
import { PrismaService } from "src/db/prisma.service";
import { access, mkdir, rm, stat, writeFile } from "fs/promises";
import { join } from "path";
import { FILESHARE_FOLDER, SCREENSHOTS_FOLDER } from "../../constants";
import dedent from "dedent";
import { h32 } from 'xxhashjs';
import { DiscordWebhookService } from "../services/discordwebhook.service";
import { xuidToHexString } from "src/xbox/xuid";
import { HALOREACH_BUILD_NUMBERS } from "./constants";
const IS_FILESHARE_ENABLED = true;
const FILESHARE_UNAVAILABLE_MESSAGE = 'Pardon our dust! File Share is currently Unavailable.'

const HALOREACH_FILESHARE_FOLDER = join(FILESHARE_FOLDER, 'haloreach');

const MEGABYTE = 1024 * 1024;
const UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA = 25 * MEGABYTE;
const UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA = 0;
const DOWNLOAD_ENDPOINT = '/gameapi/FilesStartDownload.ashx';

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

@Injectable()
export class HaloReachFileShareService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly discordWebhookService: DiscordWebhookService,
    ) { }

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
        return this.fileshareSubscriptionResponse({
            status: 'Subscribed',
        })
    }


    public handleBlindFileUpload = async (
        file: Express.Multer.File, 
        uploaderXuid: bigint, 
        machineId: bigint,
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
            || betaScreenshot.chdr.build_number == HALOREACH_BUILD_NUMBERS.BETA_PRIVATE
            || betaScreenshot.chdr.build_number == HALOREACH_BUILD_NUMBERS.ALPHA_PRIVATE
        )) {
            chdr = betaScreenshot.chdr;
            scnd = betaScreenshot._cmp;
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
        this.discordWebhookService.sendHalo3Screenshot({
            authorXuid: chdr.metadata.creator_xuid,
            authorName: chdr.metadata.creator_name,
            name: chdr.metadata.name,
            description: chdr.metadata.description,
            imageUrl: `http://xbl.lsp.blam.network:8080/haloreach/screenshots/${screenshotData.id}/view`
        }).catch((err) => this.logger.error(`Failed to send screenshot to discord: ${err}`))
    }
}

