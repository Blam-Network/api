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
import { HaloReachFileshareController } from './controllers/haloreach-fileshare.controller';
import { HaloReachFileShareService } from './services/haloreachfileshare.service';
import { FileShareUploadService } from './services/haloreach/fileshare.service';
import { Halo3PopulationService } from './services/halo3population.service';
import { DatamineController } from './controllers/datamine.controller';
import { UserController } from './controllers/user.controller';
import { BnetUserService } from './services/bnetuser.service';
import { JwtService } from './services/jwt.service';
import { loggerWithPrefix } from 'src/utils/logger'
import { AresController } from './controllers/ares.controller';
import { AresPopulationService } from './services/arespopulation.service';
import { AresFileShareService } from './services/aresfileshare.service';
import { CompressionService } from 'src/lsp/services/compression.service';
import { UploadService } from 'src/lsp/services/upload.service';
import { HaloReachPopulationService } from 'src/lsp/haloreach/population.service';
import { HaloReachSpartanRenderService } from 'src/lsp/haloreach/spartan-render.service';
import { HaloReachHoppersService } from './services/haloreach-hoppers.service';
import { ReachNameplatesService } from './services/reach-nameplates.service';

@Module({
    imports: [
        {
            global: true,
            module: DatabaseModule,
        },
    ],
    controllers: [
        AresController,
        Halo3Controller,
        Halo3ODSTController,
        HaloReachController,
        HaloReachFileshareController,
        DatamineController,
        UserController,
    ],
    providers: [
        AchievementsService,
        Halo3EmblemsService,
        Halo3FileShareService,
        HaloReachFileShareService,
        FileShareUploadService,
        CompressionService,
        UploadService,
        Halo3PopulationService,
        HaloReachPopulationService,
        HaloReachSpartanRenderService,
        HaloReachHoppersService,
        ReachNameplatesService,
        AresPopulationService,
        AresFileShareService,
        BnetUserService,
        JwtService,
        loggerWithPrefix('BNET'),
        ShutdownObserver,
    ],
})
export class WebsiteModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        // consumer.apply(AppLoggerMiddleware).forRoutes('*');
    }
}
