import 'dotenv/config';
import { createLSPServer } from 'src/lsp/init';

async function bootstrap() {  
  createLSPServer();
}
bootstrap();
