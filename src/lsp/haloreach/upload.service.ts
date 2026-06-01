import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { HaloReachCarnageReportService } from "./carnagereport.service";

const HALO_REACH_UPLOAD_MIME_TYPES = {
    IDLS: 'application/x-reach-idls',
    EVENT: 'application/x-reach-event',
    RESULTS: 'application/x-reach-results',
    REWARD_SYNC: 'application/x-reach-reward-sync',
    SHAREDFILE: 'application/x-reach-sharedfile',
    SIGNBUFFER: 'application/x-reach-sign',
}

const HALO_REACH_UPLOAD_MIME_REGEX = /application\/x-reach.+$/

@Injectable()
export class HaloReachUploadService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly haloReachCarnageReportService: HaloReachCarnageReportService
    ) {}

    private isHaloReachUpload = (
        upload: Express.Multer.File
    ) => HALO_REACH_UPLOAD_MIME_REGEX.test(upload.mimetype)
    

    public handleUpload = async (
        upload: Express.Multer.File
    ) => {
        if (!this.isHaloReachUpload(upload))
            return;

        switch (upload.mimetype) {
            case HALO_REACH_UPLOAD_MIME_TYPES.RESULTS:
                await this.haloReachCarnageReportService.handleHaloReachResultsUpload(upload)
                return;
            case HALO_REACH_UPLOAD_MIME_TYPES.SIGNBUFFER:
            case HALO_REACH_UPLOAD_MIME_TYPES.IDLS:
            case HALO_REACH_UPLOAD_MIME_TYPES.SHAREDFILE:
                this.logger.log(`[Upload] Upload service received a file-share upload. Ignoring.`)
                return;
            case HALO_REACH_UPLOAD_MIME_TYPES.EVENT:
            case HALO_REACH_UPLOAD_MIME_TYPES.REWARD_SYNC:
            default:
                this.logger.log(`[Upload] Received unsupported Halo Reach upload type ${upload.mimetype}. Skipping.`)
        }
    }
}