import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as http from 'http';
import * as express from 'express';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { AresLiveModule } from 'src/ares_live/ares_live.module';
import { ARES_LIVE_PORT } from './constants';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { attachSignallingWebSocket } from './signalling/signalling-server';

export const createAresLiveServer = async () => {
    const server = express();
    const app = await NestFactory.create(
        AresLiveModule,
        new ExpressAdapter(server),
    );

    const config = new DocumentBuilder()
        .setTitle('Blam Network Ares Live')
        .setDescription('Live API Server for Ares Session and Statistics')
        .setVersion('beta')
        .setExternalDoc('GitHub', 'https://github.com/Blam-Network/web_private')
        .build();
        
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    app.enableCors();

    await app.init();

    const shutdownObserver = app.get(ShutdownObserver);

    const httpServer = http.createServer(server);
    attachSignallingWebSocket(httpServer);
    httpServer.listen(ARES_LIVE_PORT, process.env.HOSTNAME);

    shutdownObserver.addHttpServer(httpServer);

    const logger = app.get<ILogger>(ILoggerSymbol);
    logger.log(`Listening on port: ${ARES_LIVE_PORT}`)
}

