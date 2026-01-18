import {
    Controller,
    Post,
    Get,
    UseInterceptors,
    UploadedFile,
    Inject,
    HttpException,
    HttpStatus,
    Ip,
    HttpCode,
    Res,
    BadRequestException,
    InternalServerErrorException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { SessionService } from './session.service';
import { Response } from 'express';
import { StreamableFile } from '@nestjs/common';

/**
 * Normalizes an IP address to IPv4 format, handling IPv4-mapped IPv6 addresses
 */
function normalizeIpAddress(ip: string): string {
    if (!ip) {
        return '0.0.0.0';
    }
    // Handle IPv4-mapped IPv6 addresses (::ffff:xxx.xxx.xxx.xxx)
    const ipv4Match = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (ipv4Match) {
        return ipv4Match[1];
    }
    // Return IPv4 addresses as-is
    if (ip.includes('.')) {
        return ip;
    }
    // Default for other cases (pure IPv6, etc.)
    return '0.0.0.0';
}

@ApiTags('Session')
@Controller('api/session')
export class SessionController {
    constructor(
        private readonly sessionService: SessionService,
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {}

    @Post('create')
    @HttpCode(200)
    @ApiOperation({ summary: 'Create a new session' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                upload: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('upload'))
    async create(@UploadedFile() file: Express.Multer.File, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
        try {
            if (!file) {
                this.logger.warn('Session create request missing file');
                throw new HttpException(
                    'File is required in multipart/form-data with field name "upload"',
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (!file.buffer || file.buffer.length === 0) {
                this.logger.warn('Session create request has empty file buffer');
                throw new HttpException(
                    'File buffer is empty',
                    HttpStatus.BAD_REQUEST,
                );
            }

            this.logger.log(`Session create request received: filename=${file.originalname}, size=${file.size}, contentType=${file.mimetype}, bufferLength=${file.buffer.length}`);
            const usableAddress = normalizeIpAddress(ip);
            const { buffer, size } = await this.sessionService.createSessionAsync(file, usableAddress);
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', size.toString());
            this.logger.log(`Returning BLF response: ${size} bytes`);
            return new StreamableFile(buffer);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            if (error instanceof Error && error.message.includes('Invalid BLF format')) {
                this.logger.error(`BLF parsing error in session create: ${error.message}`);
                throw new HttpException(
                    `Invalid file format: ${error.message}`,
                    HttpStatus.BAD_REQUEST,
                );
            }
            this.logger.error(`Unexpected error creating session: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'N/A'}`);
            throw new HttpException(
                'An internal server error occurred while processing the session create request',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('modify')
    @HttpCode(200)
    @ApiOperation({ summary: 'Modify an existing session' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                upload: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('upload'))
    async modify(@UploadedFile() file: Express.Multer.File) {
        try {
            if (!file) {
                this.logger.warn('Session modify request missing file');
                throw new BadRequestException('File is required in multipart/form-data with field name "upload"');
            }

            if (!file.buffer || file.buffer.length === 0) {
                this.logger.warn('Session modify request has empty file buffer');
                throw new BadRequestException('File buffer is empty');
            }

            const success = await this.sessionService.modifySessionAsync(file);
            
            if (!success) {
                throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
            }
            
            this.logger.log('Session modify completed successfully');
            return "ok";
        } catch (error) {
            this.logger.error(`Unexpected error modifying session: ${error}`);
            if (error instanceof HttpException) {
                throw error;
            }
            if (error instanceof Error && error.message === 'Session not found') {
                throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
            }
            throw new HttpException(
                'An internal server error occurred while processing the session modify request',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('search')
    @HttpCode(200)
    @ApiOperation({ summary: 'Search for sessions' })
    async search(@Res({ passthrough: true }) res: Response) {
        try {
            this.logger.log('Session search request received');
            const { buffer, size } = await this.sessionService.searchSessionsAsync();
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', size.toString());
            this.logger.log(`Returning BLF response: ${size} bytes`);
            return new StreamableFile(buffer);
        } catch (error) {
            this.logger.error(`Unexpected error searching sessions: ${error}`);
            throw new HttpException(
                'An internal server error occurred while processing the session search request',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('migrate-host')
    @HttpCode(200)
    @ApiOperation({ summary: 'Migrate session host' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                upload: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('upload'))
    async migrateHost(@UploadedFile() file: Express.Multer.File, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
        try {
            if (!file) {
                this.logger.warn('Session migrate host request missing file');
                throw new BadRequestException('File is required in multipart/form-data with field name "upload"');
            }

            if (!file.buffer || file.buffer.length === 0) {
                this.logger.warn('Session migrate host request has empty file buffer');
                throw new BadRequestException('File buffer is empty');
            }

            const usableAddress = normalizeIpAddress(ip);
            const sessionIdHex = file.buffer.length >= 8 
                ? Buffer.from(file.buffer.slice(0, 8)).toString('hex') 
                : 'unknown';
            this.logger.log(
                `Session migrate host request: SessionId=${sessionIdHex}, SecureAddress length=${file.buffer.length >= 328 ? 320 : 0}`,
            );

            const result = await this.sessionService.migrateHostAsync(file, usableAddress);

            if (!result) {
                throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
            }

            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', result.size.toString());
            this.logger.log(`Returning BLF response: ${result.size} bytes`);
            return new StreamableFile(result.buffer);
        } catch (error) {
            this.logger.error(`Unexpected error migrating host: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'N/A'}`);
            if (error instanceof HttpException) {
                throw error;
            }
            if (error instanceof Error && error.message.includes('Invalid BLF format')) {
                this.logger.error(`BLF parsing error in session migrate host: ${error.message}`);
                throw new HttpException(
                    `Invalid file format: ${error.message}`,
                    HttpStatus.BAD_REQUEST,
                );
            }
            throw new HttpException(
                'An internal server error occurred while processing the session migrate host request',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('get-by-id')
    @HttpCode(200)
    @ApiOperation({ summary: 'Get session by ID' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                upload: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('upload'))
    async getById(@UploadedFile() file: Express.Multer.File, @Res({ passthrough: true }) res: Response) {
        try {
            if (!file) {
                this.logger.warn('Session get by id request missing file');
                throw new BadRequestException('File is required in multipart/form-data with field name "upload"');
            }

            if (!file.buffer || file.buffer.length === 0) {
                this.logger.warn('Session get by id request has empty file buffer');
                throw new BadRequestException('File buffer is empty');
            }

            const sessionIdHex = file.buffer.length >= 8 
                ? Buffer.from(file.buffer.slice(0, 8)).toString('hex') 
                : 'unknown';
            this.logger.log(
                `Session get by id request: SessionId=${sessionIdHex}`,
            );

            const result = await this.sessionService.getSessionByIdAsync(file);

            if (!result) {
                throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
            }

            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', result.size.toString());
            this.logger.log(`Returning BLF response: ${result.size} bytes`);
            return new StreamableFile(result.buffer);
        } catch (error) {
            this.logger.error(`Unexpected error getting session by id: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'N/A'}`);
            if (error instanceof HttpException) {
                throw error;
            }
            if (error instanceof Error && error.message.includes('Invalid BLF format')) {
                this.logger.error(`BLF parsing error in session get by id: ${error.message}`);
                throw new HttpException(
                    `Invalid file format: ${error.message}`,
                    HttpStatus.BAD_REQUEST,
                );
            }
            throw new HttpException(
                'An internal server error occurred while processing the session get by id request',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('delete')
    @HttpCode(200)
    @ApiOperation({ summary: 'Delete a session' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                upload: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('upload'))
    async delete(@UploadedFile() file: Express.Multer.File, @Ip() ip: string) {
        try {
            if (!file) {
                this.logger.warn('Session delete request missing file');
                throw new BadRequestException('File is required in multipart/form-data with field name "upload"');
            }

            if (!file.buffer || file.buffer.length === 0) {
                this.logger.warn('Session delete request has empty file buffer');
                throw new BadRequestException('File buffer is empty');
            }

            const requesterIpAddress = normalizeIpAddress(ip);
            const sessionIdHex = file.buffer.length >= 8 
                ? Buffer.from(file.buffer.slice(0, 8)).toString('hex') 
                : 'unknown';
            this.logger.log(
                `Session delete request: SessionId=${sessionIdHex}, RequesterIP=${requesterIpAddress}`,
            );

            const success = await this.sessionService.deleteSessionAsync(file, requesterIpAddress);
            
            if (success) {
                this.logger.log('Session delete completed successfully');
            } else {
                this.logger.log('Session delete: session not found or IP address mismatch (returning success for idempotency)');
            }

            return "ok";
        } catch (error) {
            this.logger.error(`Unexpected error deleting session: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'N/A'}`);
            throw new InternalServerErrorException('An internal server error occurred while processing the session delete request');
        }
    }
}

