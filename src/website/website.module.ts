import { ConsoleLogger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseModule } from 'src/db/database.module';
import { ILoggerSymbol } from 'src/ILogger';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { Halo3Controller } from './controllers/halo3.controller';
import { AchievementsService } from './services/achievements.service';
import { AppLoggerMiddleware } from 'src/middleware/AppLoggerMiddleware';

@Module({
    imports: [
        {
            global: true,
            module: DatabaseModule,
        },
    ],
    controllers: [
        Halo3Controller
    ],
    providers: [
        AchievementsService,
        { provide: ILoggerSymbol, useClass: ConsoleLogger },
        ShutdownObserver,
    ],
})
export class WebsiteModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AppLoggerMiddleware).forRoutes('*');
    }
}
