import { ConsoleLogger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CqrsModule } from '@nestjs/cqrs';
import { UploadServerController } from 'src/lsp/controllers/uploadserver.controller';
import { Halo3UploadService } from './halo3/upload.service';
import { AppLoggerMiddleware } from 'src/infrastructure/presentation/AppLoggerMiddleware';
import { Halo3CarnageReportService } from './halo3/carnagereport.service';
import { CompressionService } from './services/compression.service';
import { UploadService } from './services/upload.service';
import { DiscordWebhookService } from './services/discordwebhook.service';
import { DatabaseModule } from 'src/db/database.module';
import { ILoggerSymbol } from 'src/ILogger';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { TitleStorageController } from './controllers/titlestorage.controller';

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
    ],
    providers: [
        UploadService,
        Halo3UploadService,
        Halo3CarnageReportService,
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
