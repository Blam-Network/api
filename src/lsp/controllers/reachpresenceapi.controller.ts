import {
  BadRequestException,
  Controller,
  HttpCode,
  Inject,
  NotImplementedException,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { UploadService } from 'src/lsp/services/upload.service';
import { find_chunk, write_blffile } from '@blamnetwork/blf';
import {
  s_blf_chunk_end_of_file,
  s_blf_chunk_network_lsp_heartbeat_data,
  s_blf_chunk_player_heartbeat_response,
  s_blf_chunk_start_of_file,
} from '@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual';
import { HaloReachPopulationService } from '../haloreach/population.service';

@ApiTags('Reach Presence API')
@Controller('/ReachPresenceApi')
export class ReachPresenceApiController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly uploadService: UploadService,
    private readonly populationService: HaloReachPopulationService,
  ) { }

  @HttpCode(200)
  @Post('/heartbeat.ashx')
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
  @ApiOperation({
    summary: 'Post Halo: Reach Presence file',
    description:
      'Accepts a phbt 6.0 presence heartbeat upload and returns a phbr heartbeat response.',
  })
  @UseInterceptors(FileInterceptor('upload'))
  async postHeartbeat(
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    if (!upload?.buffer?.length) {
      throw new BadRequestException('Missing presence heartbeat upload');
    }

    const phbt = new s_blf_chunk_network_lsp_heartbeat_data();
    if (!find_chunk(upload.buffer, phbt, 'big')) {
      throw new BadRequestException(
        `phbt 6.0 chunk not found in ${upload.buffer.length}-byte presence upload`,
      );
    }

    await this.populationService.recordPresenceHeartbeat(phbt);

    const phbr = new s_blf_chunk_player_heartbeat_response();

    const blfFile = write_blffile('big', [
      s_blf_chunk_start_of_file.create(''),
      phbr,
      new s_blf_chunk_end_of_file(),
    ]);

    return new StreamableFile(blfFile);
  }

  @HttpCode(200)
  @Post('/query.ashx')
  @ApiTags('Halo: Reach')
  @ApiOperation({
    description: 'We dont know anything about this endpoint yet.',
    deprecated: true // Deprecated to denote not implemented.
  })
  @UseInterceptors(FileInterceptor('upload'))
  async postQuery(
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    if (!upload?.buffer?.length) {
      throw new BadRequestException('Missing query upload');
    }

    await this.uploadService.handleDebug(upload);
    await this.uploadService.storeUploadedFile(upload);

    throw new NotImplementedException();
  }
}
