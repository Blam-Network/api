import {
  Controller,
  Inject,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { AresUploadService } from '../ares/upload.service';
import { UploadService } from '../services/upload.service';
import { DatamineUploadService } from 'src/lsp/services/datamineupload.service';

@ApiTags('Upload Server')
@Controller('/upload_server')
export class UploadServerController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly uploadService: UploadService,
    private readonly halo3UploadService: AresUploadService,
    private readonly datamineUploadService: DatamineUploadService,
  ) {}

  @ApiOperation({
    summary: 'Upload File',
    description: "Use to upload typically a single file to the LSP. These are usually BLF files and include a mime-type describing their contents, like 'x-halo3-multi'.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        upload: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @HttpCode(200)
  @Post('/stats.ashx')
  @UseInterceptors(FileInterceptor('upload'))
  async uploadStats(
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    if (!upload) throw new BadRequestException();

    this.uploadService.handleDebug(upload);

    Promise.allSettled([
      this.uploadService.storeUploadedFile(upload),

      // TITLES:
      this.halo3UploadService.handleUpload(upload),
      this.datamineUploadService.handleUpload(upload),
    ]);

    return 'DONE';
  }

  @ApiOperation({
    summary: 'Upload Files',
    description: "Use to upload typically multiple crash files, these may have mime types like 'x-halo3-upload'.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        upload: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          }
        },
      },
    },
  })
  @Post('/upload.ashx')
  @UseInterceptors(FileInterceptor('upload'))
  async uploadDump(
    @UploadedFiles() uploads: Express.Multer.File[] | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!uploads) throw new BadRequestException();

    uploads.forEach(upload => {
      this.uploadService.handleDebug(upload);
      this.uploadService.storeUploadedFile(upload);

      // TITLES:
      this.halo3UploadService.handleUpload(upload);
    })

    return 'DONE';
  }
}
