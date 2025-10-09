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
import { Halo3UploadService } from '../halo3/upload.service';
import { CompressionService } from '../services/compression.service';
import { UploadService } from '../services/upload.service';

@ApiTags('Upload Server')
@Controller('/upload_server')
export class UploadServerController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly uploadService: UploadService,
    private readonly halo3UploadService: Halo3UploadService,
    private readonly compressionService: CompressionService,
  ) { }

  @ApiOperation({
    summary: 'Upload File',
    description: "Use to upload typically a single file to the LSP. These are usually BLF files and include a mime-type describing their contents, like 'x-halo3-multi'.",
  })
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
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

    // This endpoint wants a swift response,
    // so we don't await this and respond while processing the uploaded data.
    Promise.allSettled([
      this.uploadService.storeUploadedFile(upload),

      // TITLES:
      this.halo3UploadService.handleUpload(upload),
    ]);

    return 'ok'
  }

  @ApiOperation({
    summary: 'Upload Files',
    description: "Use to upload typically multiple crash files, these may have mime types like 'x-halo3-upload'.",
  })
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
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
  @HttpCode(200)
  @Post('/upload.ashx')
  @UseInterceptors(FileInterceptor('upload'))
  async uploadDump(
    @UploadedFiles() uploads: Express.Multer.File[] | undefined,
  ) {
    if (!uploads) throw new BadRequestException();

    // This endpoint wants a swift response,
    // so we don't await this and respond while processing the uploaded data.
    Promise.allSettled(uploads.map((upload) =>
      Promise.allSettled([
        this.uploadService.handleDebug(upload),
        this.uploadService.storeUploadedFile(upload),

        // TITLES:
        this.halo3UploadService.handleUpload(upload),
      ])
    ));

    return 'ok';
  }
}
