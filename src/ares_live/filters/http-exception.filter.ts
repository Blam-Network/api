import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import ILogger, { ILoggerSymbol } from 'src/ILogger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    constructor(@Inject(ILoggerSymbol) private readonly logger: ILogger) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            message = typeof exceptionResponse === 'string' 
                ? exceptionResponse 
                : (exceptionResponse as any)?.message || exception.message;
        } else if (exception instanceof Error) {
            message = exception.message;
        }

        // Log the error with request details
        this.logger.error(
            `[ExceptionFilter] ${request.method} ${request.url} - Status: ${status}, Error: ${message}`,
        );

        // Log multer-specific errors
        if (exception instanceof Error && (
            exception.message.includes('multipart') ||
            exception.message.includes('Unexpected field') ||
            exception.message.includes('File too large') ||
            exception.message.includes('LIMIT_FILE_SIZE')
        )) {
            this.logger.error(
                `[ExceptionFilter] Multer error: ${exception.message}, Content-Type: ${request.headers['content-type']}, Content-Length: ${request.headers['content-length']}`
            );
        }

        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: message,
        });
    }
}
