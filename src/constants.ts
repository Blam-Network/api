import { join } from "path";

// Used for Swagger docs.
export const EXAMPLE_XUID = '000901FC3FB8FE71'

export const TITLE_STORAGE_FOLDER = 'title_storage';
export const RESOURCES_FOLDER = 'resources';
export const UPLOADS_FOLDER = 'uploads'
export const SCREENSHOTS_FOLDER = join(UPLOADS_FOLDER, 'screenshots');
export const FILESHARE_FOLDER = join(UPLOADS_FOLDER, 'fileshare')