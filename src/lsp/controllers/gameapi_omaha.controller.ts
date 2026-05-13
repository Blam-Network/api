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
  ParseIntPipe,
  Param,
  InternalServerErrorException,
  DefaultValuePipe,
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
import { hexStringXuidSchema, xuidToHexString } from 'src/xbox/xuid';
import { z } from 'zod';
import { UploadService } from '../services/upload.service';
import { e_predefined_query, HaloReachFileShareService } from '../haloreach/fileshare.service';
import { HaloReachRewardsService } from '../haloreach/rewards.service';
import { HaloReachUserService } from '../haloreach/user.service';
import { HaloReachChallengeService } from '../haloreach/challenge.service';
import { blf } from 'src/blf';
import { c } from 'src/cstruct';
import { ParseBigIntPipe } from 'src/utils/parse-big-int.pipe';
import { HaloReach } from '../blf';
import { Response } from 'express';
import { PrismaService } from 'src/db/prisma.service';
import { find_chunk_in_file } from 'src/blf/helpers';

@ApiTags('Game API Omaha', 'Halo: Reach')
@Controller('/gameapi_omaha')
export class GameApiOmahaController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    @Inject() private readonly whitelist: HaloReachWhitelistService,
    @Inject() private readonly userService: HaloReachUserService,
    @Inject() private readonly fileshareService: HaloReachFileShareService,
    @Inject() private readonly uploadService: UploadService,
    @Inject() private readonly rewardsService: HaloReachRewardsService,
    @Inject() private readonly challengeService: HaloReachChallengeService,
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
    @Query('getDailyChallenges', ParseIntPipe) getDailyChallenges: number,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('machineId') machineId,
  ) {
    if (upload) {
      this.uploadService.storeUploadedFile(upload);
      let [rupl, chpr] = BLF.haloreach_12065_11_08_24_1738_tu1actual.read_rewards_upload(upload.buffer);
      this.logger.debug(`got rewards upload for ${userId} / ${rupl?.player_name || '<unknown>'} with credits ${rupl?.alltime_cookie_count}/${rupl?.cookies_earned_today_online}/${rupl?.cookies_earned_today_offline} modified at ${rupl?.last_modified_at.toString()}`)
      if (rupl) {
        await this.rewardsService.updatePlayerRewards(userId, rupl);
      }
      if (chpr) {
        await this.challengeService.updateChallengeProgress(userId, chpr);
      }
    }

    let rdpl = await this.rewardsService.getPlayerRewards(userId);

    let dcha: BLF.haloreach_12065_11_08_24_1738_tu1actual.s_blf_chunk_challenge_state | undefined = undefined;
    if (getDailyChallenges) {
      dcha = await this.challengeService.getActiveChallenges(userId);
    }

    const blfFile = BLF.haloreach_12065_11_08_24_1738_tu1actual.build_user_rewards_file(
      rdpl, dcha
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
  @UseInterceptors(FileInterceptor('upload'))
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
    description: 'Generates a hash for a new Halo: Reach UGC file. Used to verify file-share uploads.',
  })
  @UseInterceptors(FileInterceptor('upload'))
  async signBuffer(
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    // todo: check what the upload is, maybe xuid hash?
    if (!upload) throw new BadRequestException();
    
    return this.fileshareService.signFile(upload.buffer);
  }

  @HttpCode(200)
  @Get('/FilesGetCatalogInfo.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async getFileshare(
    @Query('machineId', ParseXUIDPipe) machineId: BigInt,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('shareId', ParseXUIDPipe) shareId: BigInt,
    @Query('shareIDs', ParseXUIDArrayPipe) shareIDs: BigInt[],
  ) {
    return this.fileshareService.getFileShareSummaries(userId, shareIDs);
  }

  @HttpCode(200)
  @Get('/FilesGetCatalog.ashx')
  @ApiTags('Halo: Reach')
  @ApiTags('File Share')
  @ApiOperation({
    summary: 'Get Halo: Reach File Share',
    description: 'Returns a file share catalog for the given user ID.'
  })
  @ApiQuery({ name: 'machineId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'locale', example: 'en' })
  async getFileshareInfo(
    @Query('machineId', ParseXUIDPipe) machineID: BigInt,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('locale', new DefaultValuePipe('en')) locale,
  ) {
    const fileCatalog = await this.fileshareService.viewFileShare(userID, shareID, locale);
    return new StreamableFile(fileCatalog);
  }

  @HttpCode(200)
  @Get('/FilesDelete.ashx')
  @ApiTags('File Share')
  @ApiTags('Halo: Reach')
  @ApiOperation({
    summary: "Delete Halo: Reach File",
    description: "Delete a file from a Halo 3 or ODST file share."
  })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'serverId' })
  async deleteFile(
    @Query('userId', ParseXUIDPipe) userid: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('serverId', ParseBigIntPipe) serverId: BigInt,
  ) {
    await this.fileshareService.deleteFile(userid, shareID, serverId);
    return "ok";
  }

  @HttpCode(200)
  @Get('/FilesNewUpload.ashx')
  @ApiTags('File Share')
  @ApiTags('Halo: Reach')
  @ApiQuery({ name: 'machineId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'uniqueId' })
  @ApiQuery({ name: 'fileType' })
  @ApiQuery({ name: 'uncompressedSize' })
  @ApiQuery({ name: 'compressedSize' })
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async startFileUpload(
    @Query('machineId', ParseXUIDPipe) machineId: BigInt,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('uniqueId', new ParseBigIntPipe({hex: true})) uniqueID: BigInt,
    @Query('fileType', ParseIntPipe) fileType: number,
    @Query('uncompressedSize', ParseIntPipe) uncompressedSize: number,
    @Query('compressedSize', ParseIntPipe) compressedSize: number,
  ) {
    const serverId = await this.fileshareService.initiateNewUpload(userID, shareID, uniqueID, fileType, uncompressedSize, compressedSize);
    return serverId;
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
  @ApiQuery({ name: 'machineId' })
  @ApiQuery({ name: 'userId' })
  @ApiQuery({ name: 'shareId' })
  @ApiQuery({ name: 'serverId' })
  @ApiQuery({ name: 'taghex' })
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  async tagFile(
    @Query('machineId', ParseXUIDPipe) machineId: BigInt,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('shareId', ParseXUIDPipe) shareId: BigInt,
    @Query('serverId', ParseXUIDPipe) serverId: BigInt,
    @Query('taghex') taghex: string,
  ) {
    const tag = Buffer.from(taghex, 'hex').toString('utf-8');
    await this.fileshareService.tagFile(userId, shareId, serverId, tag);
    return "ok";
  }

  @HttpCode(200)
  @Get('/FilesGetDetails.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    summary: 'Get Halo: Reach File Details',
    description: 'Returns details about a file in a Halo: Reach file share, including tags and thumbnails.',
  })
  @ApiQuery({ name: 'machineId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'locale', example: 'en' })
  @ApiQuery({ name: 'serverId', type: 'string', example: EXAMPLE_XUID })
  async getFileDetails(
    @Query('machineId', ParseXUIDPipe) machineID: BigInt,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('locale', new DefaultValuePipe('en')) locale,
    @Query('serverId', ParseXUIDPipe) serverId: BigInt,
  ) {
    const fileCatalog = await this.fileshareService.viewFileDetails(userID, shareID, serverId, locale);
    return fileCatalog;
  }

  @HttpCode(200)
  @Get('/FilesGetPredefinedCount.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    summary: 'Get Halo: Reach Predefined Query Summary',
    description: 'Returns a predefined query summary for the given user ID and search ID.',
  })
  @ApiQuery({ name: 'machineId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'searchID', type: 'number', example: e_predefined_query._predefined_query_most_downloaded_all_time })
  async getPredefinedCount(
    @Query('machineId', ParseXUIDPipe) machineId: BigInt,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('shareId', ParseXUIDPipe) shareId: BigInt,
    @Query('searchID', ParseIntPipe) searchID: number,
  ) {
    return this.fileshareService.getPredefinedQuerySummary(userId, searchID);
  }
  
  @HttpCode(200)
  @Get('/FilesGetPredefinedQuery.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    summary: 'Get Halo: Reach Predefined Query',
    description: 'Returns file share file listing for a predefined search.',
  })
  @ApiQuery({ name: 'machineId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'searchID', type: 'number', example: e_predefined_query._predefined_query_most_downloaded_all_time })
  @ApiQuery({ name: 'fileType', type: 'number', example: 5 })
  @ApiQuery({ name: 'page', type: 'number', example: 0 })
  @ApiQuery({ name: 'locale', example: 'en' })
  async getPredefinedQuery(
    @Query('machineId', ParseXUIDPipe) machineId: BigInt,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('shareId', ParseXUIDPipe) shareId: BigInt,
    @Query('searchID', ParseIntPipe) searchID: number,
    @Query('fileType', ParseIntPipe) fileType: number,
    @Query('page', ParseIntPipe) page: number,
    @Query('locale', new DefaultValuePipe('en')) locale,
  ) {
    return this.fileshareService.getPredefinedQuery(userId, shareId, searchID, fileType, page, locale);
  }

  @HttpCode(200)
  @Post('/FilesReccomend.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    description: 'Not yet implemented.',
    deprecated: true // used to denote not-implemented.
  })
  @ApiHeader({ name: 'machineid', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'serverid', example: EXAMPLE_XUID })
  @UseInterceptors(FileInterceptor('upload'))
  async recommendFile(
    @UploadedFile() upload: Express.Multer.File | undefined,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('shareId', ParseXUIDPipe) shareId: BigInt,
    @Query('serverId', ParseXUIDPipe) serverId: BigInt,
  ) {
    // Uploads an ilds 1.1 chunk which is a list of friend XUIDs
    if (!upload) throw new BadRequestException();

    await this.fileshareService.recommendFile(userId, shareId, serverId);

    return "ok";
  }

  @HttpCode(200)
  @Post('/FilesGetReccomendation.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    summary: 'Get Halo: Reach File Recommendation',
    description: 'Returns recommended files for the given user ID.',
  })
  @ApiQuery({ name: 'machineId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @UseInterceptors(FileInterceptor('upload'))
  async getFileRecommendation(
    @Query('machineId', ParseXUIDPipe) machineId: BigInt,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('shareId', ParseXUIDPipe) shareId: BigInt,
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    // Uploads an idls 1.1 chunk which is a list of friend XUIDs
    if (!upload) throw new BadRequestException();

    // TODO: move to blf_lsp
    const friends_count = find_chunk_in_file(upload.buffer, blf.createChunkSchema({
      name: 'idls',
      majorVersion: 1,
      minorVersion: 1,
      endian: 'big',
      pack: 1,
      fields: [ { name: 'friend_count', type: 'u32' } ],
    }))?.friend_count ?? 0;

    const idls = blf.createChunkSchema({
      name: 'idls',
      majorVersion: 1,
      minorVersion: 1,
      endian: 'big',
      pack: 1,
      fields: [
        { name: 'friend_count', type: 'u32' },
        { name: 'friend_xuid', type: 'u64', count: friends_count },
      ],
    });

    const friends = find_chunk_in_file(upload.buffer, idls)?.friend_xuid ?? [];

    return this.fileshareService.viewRecommendations(userId, friends);
  }

  @HttpCode(200)
  @Get('/FilesGetSearchCount.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    summary: 'Search Halo: Reach Files',
    description: 'Returns the number of files matching a search query.',
  })
  @ApiQuery({ name: 'machineId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'gamertaghex', type: 'string', required: false })
  @ApiQuery({ name: 'fileType', type: 'number', required: false })
  @ApiQuery({ name: 'authortaghex', type: 'string', required: false })
  @ApiQuery({ name: 'gameEngine', type: 'number', required: false })
  @ApiQuery({ name: 'megaloCategoryIndex', type: 'number', required: false })
  @ApiQuery({ name: 'fileAge', type: 'number', required: false }) // unused?
  @ApiQuery({ name: 'sortBy', type: 'number', required: false })
  @ApiQuery({ name: 'taghex0', type: 'string', required: false }) // doesnt seem possible to add more than one tag
  @ApiQuery({ name: 'mapId', type: 'number', required: false })
  async getFileSearchCount(
    @Query('machineId', ParseXUIDPipe) machineId: BigInt,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('shareId', ParseXUIDPipe) shareId: BigInt,
    @Query('gamertaghex') gamertaghex: string | undefined,
    @Query('fileType', new ParseIntPipe({optional: true})) fileType: number | undefined,
    @Query('authortaghex', new ParseIntPipe({optional: true})) authortaghex: number | undefined,
    @Query('gameEngine', new ParseIntPipe({optional: true})) gameEngine: number | undefined,
    @Query('megaloCategoryIndex', new ParseIntPipe({optional: true})) megaloCategoryIndex: number | undefined,
    @Query('fileAge', new ParseIntPipe({optional: true})) fileAge: number | undefined,
    @Query('sortBy', new ParseIntPipe({optional: true})) sortBy: number | undefined,
    @Query('taghex0', new ParseIntPipe({optional: true})) taghex0: number | undefined,
    @Query('mapId', new ParseIntPipe({optional: true})) mapId: number | undefined,
  ) {
    const hexStringSchema = z.string().regex(/^[0-9a-fA-F]+$/);

    const searchByGamertag = z.object({
      gamertaghex: hexStringSchema,
    }).transform(({ gamertaghex }) => ({
      gamertag: Buffer.from(gamertaghex, 'hex').toString('utf-8'),
    }));

    const customSearch = z
      .object({
        fileType: z.nativeEnum(HaloReach.v12065.FileType).optional(),
        authortaghex: hexStringSchema.optional(),
        gameEngine: z.nativeEnum(HaloReach.v12065.GameEngine).optional(),
        megaloCategoryIndex: z.number().optional(),
        fileAge: z.nativeEnum(HaloReach.v12065.FileAgeFilter).optional(),
        sortBy: z.nativeEnum(HaloReach.v12065.FileSortBy).optional(),
        taghex0: hexStringSchema.optional(),
        mapId: z.number().optional(),
      })
      .transform(
        ({
          fileType,
          authortaghex,
          gameEngine,
          megaloCategoryIndex,
          fileAge,
          sortBy,
          taghex0,
          mapId,
        }) => ({
          fileType,
          author: authortaghex ? Buffer.from(authortaghex, 'hex').toString('utf-8') : undefined,
          gameEngine,
          megaloCategoryIndex,
          fileAge,
          sortBy,
          tag: taghex0 ? Buffer.from(taghex0, 'hex').toString('utf-8') : undefined  ,
          mapId,
        }),
      );

    if (gamertaghex != null && gamertaghex !== '') {
      const { gamertag } = searchByGamertag.parse({ gamertaghex });
      return this.fileshareService.getfileShareSummary(userId, gamertag);
    }

    const searchParams = customSearch.safeParse({
      fileType,
      authortaghex,
      gameEngine,
      megaloCategoryIndex,
      fileAge,
      sortBy,
      taghex0,
      mapId,
    });

    if (!searchParams.success) {
      console.error(searchParams.error);
      throw new BadRequestException(searchParams.error.message);
    }

    return this.fileshareService.searchFileCount(
      userId,
      searchParams.data.fileType,
      searchParams.data.author,
      searchParams.data.gameEngine,
      searchParams.data.megaloCategoryIndex,
      searchParams.data.fileAge,
      searchParams.data.sortBy,
      searchParams.data.tag,
      searchParams.data.mapId,
    );
  }

  @HttpCode(200)
  @Get('/FilesGetSearch.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    summary: 'Search Halo: Reach Files',
    description: 'Returns a list of files matching a search query.',
  })
  @ApiQuery({ name: 'machineId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'gamertaghex', type: 'string', required: false })
  @ApiQuery({ name: 'fileType', type: 'number', required: false })
  @ApiQuery({ name: 'authortaghex', type: 'string', required: false })
  @ApiQuery({ name: 'gameEngine', type: 'number', required: false })
  @ApiQuery({ name: 'megaloCategoryIndex', type: 'number', required: false })
  @ApiQuery({ name: 'fileAge', type: 'number', required: false })
  @ApiQuery({ name: 'sortBy', type: 'number', required: false })
  @ApiQuery({ name: 'taghex0', type: 'string', required: false })
  @ApiQuery({ name: 'mapId', type: 'number', required: false })
  async getFileSearch(
    @Query('machineId', ParseXUIDPipe) machineId: BigInt,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('shareId', ParseXUIDPipe) shareId: BigInt,
    @Query('gamertaghex') gamertaghex: string | undefined,
    @Query('fileType', new ParseIntPipe({optional: true})) fileType: number | undefined,
    @Query('authortaghex', new ParseIntPipe({optional: true})) authortaghex: number | undefined,
    @Query('gameEngine', new ParseIntPipe({optional: true})) gameEngine: number | undefined,
    @Query('megaloCategoryIndex', new ParseIntPipe({optional: true})) megaloCategoryIndex: number | undefined,
    @Query('fileAge', new ParseIntPipe({optional: true})) fileAge: number | undefined,
    @Query('sortBy', new ParseIntPipe({optional: true})) sortBy: number | undefined,
    @Query('taghex0', new ParseIntPipe({optional: true})) taghex0: number | undefined,
    @Query('mapId', new ParseIntPipe({optional: true})) mapId: number | undefined,
    @Query('page', new ParseIntPipe({optional: true})) page: number | undefined,
  ) {
    const hexStringSchema = z.string().regex(/^[0-9a-fA-F]+$/);
    const searchByGamertag = z.object({
      gamertaghex: hexStringSchema,
    }).transform(({ gamertaghex }) => ({
      gamertag: Buffer.from(gamertaghex, 'hex').toString('utf-8'),
    }));

    const customSearch = z.object({
      fileType: z.nativeEnum(HaloReach.v12065.FileType).optional(),
      authortaghex: hexStringSchema.optional(),
      gameEngine: z.nativeEnum(HaloReach.v12065.GameEngine).optional(),
      megaloCategoryIndex: z.number().optional(),
      fileAge: z.nativeEnum(HaloReach.v12065.FileAgeFilter).optional(),
      sortBy: z.nativeEnum(HaloReach.v12065.FileSortBy).optional(),
      taghex0: hexStringSchema.optional(),
      mapId: z.number().optional(),
    }).transform(
      ({
        fileType,
        authortaghex,
        gameEngine,
        megaloCategoryIndex,
        fileAge,
        sortBy,
        taghex0,
        mapId,
      }) => ({
        fileType,
        author: authortaghex ? Buffer.from(authortaghex, 'hex').toString('utf-8') : undefined,
        gameEngine,
        megaloCategoryIndex,
        fileAge,
        sortBy,
        tag: taghex0 ? Buffer.from(taghex0, 'hex').toString('utf-8') : undefined,
        mapId,
      }),
    );

    if (gamertaghex != null && gamertaghex !== '') {
      const { gamertag } = searchByGamertag.parse({ gamertaghex });
      throw new NotImplementedException();
    }

    const searchParams = customSearch.safeParse({
      fileType,
      authortaghex,
      gameEngine,
      megaloCategoryIndex,
      fileAge,
      sortBy,
      taghex0,
      mapId,
    });

    if (!searchParams.success) {
      console.error(searchParams.error);
      throw new BadRequestException(searchParams.error.message);
    }

    return this.fileshareService.searchFiles(
      userId,
      searchParams.data.fileType,
      searchParams.data.author,
      searchParams.data.gameEngine,
      searchParams.data.megaloCategoryIndex,
      searchParams.data.fileAge,
      searchParams.data.sortBy,
      searchParams.data.tag,
      searchParams.data.mapId,
      page
    );
  }

  @HttpCode(200)
  @Post('/FilesUpload.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    summary: 'Upload Halo: Reach File',
    description: 'Uploads a file to a Halo: Reach file share.',
  })
  @ApiTags('Halo: Reach')
  @ApiHeader({ name: 'machineid', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'userid', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'shareid', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'serverid' })
  @UseInterceptors(FileInterceptor('upload'))
  async uploadFile(
    @Headers() headers,
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    if (!upload) throw new BadRequestException();

    const { machineid: machineId, userid: userId, shareid: shareId, serverid: serverId } = z.object({
      machineid: parseBungieHeader(hexStringXuidSchema),
      userid: parseBungieHeader(hexStringXuidSchema),
      shareid: parseBungieHeader(hexStringXuidSchema),
      serverid: parseBungieHeader(hexStringXuidSchema),
    }).parse(headers);

    console.log({headers})

    await this.fileshareService.handleFileUpload(upload, machineId, userId, shareId, serverId);

    return "ok";
  }

  @HttpCode(200)
  @Post('/MachineUpdateNetworkStats.ashx')
  @ApiOperation({
    summary: 'Update Halo: Reach Network Stats',
    description: 'Updates the network stats for a Halo: Reach player\'s machine.',
  })
  @ApiHeader({ name: 'machineid', example: EXAMPLE_XUID })
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

  @Get('/FilesStageForDownload.ashx')
  @ApiTags('File Share')
  @ApiTags('Halo: Reach')
  @ApiOperation({
    summary: 'Initiate Halo: Reach Download',
    description: 'Start downloading a file from a Halo: Reach fileshare. Returns the download URL and file size.',
  })
  @ApiQuery({ name: 'machineId', example: EXAMPLE_XUID, type: 'string' })
  @ApiQuery({ name: 'userId', example: EXAMPLE_XUID, type: 'string' })
  @ApiQuery({ name: 'shareId', example: EXAMPLE_XUID, type: 'string' })
  @ApiQuery({ name: 'serverId' })
  @ApiQuery({ name: 'startPosition' })
  @ApiQuery({ name: 'fromAutoQueue' })
  @ApiQuery({ name: 'view' })
  async stageFileDownload(
    @Query('machineId', ParseXUIDPipe) machineID: BigInt,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('serverId', ParseXUIDPipe) serverId: BigInt,
    @Query('startPosition', ParseIntPipe) startPosition: number,
    @Query('fromAutoQueue', ParseIntPipe) fromAutoQueue: number,
    @Query('view', new ParseIntPipe({optional: true})) view: number,
    @Query('preview', ParseIntPipe) preview: number,
  ) {
    return this.fileshareService.stageDownload(machineID, userID, shareID, serverId, startPosition, fromAutoQueue, view, preview);
  }

  @Get('/FilesStartDownload.ashx')
  @ApiOperation({
    summary: "Download Halo: Reach File",
    description: "Not an official endpoint but used by Halo. Download a file from a Halo: Reach file share. This endpoint isn't hardcoded, but we return it from FilesStageDownload.ashx."
  })
  @ApiTags('File Share')
  @ApiTags('Halo: Reach')
  @ApiHeader({ name: 'title' })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'serverId' })
  @ApiQuery({ name: 'startPosition' })
  async downloadFile(
    @Headers() headers,
    @Query('userId', ParseXUIDPipe) userid: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('serverId', ParseXUIDPipe) serverId: BigInt,
    @Query('startPosition', ParseIntPipe) startPosition: number,
    @Res() res: Response,
  ) {
    const {stream, size} = await this.fileshareService.getDownloadStream(userid, shareID, serverId, startPosition);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', size);
    res.writeHead(200)
    stream.pipe(res);
    stream.on('error', (err) => {
      this.logger.error(`[FileShare] Stream error: ${String(err)}`);
      res.status(500).end('Internal server error');
    });
    return;
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
    summary: 'Get Halo: Reach Service Record',
    description: 'Returns a Service Record for a Halo: Reach user.',
  })
  @ApiQuery({ name: 'machineId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  async getServiceRecord(
    @Query('machineId', ParseXUIDPipe) machineId: BigInt,
    @Query('shareId', ParseXUIDPipe) shareId: BigInt,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
  ) {
    return new StreamableFile(
      BLF.haloreach_12065_11_08_24_1738_tu1actual.build_service_record_file(
        await this.userService.getServiceRecord(userId)
      )
    );
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
