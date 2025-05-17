import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { Halo3CarnageReportService } from "./carnagereport.service";

const HALO3_UPLOAD_MIME_TYPES = {
    MULTI: 'application/x-halo3-multi'
}

const HALO3_UPLOAD_MIME_REGEX = /application\/x-halo3-.+$/

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
        }
    }
}