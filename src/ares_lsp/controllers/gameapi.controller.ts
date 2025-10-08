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
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { AresUserService } from '../ares/user.service';
import { EXAMPLE_XUID } from '../../constants';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../services/upload.service';
import { Response } from 'express';
import { ParseXUIDPipe } from '../../xbox/parse-xuid.pipe';
import { AresFileShareService } from '../ares/fileshare.service';
import { hexStringXuidSchema } from 'src/xbox/xuid';
import { z } from 'zod';
import { ParseBigIntPipe } from 'src/utils/parse-big-int.pipe';
import { UuidWithoutDashesPipe } from 'src/utils/uuid-without-dashes.pipe';

const TITLE_IDS = {
  LEGACY: 0,
  HALO3: 1,
  HALO3_MYTHIC: 2,
  HALO3_SHARE_CONTENT: 4,
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
    private readonly halo3UserService: AresUserService,
    private readonly uploadService: UploadService,
    private readonly halo3FileShareService: AresFileShareService,
  ) { }

  @ApiOperation({
    summary: 'Update User Highest Skill',
    description: 'Stores the provided highest skill for the provided Halo 3 user ID'
  })
  @Get('/UserUpdatePlayerStats.ashx')
  @ApiQuery({ name: 'title', type: 'number' })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'highestSkill', type: 'number' })
  async userUpdatePlayerStats(
    @Query('title', new DefaultValuePipe(TITLE_IDS.LEGACY), ParseIntPipe) title,
    @Query('userId', ParseXUIDPipe) userId: BigInt,
    @Query('highestSkill', ParseIntPipe) highestSkill: number,
  ) {
    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
        return await this.halo3UserService.updateHighestSkill(userId, highestSkill);
      case TITLE_IDS.LEGACY:
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
  @ApiHeader({ name: 'machineId' })
  @UseInterceptors(FileInterceptor('upload'))
  async machineUpdateNetworkStats(
    @Headers() headers: Record<string, string>,
    @UploadedFile() upload: Express.Multer.File | undefined,
  ) {
    if (!upload) throw new BadRequestException();

    const { title, machineId } = z.object({
      title: parseBungieHeader(z.coerce.number().default(TITLE_IDS.LEGACY)),
      machineId: parseBungieHeader(hexStringXuidSchema),
    }).parse(headers);

    this.logger.log(`[MACHINE] Got machine network stats for machine ${machineId}, title ${title}`)
    this.logger.log(`[MACHINE] Mime type = ${upload.mimetype}`)
    await this.uploadService.handleDebug(upload);
    await this.uploadService.storeUploadedFile(upload);
    // TODO: Store this
  }

  @ApiOperation({
    summary: 'Get File Share',
    description: 'Returns a file share catalog for the given user ID.'
  })
  @ApiTags('File Share')
  @Get('/FilesGetCatalog.ashx')
  @ApiQuery({ name: 'title', type: 'number', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'locale', example: 'en' })
  async getFileshare(
    @Query('title', new DefaultValuePipe(TITLE_IDS.LEGACY), ParseIntPipe) titleID,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('locale', new DefaultValuePipe('en')) locale,
  ) {
    switch (titleID) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.LEGACY:
        return this.halo3FileShareService.viewFileShare(userID, shareID, locale);
      default:
        throw new NotImplementedException();
    }
  }

  @Get('/FilesNewUpload.ashx')
  @ApiOperation({
    summary: 'Start File Upload',
    description: 'Begins a file share upload for Halo 3 / ODST. Returns the ID of the file.'
  })
  @ApiTags('File Share')
  @ApiQuery({ name: 'title', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'slot', example: 1 })
  @ApiQuery({ name: 'uniqueId' })
  @ApiQuery({ name: 'fileType' })
  @ApiQuery({ name: 'uncompressedSize' })
  @ApiQuery({ name: 'compressedSize' })
  async startFileUpload(
    @Query('title', new DefaultValuePipe(TITLE_IDS.LEGACY), ParseIntPipe) titleID,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('slot', ParseIntPipe) slot: number,
    @Query('uniqueId', new ParseBigIntPipe({hex: true})) uniqueID: number,
    @Query('fileType', ParseIntPipe) fileType: number,
    @Query('uncompressedSize', ParseIntPipe) uncompressedSize: number,
    @Query('compressedSize', ParseIntPipe) compressedSize: number,
  ) {
    // This function returns a server ID, but we don't really use it so it's not important.
    switch (titleID) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.LEGACY:
        return await this.halo3FileShareService.initiateNewUpload(
          userID,
          shareID,
          slot,
          uniqueID,
          fileType,
          uncompressedSize,
          compressedSize
        )
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
  @ApiQuery({ name: 'title', type: 'number', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'locale', example: 'en' })
  @ApiQuery({ name: 'gameRegion', example: '0', description: 'ODST only', required: false })
  @ApiQuery({ name: 'profileRegion', example: '100', description: 'ODST only', required: false })
  @ApiQuery({ name: 'isDebug', example: 'false', description: 'ODST only', required: false })
  async getBnetSubscription(
    @Query('title', new DefaultValuePipe(TITLE_IDS.LEGACY), ParseIntPipe) title: number,
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
      default:
        throw new NotImplementedException();
    }
  }

  @Post('/FilesUpload.ashx')
  @ApiOperation({
    summary: 'Upload File',
    description: 'Uploads a file to a file share.',
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
  @ApiHeader({ name: 'title' })
  @ApiHeader({ name: 'userid', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'shareid', example: EXAMPLE_XUID })
  @ApiHeader({ name: 'slot' })
  @ApiHeader({ name: 'serverid' })
  @UseInterceptors(FileInterceptor('upload'))
  async uploadFile(
    @UploadedFile() upload: Express.Multer.File | undefined,
    @Headers() headers: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!upload) throw new BadRequestException();

    const { title, userid: uploaderXuid, shareid: shareXuid, slot, serverid } = z.object({
      title: parseBungieHeader(z.coerce.number().default(TITLE_IDS.LEGACY)),
      userid: parseBungieHeader(hexStringXuidSchema),
      shareid: parseBungieHeader(hexStringXuidSchema),
      slot: parseBungieHeader(z.coerce.number()),
      serverid: parseBungieHeader(z.string().uuid()),
    }).parse(headers);

    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.LEGACY:
        await this.halo3FileShareService.handleFileUpload(upload, uploaderXuid, shareXuid, slot, serverid)
        break;
      default:
        throw new NotImplementedException();
    }
    res.setHeader('Content-Length', size);
    res.writeHead(200)
    res.write('')
  }

  @Get('/FilesStageForDownload.ashx')
  @ApiTags('File Share')
  @ApiOperation({
    summary: 'Initiate File Download',
    description: 'Start downloading a file from a fileshare. Returns the download URL and file size.',
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
    @Query('title', ParseIntPipe, new DefaultValuePipe(TITLE_IDS.LEGACY)) title: number,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('slot', ParseIntPipe) slot: number,
    @Query('serverId', UuidWithoutDashesPipe) serverId: string,
    @Query('startPosition', ParseIntPipe) startPosition: number,
    @Query('fromAutoQueue', ParseIntPipe) fromAutoQueue: number,
    @Query('view') view: number,
    @Query('preview', ParseIntPipe) preview: number,
  ) {
    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
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
    summary: "Download File",
    description: "Not an official endpoint but used by Halo. Download a file from a file share. This endpoint isn't hardcoded, but we return it from FilesStageDownload.ashx."
  })
  @ApiTags('File Share')
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
    @Query('serverId') serverId: string,
    @Query('startPosition', ParseIntPipe) startPosition: number,
    @Res() res: Response,
  ) {
    const { title } = z.object({
      title: parseBungieHeader(z.coerce.number().default(TITLE_IDS.LEGACY)),
    }).parse(headers);

    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
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
    summary: "Resume File Download",
    description: "Resume downloading a file from a file share. Same parameters as FilesStartDownload.ashx."
  })
  @ApiTags('File Share')
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
    @Query('serverId') serverId: string,
    @Query('startPosition', ParseIntPipe) startPosition: number,
    @Res() res: Response,
  ) {
    const { title } = z.object({
      title: parseBungieHeader(z.coerce.number().default(TITLE_IDS.LEGACY)),
    }).parse(headers);

    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
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
    summary: "Delete File",
    description: "Delete a file from a file share."
  })
  @ApiTags('File Share')
  @ApiQuery({ name: 'title', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'slot', example: 1 })
  @ApiQuery({ name: 'serverId' })
  async deleteFile(
    @Query('title', ParseIntPipe, new DefaultValuePipe(TITLE_IDS.LEGACY)) title: number,
    @Query('userId', ParseXUIDPipe) userid: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('slot', ParseIntPipe) slot: number,
    @Query('serverId', UuidWithoutDashesPipe) serverId: string,
  ) {
    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.LEGACY:
        return await this.halo3FileShareService.deleteFile(userid, shareID, slot, serverId);
      default:
        throw new NotImplementedException();
    }
  }

  @Get('/FilesGetUploadProgress.ashx')
  @ApiOperation({
    summary: "Get File Upload Progress",
    description: "Returns bytes uploaded."
  })
  @ApiTags('File Share')
  @ApiQuery({ name: 'title', example: TITLE_IDS.HALO3_MYTHIC })
  @ApiQuery({ name: 'userId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'shareId', type: 'string', example: EXAMPLE_XUID })
  @ApiQuery({ name: 'slot', example: 1 })
  @ApiQuery({ name: 'serverId' })
  async getUploadProgress(
    @Query('title', ParseIntPipe, new DefaultValuePipe(TITLE_IDS.LEGACY)) title: number,
    @Query('userId', ParseXUIDPipe) userID: BigInt,
    @Query('shareId', ParseXUIDPipe) shareID: BigInt,
    @Query('slot', ParseIntPipe) slot: number,
    @Query('serverId') serverId: string,
  ) {
    switch (title) {
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
      case TITLE_IDS.LEGACY:
        return await this.halo3FileShareService.getUploadProgress(userID, shareID, slot, serverId);
      default:
        throw new NotImplementedException();
    }
  }

  @Post('/FilesUploadBlind.ashx')
  @ApiOperation({
    summary: 'Upload Screenshot',
    description: "This endpoint is used to upload screenshots, when a screenshot is taken in game and the user is connected to the server, the screenshot is automatically uploaded.",
  })
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

    switch (title) {
      case TITLE_IDS.LEGACY:
      case TITLE_IDS.HALO3:
      case TITLE_IDS.HALO3_MYTHIC:
        return await this.halo3FileShareService.handleBlindFileUpload(upload, uploaderXuid, gameid);
      default:
        throw new NotImplementedException();
    }
  }

  @Get('/UserBeginConsume.ashx')
  @ApiOperation({
    summary: 'Bungie Pro - Complete Consume',
    description: "We're not sure what this endpoint does yet and it has never been called. It might be involved in letting Bungie.NET know when a user has bought Bungie PRO via the Xbox Marketplace.",
    deprecated: true,
  })
  @ApiTags('File Share')
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
