import { Controller, Post, Get, Inject, Body, Param, BadRequestException, UnauthorizedException, Headers } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags, ApiBody, ApiHeader } from "@nestjs/swagger";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { EXAMPLE_XUID } from "src/constants";
import { JwtService } from "../services/jwt.service";
import { BnetUserService } from "../services/bnetuser.service";

@ApiTags('User')
@Controller('/user')
export class UserController {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly bnetUserService: BnetUserService,
    ) { }

    @Post('/register')
    @ApiOperation({
        summary: 'Register User',
        description: 'Register or update a user using JWT token and set is_registered to true',
    })
    @ApiHeader({ name: 'Authorization', description: 'NextAuth JWT token (Bearer token)' })
    async registerUser(
        @Headers('Authorization') jwtToken: string,
    ) {
        if (!jwtToken) {
            throw new BadRequestException('Authorization header with JWT token is required');
        }

        try {
            // Validate JWT token and get user XUID
            const { user: jwtUser } = await this.jwtService.validateJwtToken(jwtToken);
            const xuid = jwtUser.xuid;

            // Check if user is already registered
            const existingUser = await this.prisma.bnet_user.findUnique({
                where: {
                    player_xuid: xuid,
                },
                select: {
                    is_registered: true,
                },
            });

            // Only update if not already registered (idempotent)
            if (!existingUser || !existingUser.is_registered) {
                await this.prisma.bnet_user.upsert({
                    where: {
                        player_xuid: xuid,
                    },
                    update: {
                        is_registered: true,
                    },
                    create: {
                        player_xuid: xuid,
                        is_registered: true,
                        datamine_access: false,
                    },
                });
            }

            return { success: true, xuid, gamertag: jwtUser.gamertag };
        } catch (error) {
            if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Failed to register user: ${error}`);
            throw new UnauthorizedException('Failed to validate JWT token');
        }
    }

    @Get()
    @ApiOperation({
        summary: 'Get User',
        description: 'Get current user validated via Xbox XSTS token',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    @ApiHeader({ name: 'x-uhs' })
    @ApiHeader({ name: 'Authorization', description: 'XSTS token' })
    async getUser(
        @Headers('x-xuid') xuidHex: string,
        @Headers('x-uhs') userHash: string,
        @Headers('Authorization') xstsToken: string,
    ) {
        if (!xuidHex || !userHash || !xstsToken) {
            throw new BadRequestException('x-xuid, x-uhs, and Authorization headers are required');
        }

        const { xuid } = await this.bnetUserService.validateXboxToken(xuidHex, userHash, xstsToken);

        const user = await this.prisma.bnet_user.findUnique({
            where: {
                player_xuid: xuid,
            },
        });

        return {
            datamine_access: user?.datamine_access,
            is_admin: user?.is_admin,
        }
    }
}

