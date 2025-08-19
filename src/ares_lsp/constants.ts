const getPortRange = (start: number, end: number) => Array.from({ length: (end - start) + 1 }, (_, index) => start + index);

// These port ranges are configurable in some Halo versions via the network_cofiguration file.
// We support the defaults + a few extra.
export const LSP_PORT_RANGE = Array.from(new Set([
    8001,
    // Ares
    ...getPortRange(2000, 2002),
]));

