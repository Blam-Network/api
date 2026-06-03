import { Controller, Get, HttpCode, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { HealthService } from "./health.service";
import type { HealthReport } from "./health.types";

/**
 * Health endpoints for orchestrators and the public website.
 *
 * - **Docker / Kubernetes liveness**: `GET /health/live` — process is up (always 200).
 * - **Docker / Kubernetes readiness**: `GET /health/ready` — process can accept traffic (200 for full/partial).
 * - **Detailed status**: `GET /health` — `service` is `full` | `partial` | `none` (none only if unreachable).
 *
 * A dead database returns `partial` (degraded), not `none`, because some routes do not need Postgres.
 * Docker `HEALTHCHECK` should use `/health/live` for process liveness or `/health/ready` for accept traffic.
 */
@ApiTags("Health")
@Controller()
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get("/health")
    @ApiOperation({
        summary: "Service health",
        description:
            "Returns full or partial while the API is up. HTTP 503 only when service is `none`.",
    })
    @ApiResponse({ status: 200, description: "Full or partial service" })
    @ApiResponse({ status: 503, description: "No service (critical dependency down)" })
    async getHealth(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
        const report = await this.healthService.getHealthReport();
        res.status(report.service === "none" ? 503 : 200);
        return report;
    }

    @Get("/health/live")
    @HttpCode(200)
    @ApiOperation({
        summary: "Liveness probe",
        description: "Always succeeds if the HTTP server is accepting requests.",
    })
    getLiveness(): { status: "ok" } {
        return { status: "ok" };
    }

    @Get("/health/ready")
    @ApiOperation({
        summary: "Readiness probe",
        description:
            "Succeeds when the API can accept traffic (full or partial service).",
    })
    @ApiResponse({ status: 200, description: "Ready to serve traffic" })
    @ApiResponse({ status: 503, description: "Not ready" })
    async getReadiness(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
        const report = await this.healthService.getHealthReport();
        res.status(this.healthService.isReady(report) ? 200 : 503);
        return report;
    }
}
