import ILogger, { ILoggerSymbol } from "src/ILogger";
import { CompressionService } from "./compression.service";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { Inject, Injectable } from "@nestjs/common";
import { UPLOADS_FOLDER } from "../../constants";

const ENABLE_DEBUG_MIME = false;
const DEBUG_MIME = 'application/x-halo3-multi'
const STORE_ALL_UPLOADS = true;

const SKIP_STORE_MIMES = [
    'application/x-halo3-multi',
    // 'application/x-halo3-campaign'
]

@Injectable()
export class UploadService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly compressionService: CompressionService,
    ) {}

    public handleDebug = (upload: Express.Multer.File) => {
        if (ENABLE_DEBUG_MIME && DEBUG_MIME && upload.mimetype === 'application/octet-stream') {
            upload.mimetype = DEBUG_MIME;
        }
    }

    public storeUploadedFile = async (upload: Express.Multer.File) => {
        if (!STORE_ALL_UPLOADS) return;
        if (SKIP_STORE_MIMES.includes(upload.mimetype)) return;
        
        const buffer = this.compressionService.inflateIfCompressed(upload);
        const uploadFolder = join(
            process.cwd(),
            UPLOADS_FOLDER,
            'debug',
            upload.mimetype.replace('application/', ''),
        )
        const uploadName = new Date().getTime().toString() + '_' + upload.originalname;
        this.logger.debug(`[UPLOAD] Recieved '${upload.mimetype}' file, saving as '${uploadName}'`)

        await mkdir(uploadFolder, { recursive: true });
    
        await writeFile(
            join(
                uploadFolder,
                uploadName,
            ),
            buffer,
        );
    }
}