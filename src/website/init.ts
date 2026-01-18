import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as http from 'http';
import * as https from 'https';
import * as express from 'express';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { LSPModule } from 'src/lsp/lsp.module';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { HTTP_PORT, HTTPS_PORT } from './constants';
import { readFileSync } from 'fs';
import { WebsiteModule } from './website.module';

export const createWebsiteServer = async () => {
    const server = express();
    const app = await NestFactory.create(
        WebsiteModule,
        new ExpressAdapter(server),
    );

    const config = new DocumentBuilder()
        .setTitle('Blam Network Website APIs')
        .setDescription('Back-End APIs for the Blam Network Website')
        .setVersion('alpha')
        .setExternalDoc('GitHub', 'https://github.com/Blam-Network/web_private')
        .build();
        
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    app.enableCors();

    await app.init();

    const shutdownObserver = app.get(ShutdownObserver);
    const logger = app.get<ILogger>(ILoggerSymbol)

    const httpServer = http.createServer(server)
        .listen(HTTP_PORT, process.env.HOSTNAME);

    shutdownObserver.addHttpServer(httpServer);
    logger.log(`Listening on port: ${HTTP_PORT}`)

    if (process.env.USE_HTTPS=== 'true') {
        const httpsOptions = {
        key: readFileSync(process.env.SSL_PRIVATE_KEY_PATH!),
        cert: readFileSync(process.env.SSL_CERTIFICATE_PATH!),
        };
        const httpsServer = https.createServer(httpsOptions, server).listen(HTTPS_PORT, process.env.HOSTNAME);
        shutdownObserver.addHttpServer(httpsServer);
        logger.log(`Listening on port: ${HTTPS_PORT} (HTTPS)`)
    }
}