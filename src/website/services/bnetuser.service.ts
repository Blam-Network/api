import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";

export interface ValidateTokenResult {
    xuid: string;
    gamertag?: string;
}

@Injectable()
export class BnetUserService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Validate XSTS token with Xbox API and extract user details
     * @param xuidHex - User's XUID in hex format (from x-xuid header)
     * @param userHash - User hash (from x-uhs header)
     * @param xstsToken - XSTS token (from Authorization header)
     * @returns User details including XUID and optionally gamertag
     * @throws UnauthorizedException if token validation fails
     */
    async validateXboxToken(
        xuidHex: string,
        userHash: string,
        xstsToken: string,
    ): Promise<ValidateTokenResult> {
        // Convert hex XUID to decimal string
        const xuid = BigInt('0x' + xuidHex).toString(10);

        // Validate token by calling Xbox Profile API
        // The XSTS token should be used with Authorization header format: XBL3.0 x=<userHash>;<xstsToken>
        const authHeader = `XBL3.0 x=${userHash};${xstsToken}`;
        
        const profileResponse = await fetch(
            'https://profile.xboxlive.com/users/me/profile/settings',
            {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                    'x-xbl-contract-version': '3',
                },
            }
        );

        if (!profileResponse.ok) {
            const errorText = await profileResponse.text();
            this.logger.warn(`XSTS token validation failed: ${profileResponse.status} ${errorText}`);
            throw new UnauthorizedException('Invalid XSTS token: could not validate with Xbox API');
        }

        const profileData = await profileResponse.json();
        let gamertag: string | undefined;

        // Try to get gamertag from profile if available
        if (profileData.profileUsers && profileData.profileUsers[0]) {
            const settings = profileData.profileUsers[0].settings;
            const gamertagSetting = settings?.find((s: any) => s.id === 'Gamertag');
            if (gamertagSetting) {
                gamertag = gamertagSetting.value;
            }
            // Verify XUID matches if provided in profile
            if (profileData.profileUsers[0].id) {
                const profileXuid = profileData.profileUsers[0].id;
                if (xuid !== profileXuid) {
                    this.logger.warn(`XUID mismatch: header=${xuid}, profile=${profileXuid}`);
                }
            }
        }

        return { xuid, gamertag };
    }
}

