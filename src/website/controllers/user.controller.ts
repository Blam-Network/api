import { Controller, Post, Get, Inject, Body, Param, BadRequestException, UnauthorizedException, Headers } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags, ApiBody, ApiHeader } from "@nestjs/swagger";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { PrismaService } from "src/db/prisma.service";
import { EXAMPLE_XUID } from "src/constants";
import { BnetUserService } from "../services/bnetuser.service";

@ApiTags('User')
@Controller('/user')
export class UserController {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
        private readonly bnetUserService: BnetUserService,
    ) { }

    @Post('/register')
    @ApiOperation({
        summary: 'Register User',
        description: 'Register or update a user, validating XSTS token and setting is_registered to true',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    @ApiHeader({ name: 'x-uhs' })
    @ApiHeader({ name: 'Authorization' })
    async registerUser(
        @Headers('x-xuid') xuidHex: string,
        @Headers('x-uhs') userHash: string,
        @Headers('Authorization') xstsToken: string,
    ) {
        if (!xstsToken) {
            throw new BadRequestException('XSTS token is required');
        }
        if (!xuidHex) {
            throw new BadRequestException('XUID is required');
        }
        if (!userHash) {
            throw new BadRequestException('User hash is required');
        }

        try {
            // Validate token and get user details from Xbox API
            const { xuid, gamertag } = await this.bnetUserService.validateXboxToken(
                xuidHex,
                userHash,
                xstsToken,
            );

            // Register/update user in database
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

            return { success: true, xuid, gamertag };
        } catch (error) {
            if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Failed to register user: ${error}`);
            throw new UnauthorizedException('Failed to validate XSTS token');
        }
    }

    @Get()
    @ApiOperation({
        summary: 'Get User',
        description: 'Get current user information including datamine access',
    })
    @ApiHeader({ name: 'x-xuid', example: EXAMPLE_XUID })
    @ApiHeader({ name: 'x-uhs' })
    @ApiHeader({ name: 'Authorization' })
    async getUser(
        @Headers('x-xuid') xuidHex: string,
        @Headers('x-uhs') userHash: string,
        @Headers('Authorization') xstsToken: string,
    ) {
        if (!xstsToken) {
            throw new BadRequestException('XSTS token is required');
        }
        if (!xuidHex) {
            throw new BadRequestException('XUID is required');
        }
        if (!userHash) {
            throw new BadRequestException('User hash is required');
        }

        // Validate token and get user XUID
        const { xuid } = await this.bnetUserService.validateXboxToken(
            xuidHex,
            userHash,
            xstsToken,
        );

        // Get datamine access
        const user = await this.prisma.bnet_user.findUnique({
            where: {
                player_xuid: xuid,
            },
            select: {
                datamine_access: true,
            },
        });

        return {
            datamineAccess: user?.datamine_access ?? false,
        };
    }
}

