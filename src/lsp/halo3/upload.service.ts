import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { Halo3CarnageReportService } from "./carnagereport.service";

const HALO3_UPLOAD_MIME_TYPES = {
    MULTI: 'application/x-halo3-multi',
    QOS: 'application/x-halo3-qos',
    CAMPAIGN: 'application/x-halo3-campaign',
    TEST: 'application/x-halo3-test',
    BAD_THING: 'application/x-halo3-bad-thing',
    EVENT: 'application/x-halo3event',
    UPLOAD: 'application/x-halo3-upload' // crashes I think
}

const HALO3_UPLOAD_MIME_REGEX = /application\/x-halo3.+$/

@Injectable()
export class Halo3UploadService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly halo3CarnageReportService: Halo3CarnageReportService
    ) {}

    private isHalo3Upload = (
        upload: Express.Multer.File
    ) => HALO3_UPLOAD_MIME_REGEX.test(upload.mimetype)
    

    public handleUpload = async (
        upload: Express.Multer.File
    ) => {
        if (!this.isHalo3Upload(upload))
            return;

        switch (upload.mimetype) {
            case HALO3_UPLOAD_MIME_TYPES.MULTI:
                await this.halo3CarnageReportService.handleHalo3MultiUpload(upload)
                return;
            case HALO3_UPLOAD_MIME_TYPES.CAMPAIGN:
                await this.halo3CarnageReportService.handleHalo3CampaignUpload(upload)
                return;
            case HALO3_UPLOAD_MIME_TYPES.UPLOAD:
            case HALO3_UPLOAD_MIME_TYPES.EVENT:
            case HALO3_UPLOAD_MIME_TYPES.BAD_THING:
            case HALO3_UPLOAD_MIME_TYPES.QOS:
            case HALO3_UPLOAD_MIME_TYPES.TEST:
                return;
            default:
                this.logger.log(`[Upload] Received unsupported Halo 3 upload type. Skipping.`)
        }
    }
}