import {
  Controller,
  Get,
  Inject,
  Query,
  Res,
  StreamableFile,
  NotFoundException,
  UseInterceptors,
  HttpCode,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import * as BLF from '@blam-network/blf_lsp';
import { FileInterceptor } from '@nestjs/platform-express';
import { EXAMPLE_XUID } from '../../constants';
import dedent from 'dedent';

@ApiTags('Game API Omaha')
@Controller('/gameapi_omaha')
export class GameApiOmahaController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
  ) { }

  @Get('/ArenaGetSeasonStats.ashx')
  @ApiTags('Halo: Reach')
  @ApiOperation({
    summary: 'Get Arena Season Statistics',
    description: 'Returns hopper statistics for the current Arena season. This is currently stubbed and returns an empty struct.',
  })
  @ApiQuery({ name: 'machineId', example: 'fa000022486dc405' })
  @ApiQuery({ name: 'players', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'version', example: 3 })
  async getArenaSeasonStats(
    @Query('machineId') machineId,
    @Query('players') players,
    @Query('version') version,
    @Res({ passthrough: true }) res,
  ) {
    const blfFile =  BLF.haloreach_12065_11_08_24_1738_tu1actual.build_arena_hopper_stats_file({
      data: new Array(0x16).fill(0, 0, 0x16),
    });

    return new StreamableFile(blfFile);
  }

  @HttpCode(200)
  @Post('/UserUpdateRewards.ashx')
  @ApiTags('Halo: Reach')
  @ApiOperation({
    summary: 'Update User Rewards',
    description: "We're not sure how this endpoint works yet, but it returns player unlocks and daily challenges, and the game sends up a BLF file. Currently stubbed to return everything unlocked and no challenges.",
  })
  @ApiQuery({ name: 'getDailyChallenges' })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'machineId' })
  @UseInterceptors(FileInterceptor('upload'))
  async getRewards(
    @UploadedFile() upload: Express.Multer.File,
    @Query('getDailyChallenges') getDailyChallenges,
    @Query('userId') userId,
    @Query('machineId') machineId,
    @Res({ passthrough: true }) res,
  ) {
    let rdpl: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_rewards_persistance = {
      unknown1: 20_000_000, // credits?,
      unknown2: new Array(0x20F).fill(1, 0, 0x20F), // unlocks related
      unknown3: 0,
      unknown4: 0,
    }

    let dcha: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_daily_challenges | undefined = undefined;

    const blfFile = BLF.haloreach_12065_11_08_24_1738_tu1actual.build_user_rewards_file(
      rdpl,
      dcha
    )

    return new StreamableFile(blfFile);
  }

  @Get('/UserGetBnetSubscription.ashx')
  @ApiOperation({
  summary: 'User Get Bungie.NET Subscription Info',
  description: "Returns information about the user's Bungie PRO subscription, if they have one.\
    We don't support File-Share for Halo: Reach yet, so this is stubbed.",
})
  @ApiTags('File Share')
  @ApiTags('Halo: Reach')
  @ApiQuery({ name: 'titleId', type: 'number' })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'locale', type: 'string', example: 'en' })
  async getBnetSubscription(
    @Query('titleId') titleID,
    @Query('userId') userID,
    @Query('locale') locale,
  ) {
    return `Status: Subscribed`;
  }

  @HttpCode(200)
  @Post('/UserUpdateImage.ashx')
  @ApiTags('Halo: Reach')
  @ApiOperation({
    description: 'We dont know anything about this endpoint yet.',
  })
  async userUpdateImage() {
    throw new NotFoundException();
  }

  @HttpCode(200)
  @Post('/CheckWhitelist.ashx')
  @ApiTags('Halo: Reach')
  @ApiQuery({ name: 'machineId', type: 'number' })
  @ApiQuery({ name: 'xuids', type: 'number' })
  @ApiOperation({
    summary: 'Check if the user is on the Whitelist.',
    description: 'Used in pre-release Halo: Reach. Not much is known about this yet.',
  })
  async checkWhitelist(
    @Query('xuids') xuids,
  ) {
    return dedent(`
      Allowed: 1
      AllowedXuid0: ${xuids}
      AllowedVIPXuid0: ${xuids}
      ErrorCode: 0
    `)
  }
}
