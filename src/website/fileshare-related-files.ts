import { Prisma } from "@prisma/client";
import { PrismaService } from "src/db/prisma.service";
import {
    HALO3_FILE_SHARE_FILE_SELECT,
    mapHalo3FileShareFileToApi,
} from "./fileshare-file-response";

const DEFAULT_LIMIT = 20;

type Halo3FileShareFileRow = {
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
    campaign_survival_enabled: boolean | null;
};

function mergeRelatedFiles(
    primary: Halo3FileShareFileRow[],
    secondary: Halo3FileShareFileRow[],
    excludeIds: Set<string>,
    limit: number,
): Halo3FileShareFileRow[] {
    const seen = new Set(excludeIds);
    const merged: Halo3FileShareFileRow[] = [];

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

function mapRowsToApi(files: Halo3FileShareFileRow[]) {
    return files.map((f) =>
        mapHalo3FileShareFileToApi({
            ...f,
            campaign_survival_enabled: f.campaign_survival_enabled,
        }),
    );
}

export async function lookupHalo3RelatedFileshareFilesByGameId(
    prisma: PrismaService,
    gameId: Prisma.Decimal,
    isOdst: boolean,
    excludeFileIds: string[] = [],
    limit = DEFAULT_LIMIT,
    variantUniqueIds?: Prisma.Decimal[],
) {
    const excludeIds = new Set(excludeFileIds);

    const sameMatchFiles = await prisma.halo3_file_share_file.findMany({
        where: {
            game_id: gameId,
            is_uploaded: true,
            is_odst: isOdst,
            id: { notIn: [...excludeIds] },
        },
        orderBy: { date: "desc" },
        take: limit,
        select: HALO3_FILE_SHARE_FILE_SELECT,
    });

    for (const file of sameMatchFiles) {
        excludeIds.add(file.id);
    }

    let resolvedVariantIds = variantUniqueIds?.filter((id) => id.toString() !== "0");

    if (!resolvedVariantIds) {
        const carnageReport = await prisma.halo3_carnage_report.findFirst({
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

    let variantFiles: Halo3FileShareFileRow[] = [];

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
                prisma.halo3_file_share_file.findFirst({
                    where: {
                        unique_id: uniqueId,
                        is_uploaded: true,
                        is_odst: isOdst,
                        id: { notIn: [...excludeIds] },
                    },
                    orderBy: { date: "desc" },
                    select: HALO3_FILE_SHARE_FILE_SELECT,
                }),
            ),
        );
        variantFiles = lookups.flatMap((f) => (f ? [f as Halo3FileShareFileRow] : []));
    }

    return mergeRelatedFiles(
        sameMatchFiles,
        variantFiles,
        new Set(excludeFileIds),
        limit,
    );
}

export async function lookupHalo3FileshareRelatedFiles(
    prisma: PrismaService,
    fileId: string,
    isOdst: boolean,
) {
    const sourceFile = await prisma.halo3_file_share_file.findUnique({
        where: { id: fileId },
        select: { game_id: true, is_uploaded: true, is_odst: true },
    });

    if (
        !sourceFile?.is_uploaded ||
        sourceFile.is_odst !== isOdst ||
        sourceFile.game_id == null ||
        sourceFile.game_id.toString() === "0"
    ) {
        return [];
    }

    const files = await lookupHalo3RelatedFileshareFilesByGameId(
        prisma,
        sourceFile.game_id,
        isOdst,
        [fileId],
    );

    return mapRowsToApi(files);
}

export function mapHalo3RelatedFileshareFilesToApi(files: Halo3FileShareFileRow[]) {
    return mapRowsToApi(files);
}
