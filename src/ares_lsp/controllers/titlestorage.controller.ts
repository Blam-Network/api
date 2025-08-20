import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { basename, join } from 'path';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { stat } from 'fs/promises';
import { Response } from 'express';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { TITLE_STORAGE_FOLDER } from '../../constants';
import { AresPopulationService } from '../ares/population.service';

@ApiTags('Title Storage')
@Controller('/storage/title')
export class TitleStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly halo3PopulationService: AresPopulationService,
  ) {}

  @ApiOperation({
    summary: 'Population',
    description: "Returns a BLF file containing Matchmaking Hopper Statistics for Halo 3.",
  })
  @ApiParam({ name: 'tracked', example: "tracked" })
  @ApiParam({ name: 'build_number', example: "12065" })
  @ApiParam({ name: 'hopper_directory', example: "default_hoppers" })
  @Get('/tracked/:build_number/:hopper_directory/dynamic_hopper_statistics.bin')
  async getHalo3Population() {
    const blfFile = await this.halo3PopulationService.getHopperStatistics();
    return new StreamableFile(blfFile, { disposition: "filename=dynamic_hopper_statistics.bin" });
  }

  @ApiOperation({
    summary: 'Untracked Population',
    description: "Returns a BLF file containing Matchmaking Hopper Statistics for Halo 3.",
  })
  @ApiParam({ name: 'tracked', example: "tracked" })
  @ApiParam({ name: 'build_number', example: "12065" })
  @ApiParam({ name: 'hopper_directory', example: "default_hoppers" })
  @Get('/untracked/:username/:branch/:hopper_directory/dynamic_hopper_statistics.bin')
  async getUntrackedAresPopulation() {
    const blfFile = await this.halo3PopulationService.getHopperStatistics();
    return new StreamableFile(blfFile, { disposition: "filename=dynamic_hopper_statistics.bin" });
  }

  @ApiOperation({
    summary: 'Nightmap',
    description: "Returns the world map population image shown on Halo 3's Matchmaking menu..",
  })
  @Header('Content-Type', 'image/jpg')
  @Get('/tracked/:build_number/:hopper_directory/dynamic_matchmaking_nightmap.jpg')
  async getHalo3Nightmap() {
    const nightmap = await this.halo3PopulationService.getNightmap();
    return new StreamableFile(nightmap, { disposition: "filename=dynamic_matchmaking_nightmap.jpg" });
  }

  @ApiOperation({
    summary: 'Untracked Nignmap',
    description: "Returns the world map population image shown on Halo 3's Matchmaking menu.",
  })
  @Header('Content-Type', 'image/jpg')
  @Get('/ares/untracked/:username/:branch/:hopper_directory/dynamic_matchmaking_nightmap.jpg')
  async aresUntrackedNightmap() {
    const nightmap = await this.halo3PopulationService.getNightmap();
    return new StreamableFile(nightmap, { disposition: "filename=dynamic_matchmaking_nightmap.jpg" });
  }

  @ApiOperation({
    summary: 'Untracked Title Storage',
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
  async getAresUntrackedStaticFile(
    @Param('username') username: string,
    @Param('branch') branch: string,
    @Param('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = join(process.cwd(), TITLE_STORAGE_FOLDER, 'ares', 'untracked', username, branch, ...path);
    const fileName = basename(filePath);

    if (!existsSync(filePath)) throw new NotFoundException();

    const stats = await stat(filePath);

    if (!stats.isFile()) throw new NotFoundException();

    res.set('Content-Length', stats.size.toString());
    res.set('Cache-Control', 'no-cache');

    return new StreamableFile(createReadStream(filePath), {disposition: `filename=${fileName}`});
  }

  @ApiOperation({
    summary: 'Title Storage',
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
  @Get('/ares/tracked/:buildNumber/*path')
  async getStaticFile(
    @Param('buildNumber') buildNumber: string,
    @Param('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = join(process.cwd(), TITLE_STORAGE_FOLDER, 'ares', 'tracked', buildNumber, ...path);
    const fileName = basename(filePath);

    if (!existsSync(filePath)) throw new NotFoundException();

    const stats = await stat(filePath);

    if (!stats.isFile()) throw new NotFoundException();

    res.set('Content-Length', stats.size.toString());
    res.set('Cache-Control', 'no-cache');

    return new StreamableFile(createReadStream(filePath), {disposition: `filename=${fileName}`});
  }
}
