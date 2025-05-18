const getPortRange = (start: number, end: number) => Array.from({ length: (end - start) + 1 }, (_, index) => start + index);

// These port ranges are configurable in some Halo versions via the network_cofiguration file.
// We support the defaults + a few extra.
export const LSP_PORT_RANGE = Array.from(new Set([
    // Legacy Sunrise
    8000,
    8080,
    // Halo 3
    ...getPortRange(1000, 1002),
    // Halo Reach
    ...getPortRange(1000, 1035),
    1
]));

// Used for Swagger docs.
export const EXAMPLE_XUID = '000901FC3FB8FE71'