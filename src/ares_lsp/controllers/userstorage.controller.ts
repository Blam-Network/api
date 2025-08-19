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
import { AresUserService } from '../ares/user.service';
import { EXAMPLE_XUID } from '../../constants';
import { ParseXUIDPipe } from 'src/xbox/parse-xuid.pipe';

@ApiTags('User Storage')
@Controller('/storage/user')
export class UserStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly halo3UserService: AresUserService,
  ) {}

  @ApiOperation({
    summary: 'User File',
    description: "Used to retrieve a user.bin BLF file. Typically required for gameplay.",
  })
  @Get('/:unk1/:unk2/:unk3/:xuid/user.bin')
  @ApiParam({ name: 'xuid', example: EXAMPLE_XUID })
  async getHalo3User(
    @Param('xuid') xuid: string,
  ) {
    const blfFile = await this.halo3UserService.getUserFile(xuid);

    return new StreamableFile(blfFile, { disposition: "filename=user.bin" });
  }

  @ApiOperation({
    summary: 'Recent Players',
    description: "Used to retrieve a recent_players.bin BLF file. Typically required for gameplay. We're not really sure what this data does yet.",
  })
  @Get('/:unk1/:unk2/:unk3/:xuid/recent_players.bin')
  @ApiParam({ name: 'xuid', type: 'string', example: EXAMPLE_XUID })
  async getHalo3RecentPlayers(
    @Param('xuid', ParseXUIDPipe) xuid: number,
  ) {
    const blfFile = await this.halo3UserService.getRecentPlayersFile(xuid);

    return new StreamableFile(blfFile, { disposition: "filename=recent_players.bin" });
  }
}
