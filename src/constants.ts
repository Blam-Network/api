import { join } from "path";

// Used for Swagger docs.
export const EXAMPLE_XUID = '000901FC3FB8FE71'

export const TITLE_STORAGE_FOLDER = 'title_storage';
export const RESOURCES_FOLDER = 'resources';
export const UPLOADS_FOLDER = 'uploads'
export const SCREENSHOTS_FOLDER = join(UPLOADS_FOLDER, 'screenshots');
export const SPARTAN_RENDER_FOLDER = join(UPLOADS_FOLDER, 'spartan_renders');
export const FILESHARE_FOLDER = join(UPLOADS_FOLDER, 'fileshare')

const MEGABYTE = 1024 * 1024;
export const HALO3_UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA = 25 * MEGABYTE;
export const HALO3_UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA = 6;
export const HALO3_MAX_ACTIVE_TRANSFERS = 8;

export const HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_SIZE_QUOTA = 50 * MEGABYTE;
export const HALOREACH_UNSUBSCRIBED_DEFAULT_FILE_COUNT_QUOTA = 10;
export const HALOREACH_BUNGIE_FAVOURITES_SLOT_QUOTA = 50;
export const HALOREACH_MAX_ACTIVE_TRANSFERS = 16;

export const BLAMNET_SYSTEM_XUID = 0xffffffffffffff10n;
export const HALOREACH_BUNGIE_FAVOURITES_SYSTEM_XUID = 0xffffffffffffff03n;

export const isBlamNetworkXuid = (xuid: { toString(): string }) =>
    BigInt(xuid.toString()) === BLAMNET_SYSTEM_XUID;

export const isReachAdminFileshareXuid = (xuid: { toString(): string }) => {
    const value = BigInt(xuid.toString());
    return value === BLAMNET_SYSTEM_XUID || value === HALOREACH_BUNGIE_FAVOURITES_SYSTEM_XUID;
};