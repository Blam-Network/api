import 'dotenv/config';
import { createLSPServer } from 'src/lsp/init';
import { createWebsiteServer } from 'src/website/init';
import { datamine_events_start } from 'src/utils/datamine_events';

async function bootstrap() {  
  await datamine_events_start();
  createLSPServer();
  createWebsiteServer();
}
bootstrap();
