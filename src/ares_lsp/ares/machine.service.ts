import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as BLF from '@blam-network/blf_lsp';
import { parseXuid } from "src/xbox/xuid";

@Injectable()
export class AresMachineService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }
    public getMachineFile = (machineId: string) => {
        return BLF.halo3_12070_08_09_05_2031_halo3_ship.build_machine_file({
            bandwidth_data: {
                bandwidth_dispute_count: 0,
                bandwidth_measurement_count: 0,
                bandwidth_measurement_successful_bps: Array.from({length: 8}, () => 0),
                bandwidth_measurement_unsafe_bps: Array.from({length: 8}, () => 0),
                qos_sample_bps: Array.from({length: 8}, () => 0),
                qos_sample_count: 0
            },
            session: [{
                client_badness_history: [0n, 0n],
                host_badness_history: [0n, 0n]
            }, {
                client_badness_history: [0n, 0n],
                host_badness_history: [0n, 0n],
            }],
            connection_history: [0n, 0n]
        })
    }
}
