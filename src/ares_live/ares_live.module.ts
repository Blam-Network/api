import { ConsoleLogger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseModule } from 'src/db/database.module';
import { ILoggerSymbol } from 'src/ILogger';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { AppLoggerMiddleware } from 'src/middleware/AppLoggerMiddleware';
import { SessionController } from './sessions/session.controller';
import { StatsController } from './statistics/stats.controller';
import { SessionService } from './sessions/session.service';
import { StatsService } from './statistics/stats.service';

@Module({
    imports: [
        {
            global: true,
            module: DatabaseModule,
        },
    ],
    controllers: [
        SessionController,
        StatsController,
    ],
    providers: [
        SessionService,
        StatsService,
        { provide: ILoggerSymbol, useFactory: () => new ConsoleLogger({prefix: 'ARES-LIVE'}) },
        ShutdownObserver,
    ],
})
export class AresLiveModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AppLoggerMiddleware).forRoutes('*');
    }
}

