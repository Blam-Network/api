import {
  Controller,
  Get,
  Inject,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
  Post,
  UseInterceptors,
  UploadedFile,
  Headers,
  Res,
  NotImplementedException,
  ParseBoolPipe,
  BadRequestException,
  HttpCode,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { Halo3UserService } from '../halo3/user.service';
import { EXAMPLE_XUID } from '../../constants';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../services/upload.service';
import { Request, Response } from 'express';
import { ParseXUIDPipe } from '../../xbox/parse-xuid.pipe';
import { Halo3FileShareService } from '../halo3/fileshare.service';
import { hexStringXuidSchema } from 'src/xbox/xuid';
import { z } from 'zod';
import { ParseBigIntPipe } from 'src/utils/parse-big-int.pipe';
import { dashedUuidFromHex } from 'src/utils/uuid';
import { UuidWithoutDashesPipe } from 'src/utils/uuid-without-dashes.pipe';

const TITLE_IDS = {
  LEGACY: 0,
  HALO3: 1,
  HALO3_MYTHIC: 2,
  HALO3_ODST: 3,
  HALO3_SHARE_CONTENT: 4,
  HALO_ONLINE: 5,
}

const parseBungieHeader = (schema: z.ZodTypeAny) => {
  return z.preprocess((val: unknown) => {
    if (typeof val !== 'string') return val;

    let str = val; // now str is string type

    if (str.startsWith('"')) {
      str = str.substring(1);
    }
    if (str.endsWith('"')) {
      str = str.substring(0, str.length - 1);
    }

    return str;
  }, schema);
};

@ApiTags('Game API')
@Controller('/gameapi')
export class GameApiController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly halo3UserService: Halo3UserService,
    private readonly uploadService: UploadService,
    private readonly halo3FileShareService: Halo3FileShareService,
  ) { }

  @ApiOperation({
    summary: 'Update Halo 3 User Highest Skill',
    description: 'Stores the provided highest skill for the provided Halo 3 user ID'
  })
  @Get('/UserUpdatePlayerStats.ashx')
  @ApiQuery({ name: 'title', type: 'number' })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'highestSkill', type: 'number' })
  async userUpdatePlayerStats(
    @Query('title', new DefaultValuePipe(TITLE_IDS.LEGACY), new ParseIntPipe({optional: true})) title,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('highestSkill', ParseIntPipe) highestSkill: number,
  ) {
    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
        return await this.halo3UserService.updateHighestSkill(userId, highestSkill);
      case TITLE_IDS.LEGACY:
      case TITLE_IDS.HALO3_ODST:
      case TITLE_IDS.HALO_ONLINE:
        this.logger.warn(`[GAMEAPI] Updating player stats is not supported for title ${title}.`)
      default:
        this.logger.error(`[GAMEAPI] Tried to update player stats for unknown title ${title}.`)
        throw new NotImplementedException();
    }
  }

  @ApiOperation({
    summary: 'Update Machine Network Statistics',
    description: 'Stores a user network statistics chunk for the provided machine. This is subsequently returned in the machine.bin file from machine storage.',
    externalDocs: { description: 'blf_lib - s_blf_chunk_user_network_statistics', url: 'https://github.com/Blam-Network/blf/blob/main/blf_lib/src/blf/chunks/halo3/v12070_08_09_05_2031_halo3_ship/s_blf_chunk_user_network_statistics.rs' }
  })
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
  @Post('/MachineUpdateNetworkStats.ashx')
  @ApiHeader({ name: 'title', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiHeader({ name: 'machineid' })
  @UseInterceptors(FileInterceptor('upload'))
  async machineUpdateNetworkStats(
    @Headers() headers: Record<string, string>,
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    if (!upload) throw new BadRequestException();

    const { title, machineid } = z.object({
      title: parseBungieHeader(z.coerce.number().default(TITLE_IDS.LEGACY)),
      machineid: parseBungieHeader(hexStringXuidSchema),
    }).parse(headers);

    this.logger.log(`[MACHINE] Got machine network stats for machine ${machineid}, title ${title}`)
    this.logger.log(`[MACHINE] Mime type = ${upload.mimetype}`)
    await this.uploadService.handleDebug(upload);
    await this.uploadService.storeUploadedFile(upload);
    // TODO: Store this
  }

  @ApiOperation({
    summary: 'Get Halo 3 / ODST File Share',
    description: 'Returns a file share catalog for the given user ID.'
  })
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @Get('/FilesGetCatalog.ashx')
  @ApiQuery({ name: 'title', type: 'number', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'locale', example: 'en' })
  async getFileshare(
    @Query('title', new DefaultValuePipe(TITLE_IDS.LEGACY), new ParseIntPipe({optional: true})) titleID,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('locale', new DefaultValuePipe('en')) locale,
  ) {
    switch (titleID) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.LEGACY:
        return this.halo3FileShareService.viewFileShare(userID, shareID, locale);
      case TITLE_IDS.HALO_ONLINE:
      case TITLE_IDS.HALO3_ODST:
        return this.halo3FileShareService.viewFileShareODST(userID, shareID, locale);
      default:
        throw new NotImplementedException();
    }
  }

  @Get('/FilesNewUpload.ashx')
  @ApiOperation({
    summary: 'Start Halo 3 / ODST File Upload',
    description: 'Begins a file share upload for Halo 3 / ODST. Returns the ID of the file.'
  })
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiQuery({ name: 'title', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'slot', example: 1 })
  @ApiQuery({ name: 'uniqueId' })
  @ApiQuery({ name: 'fileType' })
  @ApiQuery({ name: 'uncompressedSize' })
  @ApiQuery({ name: 'compressedSize' })
  async startFileUpload(
    @Query('title', new DefaultValuePipe(TITLE_IDS.LEGACY), new ParseIntPipe({optional: true})) title,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('slot', ParseIntPipe) slot: number,
    @Query('uniqueId', new ParseBigIntPipe({hex: true})) uniqueID: BigInt,
    @Query('fileType', ParseIntPipe) fileType: number,
    @Query('uncompressedSize', ParseIntPipe) uncompressedSize: number,
    @Query('compressedSize', ParseIntPipe) compressedSize: number,
  ) {
    // This function returns a server ID, but we don't really use it so it's not important.
    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.HALO3_ODST:
      case TITLE_IDS.LEGACY:
      case TITLE_IDS.HALO_ONLINE:
        const uuid = await this.halo3FileShareService.initiateNewUpload(
          userID,
          shareID,
          slot,
          uniqueID,
          fileType,
          uncompressedSize,
          compressedSize
        )
        return uuid.replace(/-/g, '');
      default:
        throw new NotImplementedException('Not implemented for provided title.');
    }
  }

  @Get('/UserGetBnetSubscription.ashx')
  @ApiOperation({
    summary: 'User Get Bungie.NET Subscription Info',
    description: "Returns information about the user's Bungie PRO subscription, if they have one.\
      Includes information like whether the Bungie PRO button appears in a file share or start menu, what text displays, alert messages for file share etc.",
  })
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiQuery({ name: 'title', type: 'number', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'locale', example: 'en' })
  @ApiQuery({ name: 'gameRegion', example: '0', description: 'ODST only', required: false })
  @ApiQuery({ name: 'profileRegion', example: '100', description: 'ODST only', required: false })
  @ApiQuery({ name: 'isDebug', example: 'false', description: 'ODST only', required: false })
  async getBnetSubscription(
    @Query('title', new DefaultValuePipe(TITLE_IDS.LEGACY), new ParseIntPipe({optional: true})) title: number,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('locale') locale: string,
    @Query('gameRegion', new ParseIntPipe({ optional: true })) gameRegion?: number,
    @Query('profileRegion', new ParseIntPipe({ optional: true })) profileRegion?: number,
    @Query('isDebug', new ParseBoolPipe({ optional: true })) isDebug?: boolean,
  ) {
    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.LEGACY:
        return await this.halo3FileShareService.getSubscription(userId, locale);
      case TITLE_IDS.HALO3_ODST:
        return await this.halo3FileShareService.getSubscriptionODST(userId, locale, gameRegion, profileRegion, isDebug);
      case TITLE_IDS.HALO_ONLINE:
        return await this.halo3FileShareService.getSubscriptionHaloOnline(userId, locale, gameRegion, profileRegion, isDebug);
      default:
        throw new NotImplementedException();
    }
  }

  @HttpCode(200)
  @Post('/FilesUpload.ashx')
  @ApiOperation({
    summary: 'Upload Halo 3 / ODST File',
    description: 'Uploads a file to a Halo 3 / ODST file share.',
  })
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
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiHeader({ name: 'title' })
  @ApiHeader({ name: 'userid', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'shareid', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'slot' })
  @ApiHeader({ name: 'serverid' })
  @UseInterceptors(FileInterceptor('upload'))
  async uploadFile(
    @Req() req: Request,
    @UploadedFile() upload: Express.Multer.File | undefined,
    @Headers() headers: Record<string, string>,
  ) {
    if (!upload) throw new BadRequestException();
    
    const { title, userid: uploaderXuid, shareid: shareXuid, slot, serverid, startposition } = z.object({
      title: parseBungieHeader(z.coerce.number().default(TITLE_IDS.LEGACY)),
      userid: parseBungieHeader(hexStringXuidSchema),
      shareid: parseBungieHeader(hexStringXuidSchema),
      slot: parseBungieHeader(z.coerce.number()),
      serverid: parseBungieHeader(dashedUuidFromHex),
      startposition: parseBungieHeader(z.coerce.number().optional())
    }).parse(headers);

    if (upload.buffer.length == 0 && startposition) {
      // it's probably finished so let's return OK.
      return;
    }

    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.LEGACY:
        await this.halo3FileShareService.handleFileUpload(upload, uploaderXuid, shareXuid, slot, serverid)
        break;
      case TITLE_IDS.HALO3_ODST:
      case TITLE_IDS.HALO_ONLINE:
        await this.halo3FileShareService.handleFileUploadODST(upload, uploaderXuid, shareXuid, slot, serverid)
        break;
      default:
        throw new NotImplementedException();
    }

    return "ok"
  }

  @Get('/FilesStageForDownload.ashx')
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiOperation({
    summary: 'Initiate Halo 3 / ODST File Download',
    description: 'Start downloading a file from a Halo 3 / ODST fileshare. Returns the download URL and file size.',
  })
  @ApiQuery({ name: 'titleId' })
  @ApiQuery({ name: 'userId', example: EXAMPLE_XUID, type: 'string' })
  @ApiQuery({ name: 'shareId', example: EXAMPLE_XUID, type: 'string' })
  @ApiQuery({ name: 'slot' })
  @ApiQuery({ name: 'serverId' })
  @ApiQuery({ name: 'startPosition' })
  @ApiQuery({ name: 'fromAutoQueue' })
  @ApiQuery({ name: 'view' })
  async stageFileDownload(
    @Query('title', new ParseIntPipe({optional: true}), new DefaultValuePipe(TITLE_IDS.LEGACY)) title: number,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('slot', ParseIntPipe) slot: number,
    @Query('serverId') serverId: string | undefined,
    @Query('startPosition', ParseIntPipe) startPosition: number,
    @Query('fromAutoQueue', ParseIntPipe) fromAutoQueue: number,
    @Query('view', new ParseIntPipe({optional: true})) view: number,
    @Query('preview', ParseIntPipe) preview: number,
  ) {

    // downloads fromAutoQueue pass a 64 bit int id. We don't use these.
    if (serverId) {
      if (serverId.length < 32) {
        serverId = undefined;
      } else {
        serverId = new UuidWithoutDashesPipe().transform(serverId, { type: 'custom' });
      }
    }

    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.HALO3_ODST:
      case TITLE_IDS.HALO_ONLINE:
      case TITLE_IDS.LEGACY:
        return await this.halo3FileShareService.stageDownload(
          userID,
          shareID,
          slot,
          serverId,
          startPosition,
          fromAutoQueue,
          view,
          preview
        );
      default:
        throw new NotImplementedException();
    }
  }

  @Get('/FilesStartDownload.ashx')
  @ApiOperation({
    summary: "Download Halo 3 / ODST File",
    description: "Not an official endpoint but used by Halo. Download a file from a Halo 3 or ODST file share. This endpoint isn't hardcoded, but we return it from FilesStageDownload.ashx."
  })
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiHeader({ name: 'title' })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'slot' })
  @ApiQuery({ name: 'serverId' })
  @ApiQuery({ name: 'startPosition' })
  async downloadFile(
    @Headers() headers,
    @Query('userId', ParseXUIDPipe) userid: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('slot', ParseIntPipe) slot: number,
    @Query('serverId', UuidWithoutDashesPipe) serverId: string,
    @Query('startPosition', ParseIntPipe) startPosition: number,
    @Res() res: Response,
  ) {
    const { title } = z.object({
      title: parseBungieHeader(z.coerce.number().default(TITLE_IDS.LEGACY)),
    }).parse(headers);

    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.HALO3_ODST:
      case TITLE_IDS.HALO_ONLINE:
      case TITLE_IDS.LEGACY:
        const { stream, size } = await this.halo3FileShareService.getDownloadStream(
          userid,
          shareID,
          slot,
          serverId,
          startPosition
        )
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', size);
        res.writeHead(200)
        stream.pipe(res);
        stream.on('error', (err) => {
          this.logger.error(`[FileShare] Stream error: ${String(err)}`);
          res.status(500).end('Internal server error');
        });
        return;
      default:
        throw new NotImplementedException();
    }
  }

  @Get('/FilesResumeDownload.ashx')
  @ApiOperation({
    summary: "Resume Halo 3 / ODST File Download",
    description: "Resume downloading a file from a Halo 3 or ODST file share. Same parameters as FilesStartDownload.ashx."
  })
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiHeader({ name: 'title' })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'slot' })
  @ApiQuery({ name: 'serverId' })
  @ApiQuery({ name: 'startPosition' })
  async resumeFileDownload(
    @Headers() headers,
    @Query('userId', ParseXUIDPipe) userid: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('slot', ParseIntPipe) slot: number,
    @Query('serverId', UuidWithoutDashesPipe) serverId: string,
    @Query('startPosition', ParseIntPipe) startPosition: number,
    @Res() res: Response,
  ) {
    const { title } = z.object({
      title: parseBungieHeader(z.coerce.number().default(TITLE_IDS.LEGACY)),
    }).parse(headers);

    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.HALO3_ODST:
      case TITLE_IDS.HALO_ONLINE:
      case TITLE_IDS.LEGACY:
        const { stream, size } = await this.halo3FileShareService.getDownloadStream(
          userid,
          shareID,
          slot,
          serverId,
          startPosition
        )
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', size);
        res.writeHead(200)
        stream.pipe(res);
        stream.on('error', (err) => {
          this.logger.error(`[FileShare] Stream error: ${String(err)}`);
          res.status(500).end('Internal server error');
        });
        return;
      default:
        throw new NotImplementedException();
    }
  }

  @Get('/FilesDelete.ashx')
  @ApiOperation({
    summary: "Delete Halo 3 / ODST File",
    description: "Delete a file from a Halo 3 or ODST file share."
  })
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiQuery({ name: 'title', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'slot', example: 1 })
  @ApiQuery({ name: 'serverId' })
  async deleteFile(
    @Query('title', new ParseIntPipe({optional: true}), new DefaultValuePipe(TITLE_IDS.LEGACY)) title: number,
    @Query('userId', ParseXUIDPipe) userid: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('slot', ParseIntPipe) slot: number,
    @Query('serverId', UuidWithoutDashesPipe) serverId: string,
  ) {
    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.HALO3_ODST:
      case TITLE_IDS.HALO_ONLINE:
      case TITLE_IDS.LEGACY:
        await this.halo3FileShareService.deleteFile(userid, shareID, slot, serverId);
        break;
      default:
        throw new NotImplementedException();
    }
    
    return "ok";
  }

  @Get('/FilesGetUploadProgress.ashx')
  @ApiOperation({
    summary: "Get Halo 3 / ODST File Upload Progress",
    description: "Returns bytes uploaded."
  })
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiQuery({ name: 'title', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'slot', example: 1 })
  @ApiQuery({ name: 'serverId' })
  async getUploadProgress(
    @Query('title', new ParseIntPipe({optional: true}), new DefaultValuePipe(TITLE_IDS.LEGACY)) title: number,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('slot', ParseIntPipe) slot: number,
    @Query('serverId', UuidWithoutDashesPipe) serverId: string,
  ) {
    serverId = dashedUuidFromHex.parse(serverId)
    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.HALO3_ODST:
      case TITLE_IDS.HALO_ONLINE:
      case TITLE_IDS.LEGACY:
        return await this.halo3FileShareService.getUploadProgress(userID, shareID, slot, serverId);
      default:
        throw new NotImplementedException();
    }
  }

  @HttpCode(200)
  @Post('/FilesUploadBlind.ashx')
  @ApiOperation({
    summary: 'Upload Halo 3 / ODST Screenshot',
    description: "This endpoint is used to upload screenshots, when a screenshot is taken in game and the user is connected to the server, the screenshot is automatically uploaded.",
  })
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiHeader({ name: 'title', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiHeader({ name: 'userid', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'gameid' })
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

    const { title, userid: uploaderXuid, gameid } = z.object({
      title: parseBungieHeader(z.coerce.number().default(TITLE_IDS.LEGACY)),
      userid: parseBungieHeader(hexStringXuidSchema),
      gameid: parseBungieHeader(z.coerce.bigint()),
    }).parse(headers);

    // This endpoint wants a swift response,
    // so we don't await this and respond while processing the uploaded data.
    (async () => {
      switch (title) {
        case TITLE_IDS.LEGACY:
        case TITLE_IDS.HALO3:
        case TITLE_IDS.HALO3_MYTHIC:
          return await this.halo3FileShareService.handleBlindFileUpload(upload, uploaderXuid, gameid);
        case TITLE_IDS.HALO3_ODST:
          return await this.halo3FileShareService.handleBlindFileUploadODST(upload, uploaderXuid, gameid);
        case TITLE_IDS.HALO_ONLINE:
          throw new NotImplementedException("Twister you mad lad")
        default:
          throw new NotImplementedException();
      }
    })().catch(e => this.logger.error(e));

    return "ok";
  }

  @Get('/UserBeginConsume.ashx')
  @ApiOperation({
    summary: 'Bungie Pro - Complete Consume',
    description: "We're not sure what this endpoint does yet and it has never been called. It might be involved in letting Bungie.NET know when a user has bought Bungie PRO via the Xbox Marketplace.",
    deprecated: true,
  })
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiQuery({ name: 'title', type: 'number' })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'consumableId' })
  async userBeginConsume(
    @Query('title', new ParseIntPipe({ optional: true }), new DefaultValuePipe(0)) title: number,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('consumableId') consumableId,
  ) {
    throw new NotImplementedException();
  }

  @Get('/UserCompleteConsume.ashx')
  @ApiOperation({
    summary: 'Bungie Pro - Complete Consume',
    description: "We're not sure what this endpoint does yet and it has never been called. It might be involved in letting Bungie.NET know when a user has bought Bungie PRO via the Xbox Marketplace.",
    deprecated: true,
  })
  @ApiTags('File Share')
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @ApiQuery({ name: 'title', type: 'number' })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'consumableId' })
  async userCompleteConsume(
    @Query('title', new ParseIntPipe({ optional: true }), new DefaultValuePipe(0)) title: number,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('consumableId') consumableId,
  ) {
    throw new NotImplementedException();
  }
}
