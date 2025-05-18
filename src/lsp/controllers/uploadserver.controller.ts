import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  Get,
  Next,
  UploadedFiles,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiConsumes, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { inflate } from 'pako';
import { NextFunction, Response } from 'express';
import { UpdateServiceRecordCommand } from 'src/application/commands/UpdateServiceRecordCommand';
import UserID from 'src/domain/value-objects/UserId';
import * as BLF from '@blamnetwork/blf_lsp'
import { readPlayers } from 'src/infrastructure/presentation/blf/MultiplayerPlayers';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { PrismaService } from 'src/db/prisma.service';
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
    @UploadedFile() upload: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.uploadService.handleDebug(upload);
    this.uploadService.storeUploadedFile(upload);

    // TITLES:
    this.halo3UploadService.handleUpload(upload);

    res.status(200).send('');
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
    @UploadedFiles() uploads: Express.Multer.File[],
    @Res({ passthrough: true }) res: Response,
  ) {
    uploads.forEach(upload => {
      this.uploadService.handleDebug(upload);
      this.uploadService.storeUploadedFile(upload);

      // TITLES:
      this.halo3UploadService.handleUpload(upload);
    })

    res.status(200).send('');
  }
}
