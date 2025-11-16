import { Controller, Get, Inject, Param, Query, ParseIntPipe, NotFoundException, Headers, UnauthorizedException, BadRequestException, Header, StreamableFile } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags, ApiHeader } from "@nestjs/swagger";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { JwtService } from "../services/jwt.service";

@ApiTags('Datamine')
@Controller('/datamine')
export class DatamineController {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    @Get('/sessions')
    @ApiOperation({
        summary: 'List Datamine Sessions',
        description: 'Get a paginated list of datamine sessions',
    })
    @ApiHeader({ name: 'Authorization', description: 'NextAuth JWT token (Bearer token)' })
    async listSessions(
        @Headers('Authorization') jwtToken: string,
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 20,
        @Query('buildString') buildString?: string,
        @Query('systemId') systemId?: string,
    ) {
        // Validate JWT token and check datamine access
        if (!jwtToken) {
            throw new BadRequestException('Authorization header with JWT token is required');
        }

        const { user: jwtUser } = await this.jwtService.validateJwtToken(jwtToken);
        const xuid = jwtUser.xuid;

        const dbUser = await this.prisma.bnet_user.findUnique({
            where: {
                player_xuid: xuid,
            },
            select: {
                datamine_access: true,
            },
        });

        if (!dbUser?.datamine_access) {
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
    @ApiHeader({ name: 'Authorization', description: 'NextAuth JWT token (Bearer token)' })
    async getFilterOptions(
        @Headers('Authorization') jwtToken: string,
    ) {
        // Validate JWT token and check datamine access
        if (!jwtToken) {
            throw new BadRequestException('Authorization header with JWT token is required');
        }

        const { user: jwtUser } = await this.jwtService.validateJwtToken(jwtToken);
        const xuid = jwtUser.xuid;

        const dbUser = await this.prisma.bnet_user.findUnique({
            where: {
                player_xuid: xuid,
            },
            select: {
                datamine_access: true,
            },
        });

        if (!dbUser?.datamine_access) {
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
        description: 'Get events for a specific datamine session (max 1000 per request, use page for pagination)',
    })
    @ApiHeader({ name: 'Authorization', description: 'NextAuth JWT token (Bearer token)' })
    @ApiParam({ name: 'sessionId', type: 'string' })
    async getSessionEvents(
        @Headers('Authorization') jwtToken: string,
        @Param('sessionId') sessionId: string,
        @Query('search') search?: string,
        @Query('categories') categories?: string, // Comma-separated list
        @Query('priorities') priorities?: string, // Comma-separated list
        @Query('maps') maps?: string, // Comma-separated list of map filenames
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    ) {
        // Validate JWT token and check datamine access
        if (!jwtToken) {
            throw new BadRequestException('Authorization header with JWT token is required');
        }

        const { user: jwtUser } = await this.jwtService.validateJwtToken(jwtToken);
        const xuid = jwtUser.xuid;

        const dbUser = await this.prisma.bnet_user.findUnique({
            where: {
                player_xuid: xuid,
            },
            select: {
                datamine_access: true,
            },
        });

        if (!dbUser?.datamine_access) {
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

        const orConditions: any[] = [];

        if (search) {
            orConditions.push({ message: { contains: search, mode: 'insensitive' } });
        }

        // Category filter: check if categories array has any of the selected categories
        if (categories) {
            const categoryList = categories.split(',').filter(c => c.trim().length > 0);
            if (categoryList.length > 0) {
                where.categories = {
                    hasSome: categoryList,
                };
            }
        }

        // Priority filter: check if priority is in the selected priorities
        if (priorities) {
            const priorityList = priorities.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
            if (priorityList.length > 0) {
                where.priority = {
                    in: priorityList,
                };
            }
        }

        // Map filter: check if map filename matches any of the selected maps
        if (maps) {
            const mapList = maps.split(',').filter(m => m.trim().length > 0);
            if (mapList.length > 0) {
                // Add OR conditions for map filenames
                orConditions.push(...mapList.map(mapFilename => ({
                    map: {
                        endsWith: mapFilename,
                    },
                })));
            }
        }

        // Combine OR conditions if any exist
        if (orConditions.length > 0) {
            where.OR = orConditions;
        }

        const pageSize = 1000;
        const skip = (page - 1) * pageSize;

        const [events, total] = await Promise.all([
            this.prisma.datamine_event.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: {
                    event_index: 'asc',
                },
                include: {
                    parameters: {
                        orderBy: {
                            key: 'asc',
                        },
                    },
                },
            }),
            this.prisma.datamine_event.count({ where }),
        ]);

        return {
            session,
            events,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    @Get('/sessions/:sessionId/events/all')
    @ApiOperation({
        summary: 'Download All Events as Log File',
        description: 'Download all events for a specific datamine session as a formatted .txt log file',
    })
    @ApiHeader({ name: 'Authorization', description: 'NextAuth JWT token (Bearer token)' })
    @ApiParam({ name: 'sessionId', type: 'string' })
    @Header('Content-Type', 'text/plain')
    async downloadSessionLog(
        @Headers('Authorization') jwtToken: string,
        @Param('sessionId') sessionId: string,
    ) {
        // Validate JWT token and check datamine access
        if (!jwtToken) {
            throw new BadRequestException('Authorization header with JWT token is required');
        }

        const { user: jwtUser } = await this.jwtService.validateJwtToken(jwtToken);
        const xuid = jwtUser.xuid;

        const dbUser = await this.prisma.bnet_user.findUnique({
            where: {
                player_xuid: xuid,
            },
            select: {
                datamine_access: true,
            },
        });

        if (!dbUser?.datamine_access) {
            throw new UnauthorizedException('Datamine access required');
        }

        const session = await this.prisma.datamine_session.findUnique({
            where: { id: sessionId },
        });

        if (!session) {
            throw new NotFoundException(`Session ${sessionId} not found`);
        }

        // Get all events for this session, ordered by event_index
        const events = await this.prisma.datamine_event.findMany({
            where: {
                session_id: sessionId,
            },
            orderBy: {
                event_index: 'asc',
            },
        });

        // Helper function to format date as MM.DD.YY HH:mm:ss.SSS
        const formatEventDateTime = (date: Date): string => {
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
            return `${month}.${day}.${year} ${hours}:${minutes}:${seconds}.${milliseconds}`;
        };

        // Helper function to format event index as 7 digits
        const formatEventIndex = (index: number): string => {
            return String(index).padStart(7, '0');
        };

        // Priority mapping
        const PRIORITY_MAP: Record<number, string> = {
            0: "verbose",
            1: "status",
            2: "message",
            3: "WARNING",
            4: "-ERROR-",
            5: "-CRITICAL-",
        };

        const getPriorityString = (priority: number): string => {
            return PRIORITY_MAP[priority] || `Unknown (${priority})`;
        };

        // Build the log file content
        let logContent = '============================================================================================\n';
        logContent += `blamnet datamine ${session.title} ${session.build_string} \n`;
        logContent += '============================================================================================\n\n';

        // Add each event
        events.forEach((event) => {
            const dateStr = formatEventDateTime(event.event_date);
            const indexStr = formatEventIndex(event.event_index);
            const priorityStr = getPriorityString(event.priority);
            logContent += `${dateStr} ${indexStr} ${priorityStr} ${event.message}\n`;
        });

        // Return as StreamableFile with proper filename
        const buffer = Buffer.from(logContent, 'utf-8');
        return new StreamableFile(buffer, {
            disposition: `attachment; filename="${session.sessionid}_datamine.txt"`,
        });
    }

    @Get('/sessions/:sessionId/filter-options')
    @ApiOperation({
        summary: 'Get Filter Options for Session',
        description: 'Get all unique categories, priorities, and maps for a specific datamine session',
    })
    @ApiHeader({ name: 'Authorization', description: 'NextAuth JWT token (Bearer token)' })
    @ApiParam({ name: 'sessionId', type: 'string' })
    async getSessionFilterOptions(
        @Headers('Authorization') jwtToken: string,
        @Param('sessionId') sessionId: string,
    ) {
        // Validate JWT token and check datamine access
        if (!jwtToken) {
            throw new BadRequestException('Authorization header with JWT token is required');
        }

        const { user: jwtUser } = await this.jwtService.validateJwtToken(jwtToken);
        const xuid = jwtUser.xuid;

        const dbUser = await this.prisma.bnet_user.findUnique({
            where: {
                player_xuid: xuid,
            },
            select: {
                datamine_access: true,
            },
        });

        if (!dbUser?.datamine_access) {
            throw new UnauthorizedException('Datamine access required');
        }

        const session = await this.prisma.datamine_session.findUnique({
            where: { id: sessionId },
        });

        if (!session) {
            throw new NotFoundException(`Session ${sessionId} not found`);
        }

        // Get all events for this session to extract unique values
        const allEvents = await this.prisma.datamine_event.findMany({
            where: {
                session_id: sessionId,
            },
            select: {
                categories: true,
                priority: true,
                map: true,
            },
        });

        // Extract unique categories
        const categoriesSet = new Set<string>();
        allEvents.forEach(event => {
            event.categories.forEach(cat => categoriesSet.add(cat));
        });

        // Extract unique priorities
        const prioritiesSet = new Set<number>();
        allEvents.forEach(event => {
            prioritiesSet.add(event.priority);
        });

        // Extract unique map filenames
        const mapsSet = new Set<string>();
        allEvents.forEach(event => {
            if (event.map) {
                const mapFilename = event.map.split(/[/\\]/).pop() || event.map;
                if (mapFilename) {
                    mapsSet.add(mapFilename);
                }
            }
        });

        return {
            categories: Array.from(categoriesSet).sort(),
            priorities: Array.from(prioritiesSet).sort((a, b) => a - b),
            maps: Array.from(mapsSet).sort(),
        };
    }
}

