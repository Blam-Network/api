import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import ILogger, { ILoggerSymbol } from '../../ILogger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { createReadStream } from 'fs';
import { join } from 'path';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { stat } from 'fs/promises';
import { Response } from 'express';
import { PrismaService } from 'src/db/prisma.service';
import { parseXuid } from 'src/xbox/xuid';
import * as BLF from '@blamnetwork/blf_lsp';

@ApiTags('User Storage')
@Controller('/storage/user')
export class UserStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService
  ) {}

  @Get('/:unk1/:unk2/:xuid/user.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getBetaUser(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.getUser(xuid, res);
  }

  @Get('/:titleId/:unk1/:unk2/:unk3/:xuid/user.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getOmahaUser(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const blfFile = BLF.haloreach_12065_11_08_24_1738_tu1actual.build_user_file(
      {
        bungie_user_role: 0,
        hopper_access: 0,
        hopper_directory: 'default_hoppers',
        unknown1: 0,
        unknown2: new Array(0x20).fill(0),
        unknown3: 0,
      },
      undefined
    );

    return new StreamableFile(blfFile, { disposition: "filename=user.bin" });
  }

  @Get('/:titleId/:unk1/:unk2/:unk3/:xuid/recent_players.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getOmahaRecentPlayers(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.getRecentPlayers(xuid, res);
  }

  @Get('/:unk1/:unk2/:unk3/:xuid/user.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getUser(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const player_xuid = parseXuid(xuid);
    const serviceRecord = await this.prisma.service_record.findUnique({ where: { player_xuid }, select: {
      player_name: true,
      appearance_flags: true,
      primary_color: true,
      secondary_color: true,
      tertiary_color: true,
      emblem_background_color: true,
      emblem_primary_color: true,
      emblem_secondary_color: true,
      elite_body: true,
      elite_helmet: true,
      elite_left_shoulder: true,
      elite_right_shoulder: true,
      emblem_flags: true,
      is_elite: true,
      total_exp: true,
      foreground_emblem: true,
      background_emblem: true,
      spartan_body: true,
      service_tag: true,
      spartan_helmet: true,
      spartan_left_shoulder: true,
      spartan_right_shoulder: true,
      campaign_progress: true,
      unknown_insignia: true,
      unknown_insignia2: true,
      rank: true,
      grade: true,
      highest_skill: true,
    }});
    const playerData = await this.prisma.player_data.findUnique({ where: { player_xuid } });

    let fupd: BLF.halo3_12070_08_09_05_2031_halo3_ship.s_blf_chunk_player_data | undefined;

    if (playerData) {
      let bungie_user_role = 0;
      bungie_user_role | 1 << 1; // give everyone the seventh column
      if (playerData.is_pro) bungie_user_role | 1 << 1;
      if (playerData.is_bungie) bungie_user_role | 1 << 2;
      if (playerData.has_recon || playerData.road_to_recon_completed) bungie_user_role | 1 << 3;
      fupd = {
        ...playerData,
        bungie_user_role,
        hopper_directory: playerData.hopper_directory_override || 'default_hoppers'
      }
    }
 
    const blfFile = BLF.halo3_12070_08_09_05_2031_halo3_ship.build_user_file(
      fupd,
      serviceRecord
    );

    return new StreamableFile(blfFile, { disposition: "filename=user.bin" });
  }

  @Get('/:unk1/:unk2/:unk3/:xuid/recent_players.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getRecentPlayers(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // return await this.sendLocalFile(
    //   `${unk1}/${unk2}/${unk3}/${xuid}/recent_players.bin`,
    //   res,
    // );

    return await this.sendLocalFile(`recent_players.bin`, res);
  }

  @Get('/:unk1/:unk2/:xuid/recent_players_hopper_08.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getDeltaRecentPlayers(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.sendLocalFile(`recent_players.bin`, res);
  }

  private async sendLocalFile(path: string, res: Response) {
    path = join(process.cwd(), `public/storage/user/`, path);

    const stats = await stat(path);

    if (!stats.isFile()) throw new NotFoundException();

    res.set('Content-Length', stats.size.toString());
    res.set('Cache-Control', 'no-cache');
    return new StreamableFile(createReadStream(path));
  }
}
