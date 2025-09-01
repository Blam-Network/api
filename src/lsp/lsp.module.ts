import { ConsoleLogger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CqrsModule } from '@nestjs/cqrs';
import { UploadServerController } from 'src/lsp/controllers/uploadserver.controller';
import { Halo3UploadService } from './halo3/upload.service';
import { AppLoggerMiddleware } from 'src/middleware/AppLoggerMiddleware';
import { Halo3CarnageReportService } from './halo3/carnagereport.service';
import { CompressionService } from './services/compression.service';
import { UploadService } from './services/upload.service';
import { DiscordWebhookService } from './services/discordwebhook.service';
import { DatabaseModule } from 'src/db/database.module';
import { ILoggerSymbol } from 'src/ILogger';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { TitleStorageController } from './controllers/titlestorage.controller';
import { UserStorageController } from './controllers/userstorage.controller';
import { Halo3UserService } from './halo3/user.service';
import { HaloReachUserService } from './haloreach/user.service';
import { MachineStorageController } from './controllers/machinestorage.controller';
import { Halo3MachineService } from './halo3/machine.service';
import { HaloReachMachineService } from './haloreach/machine.service';
import { GameApiController } from './controllers/gameapi.controller';
import { Halo3PopulationService } from './halo3/population.service';
import { Halo3FileShareService } from './halo3/fileshare.service';
import { GameApiOmahaController } from './controllers/gameapi_omaha.controller';
import { ReachPresenceApiController } from './controllers/reachpresenceapi.controller';
import { HaloReachWhitelistService } from './haloreach/whitelist.service';

@Module({
    imports: [
        {
            global: true,
            module: DatabaseModule,
        },
    ],
    controllers: [
        TitleStorageController,
        UploadServerController,
        UserStorageController,
        MachineStorageController,
        GameApiController,
        GameApiOmahaController,
        ReachPresenceApiController,
    ],
    providers: [
        UploadService,
        Halo3UploadService,
        Halo3CarnageReportService,
        Halo3UserService,
        HaloReachUserService,
        Halo3MachineService,
        HaloReachMachineService,
        Halo3PopulationService,
        Halo3FileShareService,
        HaloReachWhitelistService,
        CompressionService,
        DiscordWebhookService,
        { provide: ILoggerSymbol, useClass: ConsoleLogger },
        ShutdownObserver,
    ],
})
export class LSPModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AppLoggerMiddleware).forRoutes('*');
    }
}
