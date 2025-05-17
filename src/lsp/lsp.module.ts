import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CqrsModule } from '@nestjs/cqrs';
import { UploadServerController } from 'src/lsp/controllers/uploadserver.controller';
import { Halo3UploadService } from './halo3/Halo3UploadService';
import { AppLoggerMiddleware } from 'src/infrastructure/presentation/AppLoggerMiddleware';
import { Halo3CarnageReportService } from './halo3/Halo3CarnageReportService';
import { CompressionService } from './services/compression.service';
import { UploadService } from './services/upload.service';

@Module({
  controllers: [
    UploadServerController,
  ],
  providers: [
    UploadService,
    Halo3UploadService,
    Halo3CarnageReportService,
    CompressionService,
  ],
})
export class LSPModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppLoggerMiddleware).forRoutes('*');
  }
}
