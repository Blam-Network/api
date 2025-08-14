import {
  Controller,
  Get,
  Inject,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { Halo3MachineService } from '../halo3/machine.service';
import { EXAMPLE_XUID } from '../constants';
import { TitleID } from 'src/xbox/titles';

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
  @ApiTags('Halo: Reach')
  @Get('/:titleId/:unk1/:unk2/:unk3/:xuid/machine.bin')
  @ApiParam({ name: 'titleId', example: TitleID.HALOREACH.toString(16).toLowerCase() })
  @ApiParam({ name: 'xuid', example: EXAMPLE_XUID })
  async getOmahaMachine(
    @Param('xuid') xuid: string,
  ) {
    return await this.getMachineFile(xuid);
  }

  @ApiOperation({
    summary: 'Halo 3 / ODST Machine File',
    description: "Used to retrieve a Halo 3 or Halo 3: ODST machine.bin BLF file. Typically required for gameplay.",
  })
  @ApiTags('Halo 3')
  @ApiTags('Halo 3: ODST')
  @Get('/:unk1/:unk2/:unk3/:machineId/machine.bin')
  @ApiParam({ name: 'machineId', example: EXAMPLE_XUID })
  async getMachineFile(
    @Param('machineId') machineId: string,
  ) {
    const blfFile = this.halo3MachineService.getMachineFile(machineId);
    return new StreamableFile(blfFile, { disposition: "filename=machine.bin" });
  }
}
