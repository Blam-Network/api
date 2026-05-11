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
  Get,
  Param,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { Halo3UploadService } from '../halo3/upload.service';
import { CompressionService } from '../services/compression.service';
import { UploadService } from '../services/upload.service';
import { TITLE_STORAGE_FOLDER } from 'src/constants';
import { basename, join } from 'path';
import { createReadStream, existsSync } from 'fs';
import { stat } from 'fs/promises';
import { DatamineUploadService } from '../services/datamineupload.service';
import { HaloReachUploadService } from '../haloreach/upload.service';

const HALO_UPLOAD_SUCCESS_RESPONSE = 'DONE';

@ApiTags('Upload Server')
@Controller('/upload_server')
export class UploadServerController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly uploadService: UploadService,
    private readonly halo3UploadService: Halo3UploadService,
    private readonly haloReachUploadService: HaloReachUploadService,
    private readonly compressionService: CompressionService,
    private readonly datamineUploadService: DatamineUploadService,
  ) { }

  @ApiOperation({
    summary: 'Upload File',
    description: "Use to upload typically a single file to the LSP. These are usually BLF files and include a mime-type describing their contents, like 'x-halo3-multi'.",
    responses: {
      '200': {
        content: {
          'text/plain': {
            schema: {
              type: 'string',
              example: HALO_UPLOAD_SUCCESS_RESPONSE,
            },
          },
        },
        description: 'File uploaded successfully',
      },
    },
  })
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiTags('Halo: Reach')
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
  ): Promise<typeof HALO_UPLOAD_SUCCESS_RESPONSE> {
    if (!upload) throw new BadRequestException();

    this.uploadService.handleDebug(upload);

    // This endpoint wants a swift response,
    // so we don't await this and respond while processing the uploaded data.
    Promise.allSettled([
      this.uploadService.storeUploadedFile(upload),

      // TITLES:
      this.halo3UploadService.handleUpload(upload),
      this.haloReachUploadService.handleUpload(upload),
      this.datamineUploadService.handleUpload(upload),
    ]);

    return HALO_UPLOAD_SUCCESS_RESPONSE;
  }

  @ApiOperation({
    summary: 'Upload Files',
    description: "Use to upload typically multiple crash files, these may have mime types like 'x-halo3-upload'.",
    responses: {
      '200': {
        content: {
          'text/plain': {
            schema: {
              type: 'string',
              example: HALO_UPLOAD_SUCCESS_RESPONSE,
            },
          },
        },
        description: 'Files uploaded successfully',
      },
    },
  })
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiTags('Halo: Reach')
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
  ): Promise<typeof HALO_UPLOAD_SUCCESS_RESPONSE> {
    // sometimes this endpoint is just used to post headers.
    if (!uploads) return HALO_UPLOAD_SUCCESS_RESPONSE;

    // This endpoint wants a swift response,
    // so we don't await this and respond while processing the uploaded data.
    Promise.allSettled(uploads.map((upload) =>
      Promise.allSettled([
        this.uploadService.handleDebug(upload),
        this.uploadService.storeUploadedFile(upload),

        // TITLES:
        this.halo3UploadService.handleUpload(upload),
        this.haloReachUploadService.handleUpload(upload),
        this.datamineUploadService.handleUpload(upload),
      ])
    ));

    return HALO_UPLOAD_SUCCESS_RESPONSE;
  }

  @ApiOperation({
    summary: 'Static Title Storage',
    description: "Used in early Halo 3 builds (pimps and prior) for title storage.",
    externalDocs: {
      description: "Blam-Title-Storage (GitHub)",
      url: 'https://github.com/Blam-Network/Blam-Title-Storage'
    },
    parameters: [
      {
        name: 'path',
        example: '/network_configuration_062.bin',
        in: 'path'
      }
    ]
  })
  @ApiParam({
    name: 'path',
    example: '/network_configuration_062.bin',
    style: 'simple',
    allowReserved: true,
  })
  @Get('/storage/default/*path')
  @ApiTags('Halo 3')
  async getStaticFile(
    @Param('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = join(process.cwd(), TITLE_STORAGE_FOLDER, 'tracked', '06481', 'default', ...path);
    const fileName = basename(filePath);

    if (!existsSync(filePath)) throw new NotFoundException();

    const stats = await stat(filePath);

    if (!stats.isFile()) throw new NotFoundException();

    res.set('Content-Length', stats.size.toString());
    res.set('Cache-Control', 'no-cache');

    return new StreamableFile(createReadStream(filePath), {disposition: `filename=${fileName}`});
  }
}
