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
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiConsumes, ApiProperty, ApiTags } from '@nestjs/swagger';
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

  @HttpCode(200)
  @Post('/stats.ashx')
  @UseInterceptors(FileInterceptor('upload'))
  async uploadStats(
    @UploadedFile() upload: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.uploadService.handleDebug(upload);
    this.uploadService.storeUploadedFile(upload)

    // TITLES:
    this.halo3UploadService.handleUpload(upload);

    res.status(200).send('');
  }

  @Post('/upload.ashx')
  @UseInterceptors(FileInterceptor('upload'))
  async uploadDump(
    @UploadedFile() upload: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    await writeFile(
      join(process.cwd(), 'uploads/crashes', upload.originalname),
      upload.buffer,
    );

    res.status(200).send('');
  }

  @Get('/sharedfiles/newupload.ashx')
  async newSharedFileUpload() {
    const serverId = 1;
    return serverId;
  }

  @Get('/sharedfiles/getuploadprogress.ashx')
  async getUploadProgress() {
    return 0;
  }

  @Post('/sharedfiles/upload.ashx')
  @UseInterceptors(FileInterceptor('upload'))
  async uploadFile(
    @UploadedFile() upload: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    await writeFile(
      join(
        process.cwd(),
        'uploads',
        'pimps_films',
        new Date().getTime().toString() + '_' + upload.originalname,
      ),
      upload.buffer,
    );

    res.status(200).send('');
  }
}
