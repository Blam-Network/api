import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Halo 3, ODST & Reach only request with HTTP/1.0, and accept HTTP/1.0 or HTTP/1.1 responses.
// This middleware will prevent requests using anything other than HTTP/1.0
@Injectable()
export class HTTP1_0Middleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.httpVersionMajor != 1 || req.httpVersionMinor != 0) {
        res.statusCode = 404;
        res.send()
    } else {
        next();
    }
  }
}