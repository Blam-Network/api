import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as http from 'http';
import * as express from 'express';
import { ShutdownObserver } from 'src/ShutdownObserver';
import { LSPModule } from 'src/lsp/lsp.module';

const getPortRange = (start: number, end: number) => Array.from({ length: (end - start) + 1 }, (_, index) => start + index);

// These port ranges are configurable in some Halo versions via the network_cofiguration file.
// We support the defaults + a few extra.
const LSP_PORT_RANGE = Array.from(new Set([
    // Legacy Sunrise
    8000,
    8080,
    // Halo 3
    ...getPortRange(1000, 1002),
    // Halo Reach
    ...getPortRange(1000, 1035),
    1
]));

export const createLSPServer = async () => {
    const server = express();
    const app = await NestFactory.create(
        LSPModule,
        new ExpressAdapter(server),
    );

    const config = new DocumentBuilder()
        .setTitle('Blam Network LSP')
        .setDescription('Halo Web Services')
        // .setVersion('1.0')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    app.enableCors();

    await app.init();

    const shutdownObserver = app.get(ShutdownObserver);

    LSP_PORT_RANGE.forEach(port => {
        const httpServer = http.createServer(server)
            .listen(port);

        shutdownObserver.addHttpServer(httpServer);
    })
}