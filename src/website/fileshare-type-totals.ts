import { PrismaService } from "src/db/prisma.service";
import { buildFileshareSearchFilter, fileshareUniqueIdPartition } from "./fileshare-search";

export type FileshareTypeTotals = {
    maps: number;
    gametypes: number;
    films: number;
    screenshots: number;
};

const EMPTY_TOTALS: FileshareTypeTotals = {
    maps: 0,
    gametypes: 0,
    films: 0,
    screenshots: 0,
};

export async function queryHalo3SchemaFileshareTypeTotals(
    prisma: PrismaService,
    options: { isOdst: boolean; search?: string },
): Promise<FileshareTypeTotals> {
    const searchFilter = buildFileshareSearchFilter(options.search, "name", "description", "author");
    const uniqueIdPartition = fileshareUniqueIdPartition("unique_id", "id");
    const odstFilter = options.isOdst ? "AND is_odst = true" : "AND is_odst = false";

    const query = `
        WITH ranked_files AS (
            SELECT
                file_type,
                name,
                description,
                author,
                ROW_NUMBER() OVER (
                    PARTITION BY ${uniqueIdPartition}
                    ORDER BY date DESC NULLS LAST
                ) AS rn
            FROM halo3.file_share_slot
            WHERE is_uploaded = true ${odstFilter}
        )
        SELECT
            COUNT(*) FILTER (WHERE file_type = 10)::int AS maps,
            COUNT(*) FILTER (WHERE file_type IN (1, 2, 3, 4, 5, 6, 7, 8, 9))::int AS gametypes,
            COUNT(*) FILTER (WHERE file_type IN (11, 12))::int AS films,
            COUNT(*) FILTER (WHERE file_type = 13)::int AS screenshots
        FROM ranked_files
        WHERE rn = 1 ${searchFilter}
    `;

    const rows = await prisma.$queryRawUnsafe<Array<FileshareTypeTotals>>(query);
    return rows[0] ?? EMPTY_TOTALS;
}

export async function queryReachFileshareTypeTotals(
    prisma: PrismaService,
    options: { search?: string; shareIdFilter?: string },
): Promise<FileshareTypeTotals> {
    const searchFilter = buildFileshareSearchFilter(options.search, "name", "description", "creator_name");
    const uniqueIdPartition = fileshareUniqueIdPartition("unique_id", "id");
    const shareIdFilter = options.shareIdFilter ?? "";

    const query = `
        WITH ranked_files AS (
            SELECT
                file_type,
                name,
                description,
                creator_name,
                ROW_NUMBER() OVER (
                    PARTITION BY ${uniqueIdPartition}
                    ORDER BY COALESCE(modified_at, created_at) DESC NULLS LAST
                ) AS rn
            FROM reach.file_share_file
            WHERE is_uploaded = true ${shareIdFilter}
        )
        SELECT
            COUNT(*) FILTER (WHERE file_type = 5)::int AS maps,
            COUNT(*) FILTER (WHERE file_type = 6)::int AS gametypes,
            COUNT(*) FILTER (WHERE file_type IN (3, 4))::int AS films,
            COUNT(*) FILTER (WHERE file_type = 2)::int AS screenshots
        FROM ranked_files
        WHERE rn = 1 ${searchFilter}
    `;

    const rows = await prisma.$queryRawUnsafe<Array<FileshareTypeTotals>>(query);
    return rows[0] ?? EMPTY_TOTALS;
}
