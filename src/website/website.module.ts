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
import { HaloReachController } from './controllers/haloreach.controller';
import { HaloReachFileShareService } from './services/haloreachfileshare.service';
import { Halo3PopulationService } from './services/halo3population.service';
import { DatamineController } from './controllers/datamine.controller';
import { UserController } from './controllers/user.controller';
import { BnetUserService } from './services/bnetuser.service';
import { JwtService } from './services/jwt.service';
import { loggerWithPrefix } from 'src/utils/logger'

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
        HaloReachController,
        DatamineController,
        UserController,
    ],
    providers: [
        AchievementsService,
        Halo3EmblemsService,
        Halo3FileShareService,
        HaloReachFileShareService,
        Halo3PopulationService,
        BnetUserService,
        JwtService,
        loggerWithPrefix('Website'),
        ShutdownObserver,
    ],
})
export class WebsiteModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        // consumer.apply(AppLoggerMiddleware).forRoutes('*');
    }
}
