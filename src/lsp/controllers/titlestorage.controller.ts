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
import { join } from 'path';
import { ApiTags } from '@nestjs/swagger';
import { stat } from 'fs/promises';
import { Response } from 'express';
import ILogger, { ILoggerSymbol } from 'src/ILogger';

@ApiTags('Title Storage')
@Controller('/storage/title')
export class TitleStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
  ) {}

  @Get('/:path')
  async getTitleStorageFile(
    @Param('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.sendLocalFile(
      path,
      res,
    );
  }

  private async sendLocalFile(path: string, res: Response) {
    path = join(process.cwd(), path);

    const stats = await stat(path);

    if (!stats.isFile()) throw new NotFoundException();

    res.set('Content-Length', stats.size.toString());
    res.set('Cache-Control', 'no-cache');
    return new StreamableFile(createReadStream(path));
  }
}
