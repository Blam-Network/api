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
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { createReadStream } from 'fs';
import { join } from 'path';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { stat } from 'fs/promises';
import { Response } from 'express';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { Halo3MachineService } from '../halo3/machine.service';
import { EXAMPLE_XUID } from '../constants';

@ApiTags('Machine Storage')
@Controller('/storage/machine')
export class MachineStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly halo3MachineService: Halo3MachineService,
  ) {}

  @ApiOperation({
    summary: 'Halo Reach Machine File',
    description: "Used to retrieve a Halo Reach machine.bin BLF file. Typically required for gameplay.",
  })
  @Get('/:titleId/:unk1/:unk2/:unk3/:xuid/machine.bin')
  @ApiParam({ name: 'xuid', example: EXAMPLE_XUID })
  async getOmahaMachine(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.getMachineFile(xuid, res);
  }

  @ApiOperation({
    summary: 'Halo 3 / ODST Machine File',
    description: "Used to retrieve a Halo 3 or Halo 3: ODST machine.bin BLF file. Typically required for gameplay.",
  })
  @Get('/:unk1/:unk2/:unk3/:xuid/machine.bin')
  @ApiParam({ name: 'xuid', example: EXAMPLE_XUID })
  async getMachineFile(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const blfFile = this.halo3MachineService.getMachineFile(xuid);
    return new StreamableFile(blfFile, { disposition: "filename=machine.bin" });
  }
}
