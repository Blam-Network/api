import { Controller, Get, Inject, Param, Query, ParseIntPipe, NotFoundException, Headers, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags, ApiHeader } from "@nestjs/swagger";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { BnetUserService } from "../services/bnetuser.service";
import { EXAMPLE_XUID } from "src/constants";

@ApiTags('Datamine')
@Controller('/datamine')
export class DatamineController {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly bnetUserService: BnetUserService,
    ) { }

    @Get('/sessions')
    @ApiOperation({
        summary: 'List Datamine Sessions',
        description: 'Get a paginated list of datamine sessions',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    @ApiHeader({ name: 'x-uhs' })
    @ApiHeader({ name: 'Authorization' })
    async listSessions(
        @Headers('x-xuid') xuidHex: string,
        @Headers('x-uhs') userHash: string,
        @Headers('Authorization') xstsToken: string,
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 20,
        @Query('buildString') buildString?: string,
        @Query('systemId') systemId?: string,
    ) {
        // Validate token and check datamine access
        if (!xstsToken || !xuidHex || !userHash) {
            throw new BadRequestException('Authentication headers are required');
        }

        const { xuid } = await this.bnetUserService.validateXboxToken(
            xuidHex,
            userHash,
            xstsToken,
        );

        const user = await this.prisma.bnet_user.findUnique({
            where: {
                player_xuid: xuid,
            },
            select: {
                datamine_access: true,
            },
        });

        if (!user?.datamine_access) {
            throw new UnauthorizedException('Datamine access required');
        }
        const skip = (page - 1) * pageSize;
        
        const where: any = {};
        if (buildString) {
            where.build_string = { contains: buildString, mode: 'insensitive' };
        }
        if (systemId) {
            where.systemid = { contains: systemId, mode: 'insensitive' };
        }
        
        const [sessions, total] = await Promise.all([
            this.prisma.datamine_session.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: {
                    session_start_date: 'desc',
                },
                select: {
                    id: true,
                    sessionid: true,
                    build_string: true,
                    build_number: true,
                    systemid: true,
                    title: true,
                    session_start_date: true,
                    _count: {
                        select: {
                            events: true,
                        },
                    },
                },
            }),
            this.prisma.datamine_session.count({ where }),
        ]);

        return {
            sessions,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    @Get('/sessions/filter-options')
    @ApiOperation({
        summary: 'Get Filter Options',
        description: 'Get unique build strings for autocomplete',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    @ApiHeader({ name: 'x-uhs' })
    @ApiHeader({ name: 'Authorization' })
    async getFilterOptions(
        @Headers('x-xuid') xuidHex: string,
        @Headers('x-uhs') userHash: string,
        @Headers('Authorization') xstsToken: string,
    ) {
        // Validate token and check datamine access
        if (!xstsToken || !xuidHex || !userHash) {
            throw new BadRequestException('Authentication headers are required');
        }

        const { xuid } = await this.bnetUserService.validateXboxToken(
            xuidHex,
            userHash,
            xstsToken,
        );

        const user = await this.prisma.bnet_user.findUnique({
            where: {
                player_xuid: xuid,
            },
            select: {
                datamine_access: true,
            },
        });

        if (!user?.datamine_access) {
            throw new UnauthorizedException('Datamine access required');
        }
        const buildStrings = await this.prisma.datamine_session.findMany({
            select: {
                build_string: true,
            },
            distinct: ['build_string'],
            orderBy: {
                build_string: 'asc',
            },
        });

        return {
            buildStrings: buildStrings.map(s => s.build_string),
        };
    }

    @Get('/sessions/:sessionId/events')
    @ApiOperation({
        summary: 'Get Events for Session',
        description: 'Get all events for a specific datamine session',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    @ApiHeader({ name: 'x-uhs' })
    @ApiHeader({ name: 'Authorization' })
    @ApiParam({ name: 'sessionId', type: 'string' })
    async getSessionEvents(
        @Headers('x-xuid') xuidHex: string,
        @Headers('x-uhs') userHash: string,
        @Headers('Authorization') xstsToken: string,
        @Param('sessionId') sessionId: string,
        @Query('search') search?: string,
    ) {
        // Validate token and check datamine access
        if (!xstsToken || !xuidHex || !userHash) {
            throw new BadRequestException('Authentication headers are required');
        }

        const { xuid } = await this.bnetUserService.validateXboxToken(
            xuidHex,
            userHash,
            xstsToken,
        );

        const user = await this.prisma.bnet_user.findUnique({
            where: {
                player_xuid: xuid,
            },
            select: {
                datamine_access: true,
            },
        });

        if (!user?.datamine_access) {
            throw new UnauthorizedException('Datamine access required');
        }
        const session = await this.prisma.datamine_session.findUnique({
            where: { id: sessionId },
        });

        if (!session) {
            throw new NotFoundException(`Session ${sessionId} not found`);
        }

        const where: any = {
            session_id: sessionId,
        };

        if (search) {
            where.OR = [
                { message: { contains: search, mode: 'insensitive' } },
                { map: { contains: search, mode: 'insensitive' } },
            ];
        }

        const events = await this.prisma.datamine_event.findMany({
            where,
            orderBy: {
                event_date: 'asc',
            },
            include: {
                parameters: {
                    orderBy: {
                        key: 'asc',
                    },
                },
            },
        });

        return {
            session,
            events,
        };
    }
}

