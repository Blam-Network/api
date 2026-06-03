export type HealthCheckStatus = "pass" | "fail";

export type ServiceLevel = "full" | "partial" | "none";

/** Aggregate status aligned with common health-check vocabulary. */
export type AggregateStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
    status: HealthCheckStatus;
    latencyMs?: number;
    message?: string;
}

export interface HealthReport {
    /**
     * `full` — all checks pass.
     * `partial` — degraded (e.g. database or assets unavailable; some routes still work).
     * `none` — reserved for unreachable API (not returned by a running server).
     */
    service: ServiceLevel;
    status: AggregateStatus;
    timestamp: string;
    version: string;
    checks: Record<string, HealthCheckResult>;
}
