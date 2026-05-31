import { PrismaService } from "src/db/prisma.service";

export const HALO3_FILESHARE_SCREENSHOT_FILETYPE = 13;
export const HALO3_FILESHARE_FILM_FILETYPES = [11, 12] as const;

export function isHalo3FileshareScreenshotOrFilm(fileType: number): boolean {
    return (
        fileType === HALO3_FILESHARE_SCREENSHOT_FILETYPE ||
        (HALO3_FILESHARE_FILM_FILETYPES as readonly number[]).includes(fileType)
    );
}

export type FileshareSourceGame = {
    reportType: "multiplayer" | "campaign";
    reportId: string;
    mapId: number;
    startTime: Date;
    finishTime: Date;
    teamGame: boolean;
    mapVariantName: string | null;
    gameVariantName: string | null;
    hopperName: string | null;
    campaignDifficulty?: number;
    campaignId?: number;
};

export async function lookupHalo3FileshareSourceGame(
    prisma: PrismaService,
    fileId: string,
): Promise<FileshareSourceGame | null> {
    const file = await prisma.halo3_file_share_file.findUnique({
        where: { id: fileId },
        select: {
            game_id: true,
            file_type: true,
            is_uploaded: true,
            is_odst: true,
        },
    });

    if (
        !file?.is_uploaded ||
        file.is_odst ||
        !isHalo3FileshareScreenshotOrFilm(file.file_type) ||
        file.game_id == null ||
        file.game_id.toString() === "0"
    ) {
        return null;
    }

    const multiplayer = await prisma.halo3_carnage_report.findFirst({
        where: { game_id: file.game_id },
        select: {
            id: true,
            map_id: true,
            start_time: true,
            finish_time: true,
            team_game: true,
            map_variant_name: true,
            carnage_report_game_variant: {
                select: { name: true },
            },
            carnage_report_matchmaking_options: {
                select: { hopper_name: true },
            },
        },
        orderBy: { start_time: "desc" },
    });

    if (multiplayer) {
        return {
            reportType: "multiplayer",
            reportId: multiplayer.id,
            mapId: multiplayer.map_id,
            startTime: multiplayer.start_time,
            finishTime: multiplayer.finish_time,
            teamGame: multiplayer.team_game,
            mapVariantName: multiplayer.map_variant_name,
            gameVariantName: multiplayer.carnage_report_game_variant?.name ?? null,
            hopperName: multiplayer.carnage_report_matchmaking_options?.hopper_name ?? null,
        };
    }

    const campaign = await prisma.halo3_campaign_carnage_report.findFirst({
        where: { game_id: file.game_id },
        select: {
            id: true,
            map_id: true,
            start_time: true,
            finish_time: true,
            campaign_difficulty: true,
            campaign_id: true,
        },
        orderBy: { start_time: "desc" },
    });

    if (campaign) {
        return {
            reportType: "campaign",
            reportId: campaign.id,
            mapId: campaign.map_id,
            startTime: campaign.start_time,
            finishTime: campaign.finish_time,
            teamGame: false,
            mapVariantName: null,
            gameVariantName: null,
            hopperName: null,
            campaignDifficulty: campaign.campaign_difficulty,
            campaignId: campaign.campaign_id,
        };
    }

    return null;
}
