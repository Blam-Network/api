import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NatSignallingModule } from './nat-signalling.module';

export const createNatSignallingServer = async () => {
    const app = await NestFactory.createApplicationContext(NatSignallingModule);
    await app.init();
    return app;
};
