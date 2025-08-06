import { Controller, Get, Header, Headers, Inject, NotFoundException, Param, ParseBoolPipe, ParseIntPipe, Post, Query, Res, StreamableFile, UnauthorizedException } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { EXAMPLE_XUID } from "src/lsp/constants";
import { AchievementsService } from "../services/achievements.service";
import { parseXuid } from "src/xbox/xuid";
import { PrismaService } from "src/db/prisma.service";
import { Halo3EmblemsService } from "../services/halo3emblems.service";
import { Halo3FileShareService } from "../services/halo3fileshare.service";

@ApiTags('Halo 3: ODST')
@Controller('/halo3odst')
export class Halo3ODSTController {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly fileshareService: Halo3FileShareService,
    ) { }

    @Get('/screenshots/:id/view')
    @ApiOperation({
        summary: 'View Screenshot',
        description: 'Returns an uploaded Halo 3: ODST JPEG screenshot.'
    })
    @Header('Content-Type', 'image/jpeg')
    async viewScreenshot(
        @Param('id') id: string,
    ) {
        return new StreamableFile(
            Uint8Array.from(await this.fileshareService.viewBlindScreenshot(id))
        );
    }
}