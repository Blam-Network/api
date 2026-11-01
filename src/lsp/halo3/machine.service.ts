import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { build_machine_file, s_blf_chunk_user_network_statistics } from '@blamnetwork/blf/halo3/v12070_08_09_05_2031_halo3_ship';

@Injectable()
export class Halo3MachineService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }
    public getMachineFile = (machineId: string) => {
        return build_machine_file(new s_blf_chunk_user_network_statistics())
    }
}
