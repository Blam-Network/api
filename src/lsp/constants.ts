import { join } from "path";

const getPortRange = (start: number, end: number) => Array.from({ length: (end - start) + 1 }, (_, index) => start + index);

// These port ranges are configurable in some Halo versions via the network_cofiguration file.
// We support the defaults + a few extra.
export const LSP_PORT_RANGE = Array.from(new Set([
    // Halo 3
    ...getPortRange(1000, 1002),
    // Halo Reach
    ...getPortRange(1000, 1035),
]));

// Used for Swagger docs.
export const EXAMPLE_XUID = '000901FC3FB8FE71'

export const TITLE_STORAGE_FOLDER = 'title_storage';
export const RESOURCES_FOLDER = 'resources';
export const UPLOADS_FOLDER = 'uploads'
export const FILESHARE_FOLDER = join(UPLOADS_FOLDER, 'fileshare');
export const SCREENSHOTS_FOLDER = join(UPLOADS_FOLDER, 'screenshots');