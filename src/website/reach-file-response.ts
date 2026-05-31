import { Prisma } from "@prisma/client";

type ReachFileShareFileRow = {
    id: string | { toString(): string };
    share_id: string | { toString(): string };
    unique_id?: string | { toString(): string } | null;
    name?: string | null;
    description?: string | null;
    creator_name?: string | null;
    file_type?: number | null;
    creator_is_xuid_online?: boolean | null;
    creator_xuid?: string | { toString(): string } | null;
    size_in_bytes?: string | number | { toString(): string } | null;
    date?: Date | null;
    modified_at?: Date | null;
    created_at?: Date | null;
    length_seconds?: number | null;
    campaign_id?: number | null;
    map_id?: number | null;
    game_engine_type?: number | null;
    icon_index?: number | null;
    campaign_difficulty?: number | null;
    hopper_identifier?: number | null;
    campaign_insertion_point?: number | null;
    game_id?: Prisma.Decimal | null;
};

export function mapReachFileShareFileToApi(file: ReachFileShareFileRow) {
    const date = file.date ?? file.modified_at ?? file.created_at;

    return {
        id: file.id.toString(),
        uniqueId: file.unique_id ? String(file.unique_id) : '',
        slotNumber: 0,
        shareId: file.share_id.toString(),
        header: {
            buildNumber: 0,
            mapVersion: 0,
            uniqueId: file.unique_id ? String(file.unique_id) : '',
            filename: file.name ?? '',
            description: file.description ?? '',
            author: file.creator_name ?? '',
            filetype: file.file_type ?? 0,
            authorXuidIsOnline: !!file.creator_is_xuid_online,
            authorXuid: file.creator_xuid ? String(file.creator_xuid) : '',
            size: Number(file.size_in_bytes ?? 0),
            date: date?.toISOString() ?? '',
            lengthSeconds: file.length_seconds ?? 0,
            campaignId: file.campaign_id ?? 0,
            mapId: file.map_id ?? 0,
            gameEngineType: file.game_engine_type ?? 0,
            iconIndex: file.icon_index ?? null,
            campaignDifficulty: file.campaign_difficulty ?? 0,
            hopperId: file.hopper_identifier ?? 0,
            gameId: file.game_id ? Number(file.game_id) : 0,
            campaignInsertionPoint: file.campaign_insertion_point ?? 0,
            campaignSurvivalEnabled: false,
        },
    };
}
