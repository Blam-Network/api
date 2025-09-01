import { Inject, Injectable } from "@nestjs/common";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { EXAMPLE_XUID } from "src/constants";
import { PrismaService } from "src/db/prisma.service";
import { parseXuid } from "src/xbox/xuid";

enum WhitelistStatusCode {
    SUCCESS = 0,
    NOT_AUTHORIZED = -1,
    WRONG_MACHINE = -2,
    GAME_DISABLED = -3,
}

enum WhitelistOperationMode {
    NORMAL,
    ALLOW_ALL,
    ALLOW_NONE,
};

const OPERATION_MODE: WhitelistOperationMode = WhitelistOperationMode.ALLOW_ALL

const buildWhitelistResponse = (
    allowedXuids: number[],
    allowedVIPXuids: number[],
    statusCode: WhitelistStatusCode,
) => {
    const allowed = Number(allowedXuids.length > 0 || allowedVIPXuids.length > 0);
    
    let response = `Allowed: ${allowed}\r\n`;
    for (let i = 0; i < allowedXuids.length && i < 4; i++) {
        response += `AllowedXuid${i}: ${allowedXuids[i]}\r\n`
    }
    for (let i = 0; i < allowedVIPXuids.length && i < 4; i++) {
        response += `AllowedVIPXuid${i}: ${allowedVIPXuids[i]}\r\n`
    }
    response += `ErrorCode: ${statusCode.valueOf()}`

    return response;
}

export const getExampleResponse = () => {
    return buildWhitelistResponse([parseXuid(EXAMPLE_XUID)], [parseXuid(EXAMPLE_XUID)], WhitelistStatusCode.SUCCESS);
}

@Injectable()
export class HaloReachWhitelistService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) { }

    public getWhitelistResponse = async (machineId: number, xuids: number[]) => {
        switch (OPERATION_MODE) {
            case WhitelistOperationMode.ALLOW_ALL: {
                return buildWhitelistResponse(xuids, [], WhitelistStatusCode.SUCCESS);
            }
            case WhitelistOperationMode.ALLOW_NONE: {
                return buildWhitelistResponse([], [], WhitelistStatusCode.GAME_DISABLED);
            }
            case WhitelistOperationMode.NORMAL: {
                const whitelistedXuids = (await this.prisma.reach_player_data.findMany({
                    where: { player_xuid: { in: xuids }, is_whitelisted: true },
                    select: { player_xuid: true }
                })).map(playerData => Number(playerData.player_xuid))

                const vipXuids = (await this.prisma.reach_player_data.findMany({
                    where: { player_xuid: { in: xuids }, is_vip: true },
                    select: { player_xuid: true }
                })).map(playerData => Number(playerData.player_xuid))

                return buildWhitelistResponse(whitelistedXuids, vipXuids, WhitelistStatusCode.SUCCESS);
            }
        }
    }
}