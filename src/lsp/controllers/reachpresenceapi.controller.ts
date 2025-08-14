import {
  Controller,
  Inject,
  StreamableFile,
  Post,
  HttpCode,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import * as BLF from '@blam-network/blf_lsp';

@ApiTags('Reach Presence API')
@Controller('/ReachPresenceApi')
export class ReachPresenceApiController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
  ) { }

  @HttpCode(200)
  @Post('/heartbeat.ashx')
  @ApiTags('Halo: Reach')
  @ApiOperation({
    summary: 'Post Halo: Reach Presence file',
    description: 'Uploads presence data and returns a heartbeat response file. Stubbed.',
  })
  async postHeartbeat() {
    const blfFile =  BLF.haloreach_12065_11_08_24_1738_tu1actual.build_heartbeat_response_file({
      unknown1: new Array(0x93).fill(0, 0, 0x93),
    });

    return new StreamableFile(blfFile);
  }
}
