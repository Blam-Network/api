import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    Inject,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { StatsService } from './stats.service';

@ApiTags('Stats')
@Controller('api/stats')
export class StatsController {
    constructor(
        private readonly statsService: StatsService,
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {}

    @Post('query')
    @ApiOperation({ summary: 'Query player statistics' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async query(@UploadedFile() file: Express.Multer.File) {
        try {
            return await this.statsService.buildStatsQueryResponseBlf(file);
        } catch (error) {
            this.logger.error(`Unexpected error querying stats: ${error}`);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'An internal server error occurred while processing the stats query',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

