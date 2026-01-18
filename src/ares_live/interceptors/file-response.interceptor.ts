import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { StreamableFile } from '@nestjs/common';

@Injectable()
export class FileResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const response = context.switchToHttp().getResponse();
        
        return next.handle().pipe(
            tap((data) => {
                // Set Content-Disposition: inline for file responses (matches C# API)
                if (data instanceof StreamableFile) {
                    response.setHeader('Content-Disposition', 'inline');
                    response.setHeader('Content-Type', 'application/octet-stream');
                }
            })
        );
    }
}
