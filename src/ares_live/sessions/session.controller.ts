import {
    Controller,
    Post,
    Get,
    UseInterceptors,
    UploadedFile,
    Inject,
    HttpException,
    HttpStatus,
    Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { SessionService } from './session.service';
import { Request } from 'express';

@ApiTags('Session')
@Controller('api/session')
export class SessionController {
    constructor(
        private readonly sessionService: SessionService,
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {}

    @Post('create')
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
    async create(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
        this.logger.log(`[SessionController] create() called - file: ${file ? 'present' : 'missing'}, method: ${req.method}, url: ${req.url}`);
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
            return await this.sessionService.createSessionAsync(file, req);
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
                throw new HttpException(
                    'File is required in multipart/form-data with field name "upload"',
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (!file.buffer || file.buffer.length === 0) {
                this.logger.warn('Session modify request has empty file buffer');
                throw new HttpException(
                    'File buffer is empty',
                    HttpStatus.BAD_REQUEST,
                );
            }

            await this.sessionService.modifySessionAsync(file);
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
    @ApiOperation({ summary: 'Search for sessions' })
    async search() {
        try {
            return await this.sessionService.searchSessionsAsync();
        } catch (error) {
            this.logger.error(`Unexpected error searching sessions: ${error}`);
            throw new HttpException(
                'An internal server error occurred while processing the session search request',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('join')
    @ApiOperation({ summary: 'Join a session' })
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
    async join(@UploadedFile() file: Express.Multer.File) {
        try {
            if (!file) {
                this.logger.warn('Session join request missing file');
                throw new HttpException(
                    'File is required in multipart/form-data with field name "upload"',
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (!file.buffer || file.buffer.length === 0) {
                this.logger.warn('Session join request has empty file buffer');
                throw new HttpException(
                    'File buffer is empty',
                    HttpStatus.BAD_REQUEST,
                );
            }

            await this.sessionService.joinSessionAsync(file);
        } catch (error) {
            this.logger.error(`Unexpected error joining session: ${error}`);
            if (error instanceof HttpException) {
                throw error;
            }
            if (error instanceof Error && error.message === 'Invalid player count') {
                throw new HttpException('Invalid player count', HttpStatus.BAD_REQUEST);
            }
            throw new HttpException(
                'An internal server error occurred while processing the session join request',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('get-by-secure-address')
    @ApiOperation({ summary: 'Get session by secure address' })
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
    async getBySecureAddress(@UploadedFile() file: Express.Multer.File) {
        try {
            if (!file) {
                this.logger.warn('Session get-by-secure-address request missing file');
                throw new HttpException(
                    'File is required in multipart/form-data with field name "upload"',
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (!file.buffer || file.buffer.length === 0) {
                this.logger.warn('Session get-by-secure-address request has empty file buffer');
                throw new HttpException(
                    'File buffer is empty',
                    HttpStatus.BAD_REQUEST,
                );
            }

            return await this.sessionService.getSessionBySecureAddressAsync(file);
        } catch (error) {
            this.logger.error(`Unexpected error getting session by secure address: ${error}`);
            if (error instanceof HttpException) {
                throw error;
            }
            if (error instanceof Error && error.message === 'No session found for secure address') {
                throw new HttpException('No session found for the provided secure address', HttpStatus.NOT_FOUND);
            }
            throw new HttpException(
                'An internal server error occurred while processing the session get by secure address request',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

