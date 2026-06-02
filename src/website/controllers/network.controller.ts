import { Controller, Get, ParseIntPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "src/db/prisma.service";

type RecentScreenshotGame = "halo3" | "odst" | "reach";

const SCREENSHOT_SELECT = {
    id: true,
    name: true,
    description: true,
    author: true,
    date: true,
} as const;

@ApiTags("Network")
@Controller("/network")
export class NetworkController {
    constructor(private readonly prisma: PrismaService) {}

    @Get("/recent-screenshots")
    @ApiOperation({
        summary: "Get Recent Screenshots (all games)",
        description:
            "Returns the most recent blind screenshots across Halo 3, Halo 3: ODST, and Halo: Reach, merged by upload date.",
    })
    @ApiQuery({ name: "limit", required: false, type: Number, description: "Max results (default 12)" })
    @ApiQuery({
        name: "perGame",
        required: false,
        type: Number,
        description: "Candidates fetched per title before merge (default 8)",
    })
    async getRecentScreenshots(
        @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 12,
        @Query("perGame", new ParseIntPipe({ optional: true })) perGame: number = 8,
    ) {
        const take = Math.min(Math.max(perGame, 1), 50);
        const resultLimit = Math.min(Math.max(limit, 1), 50);

        const [halo3, odst, reach] = await Promise.all([
            this.prisma.halo3_blind_screenshot.findMany({
                orderBy: { date: "desc" },
                take,
                select: SCREENSHOT_SELECT,
            }),
            this.prisma.odst_blind_screenshot.findMany({
                orderBy: { date: "desc" },
                take,
                select: SCREENSHOT_SELECT,
            }),
            this.prisma.reach_blind_screenshot.findMany({
                orderBy: { date: "desc" },
                take,
                select: SCREENSHOT_SELECT,
            }),
        ]);

        const mapRow = (
            sc: (typeof halo3)[number],
            game: RecentScreenshotGame,
        ) => ({
            id: sc.id,
            game,
            header: {
                filename: sc.name,
                description: sc.description,
            },
            author: sc.author,
            date: sc.date,
        });

        return [...halo3.map((sc) => mapRow(sc, "halo3")), ...odst.map((sc) => mapRow(sc, "odst")), ...reach.map((sc) => mapRow(sc, "reach"))]
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, resultLimit);
    }
}
