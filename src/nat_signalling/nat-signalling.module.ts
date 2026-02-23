import { Module } from '@nestjs/common';
import { NatSignallingService } from './nat-signalling.service';
import { loggerWithPrefix } from 'src/utils/logger';

@Module({
    providers: [
        NatSignallingService,
        loggerWithPrefix('NAT'),
    ],
    exports: [NatSignallingService],
})
export class NatSignallingModule {}
