import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    Inject,
    HttpException,
    HttpStatus,
    HttpCode,
    Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { StatsService } from './stats.service';
import { StreamableFile } from '@nestjs/common';

@ApiTags('Stats')
@Controller('api/stats')
export class StatsController {
    constructor(
        private readonly statsService: StatsService,
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {}

    @Post('query')
    @HttpCode(200)
    @ApiOperation({ summary: 'Query player statistics' })
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
    async query(@UploadedFile() file: Express.Multer.File, @Res({ passthrough: true }) res: Response) {
        this.logger.log(`[StatsController] query() called - file: ${file ? 'present' : 'missing'}`);
        try {
            if (!file) {
                this.logger.warn('Stats query request missing file');
                throw new HttpException(
                    'File is required in multipart/form-data with field name "upload"',
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (!file.buffer || file.buffer.length === 0) {
                this.logger.warn('Stats query request has empty file buffer');
                throw new HttpException(
                    'File buffer is empty',
                    HttpStatus.BAD_REQUEST,
                );
            }

            this.logger.log(`Stats query request received: filename=${file.originalname}, size=${file.size}, contentType=${file.mimetype}, bufferLength=${file.buffer.length}`);
            const { buffer, size } = await this.statsService.buildStatsQueryResponseBlf(file);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', size.toString());
            return new StreamableFile(buffer);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            if (error instanceof Error && error.message.includes('Invalid BLF format')) {
                this.logger.error(`BLF parsing error in stats query: ${error.message}`);
                throw new HttpException(
                    `Invalid file format: ${error.message}`,
                    HttpStatus.BAD_REQUEST,
                );
            }
            this.logger.error(`Unexpected error querying stats: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'N/A'}`);
            throw new HttpException(
                'An internal server error occurred while processing the stats query',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

