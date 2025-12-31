import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AresLiveHeadersMiddleware implements NestMiddleware {
    use(request: Request, response: Response, next: NextFunction): void {
        // Set Connection: keep-alive on all responses (matches C# API)
        response.setHeader('Connection', 'keep-alive');
        // Set Keep-Alive header with timeout
        response.setHeader('Keep-Alive', 'timeout=5');
        
        next();
    }
}
