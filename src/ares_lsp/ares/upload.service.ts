import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { AresCarnageReportService } from "./carnagereport.service";

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
export class AresUploadService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        @Inject() private readonly aresCarnageReportService: AresCarnageReportService,
    ) {}

    private isAresUpload = (
        upload: Express.Multer.File
    ) => HALO3_UPLOAD_MIME_REGEX.test(upload.mimetype)
    

    public handleUpload = async (
        upload: Express.Multer.File
    ) => {
        if (!this.isAresUpload(upload))
            return;

        switch (upload.mimetype) {
            case HALO3_UPLOAD_MIME_TYPES.MULTI:
                this.aresCarnageReportService.handleAresMultiUpload(upload)
                return;
            case HALO3_UPLOAD_MIME_TYPES.UPLOAD:
            case HALO3_UPLOAD_MIME_TYPES.EVENT:
            case HALO3_UPLOAD_MIME_TYPES.BAD_THING:
            case HALO3_UPLOAD_MIME_TYPES.QOS:
            case HALO3_UPLOAD_MIME_TYPES.TEST:
            case HALO3_UPLOAD_MIME_TYPES.CAMPAIGN:
                return;
            default:
                this.logger.log(`[Upload] Received unsupported Ares upload type. Skipping.`)
        }
    }
}