function escapeSqlLikePattern(value: string): string {
    return value.replace(/'/g, "''");
}

/** Dedupe key: real unique_id values collapse together; unset ids stay distinct per row. */
export function fileshareUniqueIdPartition(uniqueIdColumn: string, idColumn: string): string {
    return `CASE WHEN ${uniqueIdColumn} IS NULL OR ${uniqueIdColumn} = 0 THEN ${idColumn}::text ELSE ${uniqueIdColumn}::text END`;
}

/** Case-insensitive ILIKE filter across name, description, and author columns. */
export function buildFileshareSearchFilter(
    search: string | undefined,
    nameColumn: string,
    descriptionColumn: string,
    authorColumn: string,
): string {
    const trimmed = search?.trim();
    if (!trimmed) {
        return '';
    }

    const pattern = escapeSqlLikePattern(trimmed);
    return `AND (
        COALESCE(${nameColumn}, '') ILIKE '%${pattern}%' OR
        COALESCE(${descriptionColumn}, '') ILIKE '%${pattern}%' OR
        COALESCE(${authorColumn}, '') ILIKE '%${pattern}%'
    )`;
}
