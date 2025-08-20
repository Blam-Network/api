import { ConsoleLogger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UploadServerController } from './controllers/uploadserver.controller';
import { AresUploadService } from './ares/upload.service';
import { AppLoggerMiddleware } from 'src/middleware/AppLoggerMiddleware';
import { CompressionService } from './services/compression.service';
import { UploadService } from './services/upload.service';
import { DiscordWebhookService } from './services/discordwebhook.service';
import { DatabaseModule } from 'src/db/database.module';
import { ILoggerSymbol } from 'src/ILogger';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { TitleStorageController } from './controllers/titlestorage.controller';
import { UserStorageController } from './controllers/userstorage.controller';
import { AresUserService } from './ares/user.service';
import { MachineStorageController } from './controllers/machinestorage.controller';
import { AresMachineService } from './ares/machine.service';
import { GameApiController } from './controllers/gameapi.controller';
import { AresPopulationService } from './ares/population.service';
import { AresFileShareService } from './ares/fileshare.service';

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
    ],
    providers: [
        UploadService,
        AresUploadService,
        AresUserService,
        AresMachineService,
        AresPopulationService,
        AresFileShareService,
        CompressionService,
        DiscordWebhookService,
        { provide: ILoggerSymbol, useFactory: () => new ConsoleLogger({prefix: 'ARES'}) },
        ShutdownObserver,
    ],
})
export class AresLSPModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AppLoggerMiddleware).forRoutes('*');
    }
}
