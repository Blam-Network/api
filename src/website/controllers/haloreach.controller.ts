import { Controller, Get, Header, Param, StreamableFile } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { HaloReachFileShareService } from "../services/haloreachfileshare.service";

@ApiTags('Halo: Reach')
@Controller('/haloreach')
export class HaloReachController {
    constructor(
        private readonly fileshareService: HaloReachFileShareService,
    ) { }

    @Get('/screenshots/:id/view')
    @ApiOperation({
        summary: 'View Screenshot',
        description: 'Returns an uploaded Halo 3 JPEG screenshot.'
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