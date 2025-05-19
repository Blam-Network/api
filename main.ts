import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as http from 'http';
import * as https from 'https';
import { SunriseModule } from './src/sunrise.module';
import { readFileSync } from 'fs';
import * as express from 'express';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { createLSPServer } from 'src/lsp/init';

async function createBlamNetwork() {
  const server = express();
  const app = await NestFactory.create(
    SunriseModule,
    new ExpressAdapter(server),
  );

  const config = new DocumentBuilder()
    .setTitle('Blam Network API')
    .setDescription('Halo Web Services')
    // .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.enableCors();

  await app.init();
  
  const httpServer = http.createServer(server).listen(80, process.env.HOSTNAME);

  const shutdownObserver = app.get(ShutdownObserver);
  shutdownObserver.addHttpServer(httpServer);

  if (process.env.USE_HTTPS=== 'true') {
    const httpsOptions = {
      key: readFileSync(process.env.SSL_PRIVATE_KEY_PATH!),
      cert: readFileSync(process.env.SSL_CERTIFICATE_PATH!),
    };
    const httpsServer = https.createServer(httpsOptions, server).listen(443, process.env.HOSTNAME);
    shutdownObserver.addHttpServer(httpsServer);
  }
}

async function bootstrap() {  
  createBlamNetwork();
  createLSPServer();
}
bootstrap();
