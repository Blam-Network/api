import { Prisma } from "@prisma/client";
import { PrismaService } from "src/db/prisma.service";

const DEFAULT_LIMIT = 20;

const ARES_FILE_SHARE_FILE_SELECT = {
    id: true,
    share_id: true,
    slot: true,
    unique_id: true,
    name: true,
    description: true,
    author: true,
    file_type: true,
    author_is_xuid_online: true,
    author_id: true,
    size_in_bytes: true,
    date: true,
    length_seconds: true,
    campaign_id: true,
    map_id: true,
    game_engine_type: true,
    campaign_difficulty: true,
    hopper_id: true,
    game_id: true,
    campaign_insertion_point: true,
} as const;

type AresFileShareFileRow = {
    id: string;
    share_id: { toString(): string } | bigint | number | string;
    slot: number;
    unique_id: { toString(): string } | bigint | number | string | null;
    name: string | null;
    description: string | null;
    author: string | null;
    file_type: number;
    author_is_xuid_online: boolean | null;
    author_id: { toString(): string } | bigint | number | string | null;
    size_in_bytes: { toString(): string } | bigint | number | string | null;
    date: Date | null;
    length_seconds: number | null;
    campaign_id: number | null;
    map_id: number | null;
    game_engine_type: number | null;
    campaign_difficulty: number | null;
    hopper_id: number | null;
    game_id: { toString(): string } | bigint | number | string | null;
    campaign_insertion_point: number | null;
};

function mergeRelatedFiles(
    primary: AresFileShareFileRow[],
    secondary: AresFileShareFileRow[],
    excludeIds: Set<string>,
    limit: number,
): AresFileShareFileRow[] {
    const seen = new Set(excludeIds);
    const merged: AresFileShareFileRow[] = [];

    for (const file of [...primary, ...secondary]) {
        if (seen.has(file.id)) {
            continue;
        }
        seen.add(file.id);
        merged.push(file);
        if (merged.length >= limit) {
            break;
        }
    }

    return merged;
}

export function mapAresFileShareFileToApi(f: AresFileShareFileRow) {
    return {
        id: f.id,
        uniqueId: String(f.unique_id ?? ""),
        slotNumber: f.slot,
        shareId: String(f.share_id),
        header: {
            buildNumber: 0,
            mapVersion: 0,
            uniqueId: String(f.unique_id ?? ""),
            filename: f.name ?? "",
            description: f.description ?? "",
            author: f.author ?? "",
            filetype: f.file_type,
            authorXuidIsOnline: !!f.author_is_xuid_online,
            authorXuid: f.author_id ? String(f.author_id) : "",
            size: Number(f.size_in_bytes ?? 0),
            date: f.date?.toISOString() ?? "",
            lengthSeconds: f.length_seconds ?? 0,
            campaignId: f.campaign_id ?? 0,
            mapId: f.map_id ?? 0,
            gameEngineType: f.game_engine_type ?? 0,
            campaignDifficulty: f.campaign_difficulty ?? 0,
            hopperId: f.hopper_id ?? 0,
            gameId: f.game_id ? Number(f.game_id) : 0,
            campaignInsertionPoint: f.campaign_insertion_point ?? 0,
            campaignSurvivalEnabled: false,
        },
    };
}

function mapRowsToApi(files: AresFileShareFileRow[]) {
    return files.map(mapAresFileShareFileToApi);
}

export async function lookupAresRelatedFileshareFilesByGameId(
    prisma: PrismaService,
    gameId: Prisma.Decimal,
    excludeFileIds: string[] = [],
    limit = DEFAULT_LIMIT,
    variantUniqueIds?: Prisma.Decimal[],
) {
    const excludeIds = new Set(excludeFileIds);

    const sameMatchFiles = await prisma.ares_file_share_file.findMany({
        where: {
            game_id: gameId,
            is_uploaded: true,
            id: { notIn: [...excludeIds] },
        },
        orderBy: { date: "desc" },
        take: limit,
        select: ARES_FILE_SHARE_FILE_SELECT,
    });

    for (const file of sameMatchFiles) {
        excludeIds.add(file.id);
    }

    let resolvedVariantIds = variantUniqueIds?.filter((id) => id.toString() !== "0");

    if (!resolvedVariantIds) {
        const carnageReport = await prisma.ares_carnage_report.findFirst({
            where: { game_id: gameId },
            select: {
                map_variant_unique_id: true,
                game_variant_unique_id: true,
            },
            orderBy: { start_time: "desc" },
        });

        if (carnageReport) {
            resolvedVariantIds = [
                carnageReport.map_variant_unique_id,
                carnageReport.game_variant_unique_id,
            ].filter((id) => id.toString() !== "0");
        }
    }

    let variantFiles: AresFileShareFileRow[] = [];

    if (resolvedVariantIds && resolvedVariantIds.length > 0) {
        const seenUniqueIds = new Set<string>();
        const uniqueIdsToLookup = resolvedVariantIds.filter((id) => {
            const key = id.toString();
            if (seenUniqueIds.has(key)) {
                return false;
            }
            seenUniqueIds.add(key);
            return true;
        });

        const lookups = await Promise.all(
            uniqueIdsToLookup.map((uniqueId) =>
                prisma.ares_file_share_file.findFirst({
                    where: {
                        unique_id: uniqueId,
                        is_uploaded: true,
                        id: { notIn: [...excludeIds] },
                    },
                    orderBy: { date: "desc" },
                    select: ARES_FILE_SHARE_FILE_SELECT,
                }),
            ),
        );
        variantFiles = lookups.flatMap((f) => (f ? [f as AresFileShareFileRow] : []));
    }

    return mergeRelatedFiles(
        sameMatchFiles,
        variantFiles,
        new Set(excludeFileIds),
        limit,
    );
}

export function mapAresRelatedFileshareFilesToApi(files: AresFileShareFileRow[]) {
    return mapRowsToApi(files);
}
