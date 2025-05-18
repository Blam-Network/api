import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { basename, join } from 'path';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { stat } from 'fs/promises';
import { Response } from 'express';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { TITLE_STORAGE_FOLDER } from '../constants';

@ApiTags('Title Storage')
@Controller('/storage/title')
export class TitleStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
  ) {}

  @ApiOperation({
    summary: 'Static Title Storage',
    description: "Used to download static title storage files. These are mostly BLF files containing matchmaking playlist configuration, network configuration, MOTDs etc. \
      This endpoint is used for anything not dynamic.",
    externalDocs: {
      description: "Blam-Title-Storage (GitHub)",
      url: 'https://github.com/Blam-Network/Blam-Title-Storage'
    },
    parameters: [
      {
        name: 'path',
        example: '/tracked/12070/default_hoppers/en/motd_popup_image.jpg',
        in: 'path'
      }
    ]
  })
  @ApiParam({
    name: 'path',
    example: '/tracked/12070/default_hoppers/en/motd_popup_image.jpg',
    style: 'simple',
    allowReserved: true,
  })
  @Get('/:path')
  async getStaticFile(
    @Param('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = join(process.cwd(), TITLE_STORAGE_FOLDER, path);
    const fileName = basename(filePath);
    const stats = await stat(filePath);

    if (!stats.isFile()) throw new NotFoundException();

    res.set('Content-Length', stats.size.toString());
    res.set('Cache-Control', 'no-cache');

    return new StreamableFile(createReadStream(filePath), {disposition: `filename=${fileName}`});
  }
}
