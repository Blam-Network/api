import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blamnetwork/blf_lsp';
import { parseXuid } from "src/xbox/xuid";

@Injectable()
export class Halo3MachineService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }
    public getMachineFile = (_xuid: string) => {
        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_machine_file({
            data: Array.from({length: 0xC0}, () => 0)
        })
    }
}
