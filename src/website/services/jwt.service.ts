import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { decode } from 'next-auth/jwt';
import ILogger, { ILoggerSymbol } from 'src/ILogger';

export interface JWTUser {
    xuid: string;
    gamertag: string;
    xboxUserHash: string;
    email: string;
    role?: string;
}

export interface ValidatedJWT {
    user: JWTUser;
}

@Injectable()
export class JwtService {
    private readonly secret: string;

    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {
        const secretString = process.env.NEXTAUTH_SECRET;
        if (!secretString) {
            throw new Error('NEXTAUTH_SECRET environment variable is required');
        }
        this.secret = secretString;
    }

    /**
     * Validate NextAuth JWE token and extract user information
     * @param token - The encrypted JWE token string (without "Bearer " prefix)
     * @returns User details including XUID
     * @throws UnauthorizedException if token validation fails
     */
    async validateJwtToken(token: string): Promise<ValidatedJWT> {
        if (!token) {
            throw new UnauthorizedException('JWT token is required');
        }

        try {
            // Remove "Bearer " prefix if present
            const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

            // Decrypt the JWE token using NextAuth's decode function
            const payload = await decode({
                token: cleanToken,
                secret: this.secret,
            });

            if (!payload) {
                throw new UnauthorizedException('Invalid JWT token: failed to decode');
            }

            // Validate payload structure
            if (!payload.user || typeof payload.user !== 'object') {
                throw new UnauthorizedException('Invalid JWT token: missing user data');
            }

            const user = payload.user as any;
            if (!user.xuid || typeof user.xuid !== 'string') {
                throw new UnauthorizedException('Invalid JWT token: missing or invalid xuid');
            }

            return {
                user: {
                    xuid: user.xuid,
                    gamertag: user.gamertag || '',
                    xboxUserHash: user.xboxUserHash || '',
                    email: user.email || '',
                    role: user.role || 'user',
                },
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            this.logger.warn(`JWT token validation failed: ${error}`);
            throw new UnauthorizedException('Invalid or expired JWT token');
        }
    }
}

