import {
  Controller,
  Get,
  Inject,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import ILogger, { ILoggerSymbol } from '../../ILogger';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Halo3UserService } from '../halo3/user.service';
import { EXAMPLE_XUID } from '../constants';
import { HaloReachUserService } from '../haloreach/user.service';

@ApiTags('User Storage')
@Controller('/storage/user')
export class UserStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly halo3UserService: Halo3UserService,
    private readonly haloReachUserService: HaloReachUserService
  ) {}

  @ApiOperation({
    summary: 'Halo Reach User File',
    description: "Used to retrieve a Halo Reach user.bin BLF file. Typically required for gameplay.",
  })
  @Get('/:titleId/:unk1/:unk2/:unk3/:xuid/user.bin')
  @ApiParam({ name: 'xuid', example: EXAMPLE_XUID })
  async getOmahaUser(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const blfFile = this.haloReachUserService.getUserFile(xuid);

    return new StreamableFile(blfFile, { disposition: "filename=user.bin" });
  }

  @ApiOperation({
    summary: 'Halo Reach Recent Players',
    description: "Used to retrieve a Halo Reach recent_players.bin BLF file. Typically required for gameplay. We're not really sure what this data does yet.",
  })
  @Get('/:titleId/:unk1/:unk2/:unk3/:xuid/recent_players.bin')
  @ApiParam({ name: 'xuid', example: EXAMPLE_XUID })
  async getOmahaRecentPlayers(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const blfFile = this.haloReachUserService.getRecentPlayersFile(xuid);

    return new StreamableFile(blfFile, { disposition: "filename=recent_players.bin" });
  }

  @ApiOperation({
    summary: 'Halo 3 / ODST User File',
    description: "Used to retrieve a Halo 3 or Halo 3: ODST user.bin BLF file. Typically required for gameplay.",
  })
  @Get('/:unk1/:unk2/:unk3/:xuid/user.bin')
  @ApiParam({ name: 'xuid', example: EXAMPLE_XUID })
  async getHalo3User(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const blfFile = await this.halo3UserService.getUserFile(xuid);

    return new StreamableFile(blfFile, { disposition: "filename=user.bin" });
  }

  @ApiOperation({
    summary: 'Halo 3 Recent Players',
    description: "Used to retrieve a Halo 3 recent_players.bin BLF file. Typically required for gameplay. We're not really sure what this data does yet.",
  })
  @Get('/:unk1/:unk2/:unk3/:xuid/recent_players.bin')
  @ApiParam({ name: 'xuid', example: EXAMPLE_XUID })
  async getHalo3RecentPlayers(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const blfFile = await this.halo3UserService.getRecentPlayersFile(xuid);

    return new StreamableFile(blfFile, { disposition: "filename=recent_players.bin" });
  }
}
