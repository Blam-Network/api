import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AresLiveHeadersMiddleware implements NestMiddleware {
    use(request: Request, response: Response, next: NextFunction): void {
        // Set Connection: keep-alive on all responses (matches C# API)
        response.setHeader('Connection', 'keep-alive');
        
        // Set Content-Disposition: inline for file responses
        // This will be set in the response interceptor or controller for file responses
        // But we can set it here as a default and controllers can override if needed
        
        next();
    }
}
