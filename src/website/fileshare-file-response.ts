const HALO3_FILE_SHARE_FILE_SELECT = {
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
    campaign_survival_enabled: true,
} as const;

export { HALO3_FILE_SHARE_FILE_SELECT };

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

export function mapHalo3FileShareFileToApi(f: Halo3FileShareFileRow) {
    return {
        id: f.id,
        uniqueId: String(f.unique_id ?? ''),
        slotNumber: f.slot,
        shareId: String(f.share_id),
        header: {
            buildNumber: 0,
            mapVersion: 0,
            uniqueId: String(f.unique_id ?? ''),
            filename: f.name ?? '',
            description: f.description ?? '',
            author: f.author ?? '',
            filetype: f.file_type,
            authorXuidIsOnline: !!f.author_is_xuid_online,
            authorXuid: f.author_id ? String(f.author_id) : '',
            size: Number(f.size_in_bytes ?? 0),
            date: f.date?.toISOString() ?? '',
            lengthSeconds: f.length_seconds ?? 0,
            campaignId: f.campaign_id ?? 0,
            mapId: f.map_id ?? 0,
            gameEngineType: f.game_engine_type ?? 0,
            campaignDifficulty: f.campaign_difficulty ?? 0,
            hopperId: f.hopper_id ?? 0,
            gameId: f.game_id ? Number(f.game_id) : 0,
            campaignInsertionPoint: f.campaign_insertion_point ?? 0,
            campaignSurvivalEnabled: !!f.campaign_survival_enabled,
        },
    };
}
