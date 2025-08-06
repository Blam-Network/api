import { ConsoleLogger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseModule } from 'src/db/database.module';
import { ILoggerSymbol } from 'src/ILogger';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { Halo3Controller } from './controllers/halo3.controller';
import { AchievementsService } from './services/achievements.service';
import { AppLoggerMiddleware } from 'src/middleware/AppLoggerMiddleware';
import { Halo3EmblemsService } from './services/halo3emblems.service';
import { Halo3FileShareService } from './services/halo3fileshare.service';
import { Halo3ODSTController } from './controllers/halo3odst.controller';

@Module({
    imports: [
        {
            global: true,
            module: DatabaseModule,
        },
    ],
    controllers: [
        Halo3Controller,
        Halo3ODSTController,
    ],
    providers: [
        AchievementsService,
        Halo3EmblemsService,
        Halo3FileShareService,
        { provide: ILoggerSymbol, useClass: ConsoleLogger },
        ShutdownObserver,
    ],
})
export class WebsiteModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AppLoggerMiddleware).forRoutes('*');
    }
}
