import { Controller, Get, Header, Inject, Param, StreamableFile } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import ILogger, { ILoggerSymbol } from "src/ILogger";
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
            Uint8Array.from(await this.fileshareService.viewOdstBlindScreenshot(id))
        );
    }
}