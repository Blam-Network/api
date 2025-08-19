import 'dotenv/config';
import { createAresLSPServer } from 'src/ares_lsp/init';
import { createLSPServer } from 'src/lsp/init';
import { createWebsiteServer } from 'src/website/init';

async function bootstrap() {  
  createLSPServer();
  createAresLSPServer();
  createWebsiteServer();
}
bootstrap();
