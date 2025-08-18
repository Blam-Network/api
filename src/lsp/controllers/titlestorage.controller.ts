import {
  BadRequestException,
  Controller,
  Get,
  Header,
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
import { Halo3PopulationService } from '../halo3/population.service';
import { TitleID } from 'src/xbox/titles';
import { ParseHexPipe } from 'src/middleware/ParseHexPipe';
import * as BLF from '@blam-network/blf_lsp';

@ApiTags('Title Storage')
@Controller('/storage/title')
export class TitleStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly halo3PopulationService: Halo3PopulationService,
  ) {}

  @ApiOperation({
    summary: 'Halo Title Population',
    description: "Returns a BLF file containing Matchmaking Hopper Statistics for the provided Halo title ID.",
  })
  @ApiTags('Halo: Reach')
  @ApiParam({ name: 'title_id', example: TitleID.HALOREACH.toString(16).toLowerCase(), type: 'string' })
  @ApiParam({ name: 'tracked', example: "tracked" })
  @ApiParam({ name: 'build_number', example: "12065" })
  @ApiParam({ name: 'hopper_directory', example: "default_hoppers" })
  @Get('/:title_id/:tracked/:build_number/:hopper_directory/dynamic_pres_hopper_statistics.bin')
  async getHaloTitlePopulation(
    @Param('title_id', ParseHexPipe) titleId: number,
  ) {
    if (titleId === TitleID.HALOREACH) {
      const blfFile = BLF.haloreach_12065_11_08_24_1738_tu1actual.build_hopper_statistics_file({
        unknown_population_1: 0,
        unknown_population_2: 0,
        unknown_population_3: 0,
        hoppers: [],
      })

      return new StreamableFile(blfFile, { disposition: "filename=dynamic_pres_hopper_statistics.bin" });
    }

    throw new BadRequestException('Unsupported Title')
  }

  @ApiOperation({
    summary: 'Halo 3 Population',
    description: "Returns a BLF file containing Matchmaking Hopper Statistics for Halo 3.",
  })
  @ApiTags('Halo 3')
  @ApiParam({ name: 'tracked', example: "tracked" })
  @ApiParam({ name: 'build_number', example: "12065" })
  @ApiParam({ name: 'hopper_directory', example: "default_hoppers" })
  @Get('/:tracked/:build_number/:hopper_directory/dynamic_hopper_statistics.bin')
  async getHalo3Population() {
    const blfFile = await this.halo3PopulationService.getHopperStatistics();
    return new StreamableFile(blfFile, { disposition: "filename=dynamic_hopper_statistics.bin" });
  }

  @ApiOperation({
    summary: 'Halo 3 Nightmap',
    description: "Returns the world map population image shown on Halo 3's Matchmaking menu..",
  })
  @ApiTags('Halo 3')
  @Header('Content-Type', 'image/jpg')
  @Get('/tracked/:build_number/:hopper_directory/dynamic_matchmaking_nightmap.jpg')
  async getHalo3Nightmap() {
    const nightmap = await this.halo3PopulationService.getNightmap();
    return new StreamableFile(nightmap, { disposition: "filename=dynamic_matchmaking_nightmap.jpg" });
  }

  @ApiOperation({
    summary: 'Ares Untracked Nignmap',
    description: "Returns the world map population image shown on Halo 3's Matchmaking menu.",
  })
  @ApiTags('Ares')
  @Header('Content-Type', 'image/jpg')
  @Get('/ares/untracked/:username/:branch/:hopper_directory/dynamic_matchmaking_nightmap.jpg')
  async aresUntrackedNightmap() {
    const nightmap = await this.halo3PopulationService.getNightmap();
    return new StreamableFile(nightmap, { disposition: "filename=dynamic_matchmaking_nightmap.jpg" });
  }

  @ApiOperation({
    summary: 'Untracked Ares Static Title Storage',
    description: "Used to download static title storage files. These are mostly BLF files containing matchmaking playlist configuration, network configuration, MOTDs etc. \
      This endpoint is used for anything not dynamic.",
    externalDocs: {
      description: "Blam-Title-Storage (GitHub)",
      url: 'https://github.com/Blam-Network/Blam-Title-Storage'
    },
    parameters: [
      {
        name: 'path',
        example: '/default_hoppers/manifest_001.bin',
        in: 'path'
      }
    ]
  })
  @ApiParam({
    name: 'path',
    example: '/default_hoppers/manifest_001.bin',
    style: 'simple',
    allowReserved: true,
  })
  @Get('/ares/untracked/:username/:branch/*path')
  @ApiTags('Ares')
  async getAresUntrackedStaticFile(
    @Param('username') username: string,
    @Param('branch') branch: string,
    @Param('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = join(process.cwd(), TITLE_STORAGE_FOLDER, 'ares', username, branch, ...path);
    const fileName = basename(filePath);
    const stats = await stat(filePath);

    if (!stats.isFile()) throw new NotFoundException();

    res.set('Content-Length', stats.size.toString());
    res.set('Cache-Control', 'no-cache');

    return new StreamableFile(createReadStream(filePath), {disposition: `filename=${fileName}`});
  }

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
  @Get('/*path')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiTags('Halo: Reach')
  async getStaticFile(
    @Param('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = join(process.cwd(), TITLE_STORAGE_FOLDER, ...path);
    const fileName = basename(filePath);
    const stats = await stat(filePath);

    if (!stats.isFile()) throw new NotFoundException();

    res.set('Content-Length', stats.size.toString());
    res.set('Cache-Control', 'no-cache');

    return new StreamableFile(createReadStream(filePath), {disposition: `filename=${fileName}`});
  }
}
