import { Inject, Injectable } from "@nestjs/common";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { EXAMPLE_XUID } from "src/constants";
import { PrismaService } from "src/db/prisma.service";
import { timeLimited } from "src/utils/resiliance";
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
    allowedXuids: BigInt[],
    allowedVIPXuids: BigInt[],
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

    public getWhitelistResponse = async (machineId: BigInt, xuids: BigInt[]) => {
        let vipXuids: BigInt[] = []
        let whitelistXuids: BigInt[] = [];
        let status = WhitelistStatusCode.NOT_AUTHORIZED;

        vipXuids = await timeLimited(
            this.prisma.reach_player_data.findMany({
                where: { player_xuid: { in: xuids.map(xuid => xuid.toString()) }, is_vip: true },
                select: { player_xuid: true },
            }).then(players => players.map(p => BigInt(p.player_xuid.toFixed(0)))),
            {
                limit: { value: 5, unit: "seconds" },
                fallback: [],
            },
        );

        switch (OPERATION_MODE) {
            case WhitelistOperationMode.ALLOW_ALL:
                status = WhitelistStatusCode.SUCCESS;
                whitelistXuids.push(...xuids);
                break;

            case WhitelistOperationMode.ALLOW_NONE:
                status = xuids.some(xuid => vipXuids.includes(xuid))
                    ? WhitelistStatusCode.SUCCESS
                    : WhitelistStatusCode.GAME_DISABLED;
                break;

            case WhitelistOperationMode.NORMAL:
                whitelistXuids = await timeLimited(
                    this.prisma.reach_player_data.findMany({
                        where: { player_xuid: { in: xuids.map(xuid => xuid.toString()) }, is_whitelisted: true },
                        select: { player_xuid: true },
                    }).then(players => players.map(p => BigInt(p.player_xuid.toFixed(0)))),
                    {
                        limit: { value: 5, unit: "seconds" },
                        fallback: [],
                    },
                );

                status = xuids.some(xuid => whitelistXuids.includes(xuid) || vipXuids.includes(xuid))
                    ? WhitelistStatusCode.SUCCESS
                    : WhitelistStatusCode.NOT_AUTHORIZED;
                break;
        }

        return buildWhitelistResponse(whitelistXuids, vipXuids, status);
    }
}