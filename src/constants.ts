import { join } from "path";

// Used for Swagger docs.
export const EXAMPLE_XUID = '000901FC3FB8FE71'

export const TITLE_STORAGE_FOLDER = 'title_storage';
export const RESOURCES_FOLDER = 'resources';
export const UPLOADS_FOLDER = 'uploads'
export const SCREENSHOTS_FOLDER = join(UPLOADS_FOLDER, 'screenshots');
export const FILESHARE_FOLDER = join(UPLOADS_FOLDER, 'fileshare')

const MEGABYTE = 1024 * 1024;
export const HALO3_UNSUBSCRIBED_DEFAULT_SLOT_SIZE_QUOTA = 25 * MEGABYTE;
export const HALO3_UNSUBSCRIBED_DEFAULT_SLOT_COUNT_QUOTA = 6;