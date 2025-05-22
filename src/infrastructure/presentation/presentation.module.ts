import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppLoggerMiddleware } from './AppLoggerMiddleware';
import { JSONTitleStorageController } from './controllers/jsontitlestorage.controller';
import { PimpsController } from './controllers/pimps.controller';
import { SunriseController } from './controllers/sunrise.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CqrsModule } from '@nestjs/cqrs';
import { GameApiOmahaController } from './controllers/gameapi_omaha.controller';
import { ReachPresenceApiController } from './controllers/reach_presence_api.controller.ts';

@Module({
  imports: [
    CqrsModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', '..', 'public'),
    }),
  ],
  controllers: [
    GameApiOmahaController,
    ReachPresenceApiController,
    JSONTitleStorageController,
    SunriseController,
    PimpsController,
  ],
  providers: [],
})
export class PresentationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppLoggerMiddleware).forRoutes('*');
  }
}
