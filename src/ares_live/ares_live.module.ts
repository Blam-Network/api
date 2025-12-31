import { ConsoleLogger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseModule } from 'src/db/database.module';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { AppLoggerMiddleware } from 'src/middleware/AppLoggerMiddleware';
import { SessionController } from './sessions/session.controller';
import { StatsController } from './statistics/stats.controller';
import { SessionService } from './sessions/session.service';
import { StatsService } from './statistics/stats.service';
import { AllExceptionsFilter } from './filters/http-exception.filter';

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
        {
            provide: APP_FILTER,
            useFactory: (logger: ILogger) => new AllExceptionsFilter(logger),
            inject: [ILoggerSymbol],
        },
    ],
})
export class AresLiveModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AppLoggerMiddleware).forRoutes('*');
    }
}

