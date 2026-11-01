import 'dotenv/config';
import { createAresLSPServer } from 'src/ares_lsp/init';
import { createAresLiveServer } from 'src/ares_live/init';
import { createLSPServer } from 'src/lsp/init';
import { createWebsiteServer } from 'src/website/init';
import { datamine_events_start } from 'src/utils/datamine_events';

async function bootstrap() {  
  await datamine_events_start();
  createLSPServer();
  createAresLSPServer();
  createAresLiveServer();
  createWebsiteServer();
}
bootstrap();
