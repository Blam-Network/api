import 'dotenv/config';
import { createAresLSPServer } from 'src/ares_lsp/init';
import { createAresLiveServer } from 'src/ares_live/init';
import { createLSPServer } from 'src/lsp/init';
import { createWebsiteServer } from 'src/website/init';

async function bootstrap() {  
  createLSPServer();
  createAresLSPServer();
  createAresLiveServer();
  createWebsiteServer();
}
bootstrap();
