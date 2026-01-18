import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as http from 'http';
import * as express from 'express';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { LSPModule } from 'src/lsp/lsp.module';
import { LSP_PORT_RANGE } from './constants';
import ILogger, { ILoggerSymbol } from 'src/ILogger';

export const createLSPServer = async () => {
    const server = express();
    const app = await NestFactory.create(
        LSPModule,
        new ExpressAdapter(server),
    );

    const config = new DocumentBuilder()
        .setTitle('Blam Network LSP')
        .setDescription('LSP Server for Halo 3, Halo 3: ODST and Halo: Reach')
        .setVersion('beta')
        .setExternalDoc('GitHub', 'https://github.com/Blam-Network/web_private')
        .build();
        
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    app.enableCors();

    await app.init();

    const shutdownObserver = app.get(ShutdownObserver);

    LSP_PORT_RANGE.forEach(port => {
        const httpServer = http.createServer(server)
            .listen(port, process.env.HOSTNAME);

        shutdownObserver.addHttpServer(httpServer);
    })

    const logger = app.get<ILogger>(ILoggerSymbol)
    logger.log(`Listening on ports: ${LSP_PORT_RANGE.toString()}`)
}