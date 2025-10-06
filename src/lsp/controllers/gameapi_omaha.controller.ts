import {
  Controller,
  Get,
  Inject,
  Query,
  Res,
  StreamableFile,
  UseInterceptors,
  HttpCode,
  Post,
  UploadedFile,
  NotImplementedException,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import * as BLF from '@blam-network/blf_lsp';
import { FileInterceptor } from '@nestjs/platform-express';
import { EXAMPLE_XUID } from '../../constants';
import { getExampleResponse, HaloReachWhitelistService } from '../haloreach/whitelist.service';
import { ParseXUIDPipe } from 'src/xbox/parse-xuid.pipe';
import dedent from 'dedent';
import { ParseXUIDArrayPipe } from 'src/xbox/parse-xuid-array.pipe';
import { parseBungieHeader } from '../parse-bungie-header.pipe';
import { hexStringXuidSchema } from 'src/xbox/xuid';
import { z } from 'zod';
import { UploadService } from '../services/upload.service';
import { HaloReachFileShareService } from '../haloreach/fileshare.service';

@ApiTags('Game API Omaha', 'Halo: Reach')
@Controller('/gameapi_omaha')
export class GameApiOmahaController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    @Inject() private readonly whitelist: HaloReachWhitelistService,
    @Inject() private readonly fileshareService :HaloReachFileShareService,
    @Inject() private readonly uploadService: UploadService,
  ) { }

  @Get('/ArenaGetSeasonStats.ashx')
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
      season: 1,
      unknown04: 0,
      unknown08: 0,
      unknown0C: 0,
      unknown10: 0,
      unknown14: 0,
    });

    return new StreamableFile(blfFile);
  }

  @HttpCode(200)
  @Post('/UserUpdateRewards.ashx')
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
  ) {
    let rdpl: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_rewards_persistance = {
      credits: 200_000_000, // credits?,
      unknown1: 0,
      commendations: new Array(128).fill(0),
      purchased_items: new Array(200).fill(1),
      unknown2: 0,
      unknown3: 0,
      unknown4: 0,
      unknown5: 0,
      unknown6: 0,
      unknown7: 0,
    }

    const blfFile = BLF.haloreach_12065_11_08_24_1738_tu1actual.build_user_rewards_file(
      rdpl, undefined
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
  @ApiQuery({ name: 'titleId', type: 'number' })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'locale', type: 'string', example: 'en' })
  async getBnetSubscription(
    @Query('titleId') titleID,
    @Query('userId') userID,
    @Query('locale') locale,
  ) {
    // Seems to use the same response format as ODST.
    return `Status: Subscribed`;
  }

  @HttpCode(200)
  @Post('/UserUpdateImage.ashx')
  @ApiOperation({
    description: 'When user image upload is enabled in network_configuration, images are uploaded here.',
  })
  async userUpdateImage(
    @Headers() headers: Record<string, string>,
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    if (!upload) throw new BadRequestException();

    const { machineid, userid } = z.object({
      machineid: parseBungieHeader(hexStringXuidSchema),
      userid: parseBungieHeader(hexStringXuidSchema),
    }).parse(headers);

    this.logger.log(`[MACHINE] Got user image upload for user ${userid} / machine ${machineid}`)
    this.logger.log(`[MACHINE] Mime type = ${upload.mimetype}`)

    await this.uploadService.handleDebug(upload);
    await this.uploadService.storeUploadedFile(upload);
  }

  @HttpCode(200)
  @Post('/SignBuffer.ashx')
  @ApiHeader({ name: 'userid', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'machineid', example: EXAMPLE_XUID })
  @ApiTags('File Share')
  @ApiOperation({
    description: 'We dont know anything about this endpoint yet.',
        deprecated: true // used to denote not-implemented.
  })
  async signBuffer() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesGetCatalog.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getFileshare() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesGetCatalogInfo.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getFileshareInfo() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesDelete.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async deleteFile() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesNewUpload.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async startFileUpload() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesGetUploadProgress.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getUploadProgress() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesTagItem.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async tagFile() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesGetDetails.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getFileDetails() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesGetPredefinedCount.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getPredefinedCount() {
    throw new NotImplementedException();
  }
  
  @HttpCode(200)
  @Get('/FilesGetPredefinedQuery.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getPredefinedQuery() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesReccomend.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async recommendFile() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesGetReccomendation.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getFileRecommendation() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesGetSearchCount.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getFileSearchCount() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesGetSearch.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getFileSearch() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/FilesUpload.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async uploadFile() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Post('/MachineUpdateNetworkStats.ashx')
  async machineUpdateNetworkStats(
    @Headers() headers: Record<string, string>,
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    if (!upload) throw new BadRequestException();

    const { machineid } = z.object({
      machineid: parseBungieHeader(hexStringXuidSchema),
    }).parse(headers);

    this.logger.log(`[MACHINE] Got machine network stats for machine ${machineid}`)
    this.logger.log(`[MACHINE] Mime type = ${upload.mimetype}`)

    await this.uploadService.handleDebug(upload);
    await this.uploadService.storeUploadedFile(upload);
  }

  @Post('/FilesUploadBlind.ashx')
  @ApiOperation({
    summary: 'Upload Halo: Reach Screenshot',
    description: "This endpoint is used to upload screenshots, when a screenshot is taken in game and the user is connected to the server, the screenshot is automatically uploaded.",
  })
  @ApiTags('File Share')
  @ApiHeader({ name: 'userid', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'machineid', example: EXAMPLE_XUID })
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
  @UseInterceptors(FileInterceptor('upload'))
  async uploadFileBlind(
    @Headers() headers,
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    if (!upload) throw new BadRequestException();

    const { userid: uploaderXuid, machineid: uploaderMachineId } = z.object({
      userid: parseBungieHeader(hexStringXuidSchema),
      machineid: parseBungieHeader(hexStringXuidSchema),
    }).parse(headers);

    // await this.uploadService.storeUploadedFile(upload);
    await this.fileshareService.handleBlindFileUpload(upload, uploaderXuid, uploaderMachineId);
  }

  @HttpCode(200)
  @Get('/FilesResumeDownload.ashx')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async resumeFileDownload() {
    throw new NotImplementedException();
  }


  @HttpCode(200)
  @Get('/UserGetServiceRecord.ashx')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getServiceRecord() {
    // I think this might return a blf file with a srid in it.
    throw new NotImplementedException();
  }

  @Get('/UserBeginConsume.ashx')
  @ApiOperation({
    summary: 'Bungie Pro - Complete Consume',
    description: "We're not sure what this endpoint does yet and it has never been called. It might be involved in letting Bungie.NET know when a user has bought Bungie PRO via the Xbox Marketplace.",
    deprecated: true,
  })
  @ApiTags('File Share')
  async userBeginConsume() {
    throw new NotImplementedException();
  }

  @Get('/UserCompleteConsume.ashx')
  @ApiOperation({
    summary: 'Bungie Pro - Complete Consume',
    description: "We're not sure what this endpoint does yet and it has never been called. It might be involved in letting Bungie.NET know when a user has bought Bungie PRO via the Xbox Marketplace.",
    deprecated: true,
  })
  @ApiTags('File Share')
  async userCompleteConsume() {
    throw new NotImplementedException();
  }

  @HttpCode(200)
  @Get('/CheckWhitelist.ashx')
  @ApiQuery({ name: 'machineId', type: 'number' })
  @ApiQuery({ name: 'xuids', type: 'number', description: 'xuids of players signed into each controller. 4 max.' })
  @ApiOperation({
    summary: 'Check if the users are on the Whitelist.',
    description: dedent(`
      Used in pre-release Halo: Reach to unlock the game.\r\n
      Players who are given VIP status have access to three keybinds:\r\n
      • Network Status Debug (CLAW)\r\n
      • Tracedump (doesn't work in release builds)\r\n
        - Might have 2 bindings for 2 different types of dump update_thread.bin and render_thread.bin.\r\n
      • Prevent Host Migration\r\n
        - if the player is hosting, they will never handover to another player. \r\n
    `),
    responses: {
      default:  {
        content: {
          'text/plain': {'example': getExampleResponse() }
        },
        description: 'Example response for allowing users to play.',
      }
    }
  })
  async checkWhitelist(
    @Query('machineId', ParseXUIDPipe) machineId: BigInt,
    @Query('xuids', ParseXUIDArrayPipe) xuids: BigInt[],
  ) {
    return await this.whitelist.getWhitelistResponse(machineId, xuids);
  }
}
