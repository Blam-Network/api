import 'dotenv/config';
import { createLSPServer } from 'src/lsp/init';
import { createWebsiteServer } from 'src/website/init';

async function bootstrap() {  
  createLSPServer();
  createWebsiteServer();
}
bootstrap();
