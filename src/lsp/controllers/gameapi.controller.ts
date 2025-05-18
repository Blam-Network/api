import {
  Controller,
  Get,
  Inject,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { Halo3UserService } from '../halo3/user.service';
import { EXAMPLE_XUID } from '../constants';
import dedent from "dedent";

const TITLE_IDS = {
  LEGACY: 0,
  HALO3: 1,
  HALO3_MYTHIC: 2,
  HALO3_ODST: 3,
  HALO_ONLINE: 4,
}

@ApiTags('Game API')
@Controller('/gameapi')
export class GameApiController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly halo3UserService: Halo3UserService,
  ) {}

  @ApiOperation({
    summary: 'Get Halo 3 / ODST File Share',
    description: 'Returns a file share catalog for the given user ID.'
  })
  @Get('/FilesGetCatalog.ashx')
  @ApiQuery({ name: 'title', type: 'number', example: 1 })
  @ApiQuery({ name: 'shareId', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'locale', example: 'en' })
  async getFileshare(
    @Query('title', new DefaultValuePipe(0), ParseIntPipe) titleID,
    @Query('shareId') shareID,
    @Query('userId') userID,
    @Query('locale', new DefaultValuePipe('en')) locale,
  ) {
    return dedent(`
      QuotaBytes: 0
      QuotaSlots: 0
      SlotCount: 0
      VisibleSlots: 0
      SubscriptionHash: 0
      Message: Pardon our dust! File Share is currently Unavailable.\r\n
    `);
  }

  @ApiOperation({
    summary: 'Update Halo 3 User Highest Skill',
    description: 'Stores the provided highest skill for the provided Halo 3 user ID'
  })
  @Get('/UserUpdatePlayerStats.ashx')
  @ApiQuery({ name: 'title', type: 'number' })
  @ApiQuery({ name: 'userId' })
  @ApiQuery({ name: 'highestSkill', type: 'number' })
  async userUpdatePlayerStats(
    @Query('title', new DefaultValuePipe(0), ParseIntPipe) titleID,
    @Query('userId') userID,
    @Query('highestSkill') highestSkill,
  ) {
    switch (titleID) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
        return this.halo3UserService.updateHighestSkill(userID, highestSkill);
      case TITLE_IDS.LEGACY:
      case TITLE_IDS.HALO3_ODST:
      case TITLE_IDS.HALO_ONLINE:
        this.logger.warn(`[GAMEAPI] Updating player stats is not supported for title ${titleID}.`)
      default:
        this.logger.error(`[GAMEAPI] Tried to update player stats for unknown title ${titleID}.`)
        return;
    }
  }
}
