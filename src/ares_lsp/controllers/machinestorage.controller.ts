import {
  Controller,
  Get,
  Inject,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { AresMachineService } from '../ares/machine.service';
import { EXAMPLE_XUID } from '../../constants';

@ApiTags('Machine Storage')
@Controller('/storage/machine')
export class MachineStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly halo3MachineService: AresMachineService,
  ) {}

  @ApiOperation({
    summary: 'Machine File',
    description: "Used to retrieve a machine.bin BLF file. Typically required for gameplay.",
  })
  @Get('/:unk1/:unk2/:unk3/:machineId/machine.bin')
  @ApiParam({ name: 'machineId', example: EXAMPLE_XUID })
  async getMachineFile(
    @Param('machineId') machineId: string,
  ) {
    const blfFile = this.halo3MachineService.getMachineFile(machineId);
    return new StreamableFile(blfFile, { disposition: "filename=machine.bin" });
  }
}
