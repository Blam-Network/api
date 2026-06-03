import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import {
    AggregateStatus,
    HealthCheckResult,
    HealthReport,
    ServiceLevel,
} from "./health.types";

const DB_CHECK_TIMEOUT_MS = 5_000;

@Injectable()
export class HealthService {
    constructor(private readonly prisma: PrismaService) {}

    async getHealthReport(): Promise<HealthReport> {
        const database = await this.checkDatabase();

        const checks: Record<string, HealthCheckResult> = {
            database,
        };

        const service = this.resolveServiceLevel(checks);
        const status = this.toAggregateStatus(service);

        return {
            service,
            status,
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version ?? "unknown",
            checks,
        };
    }

    /** API process can serve traffic (including DB-less routes) unless fully down. */
    isReady(report: HealthReport): boolean {
        return report.service === "full" || report.service === "partial";
    }

    private resolveServiceLevel(
        checks: Record<string, HealthCheckResult>,
    ): ServiceLevel {
        const anyFailed = Object.values(checks).some(
            (check) => check.status === "fail",
        );
        if (anyFailed) {
            return "partial";
        }

        return "full";
    }

    private toAggregateStatus(service: ServiceLevel): AggregateStatus {
        switch (service) {
            case "full":
                return "healthy";
            case "partial":
                return "degraded";
            case "none":
                return "unhealthy";
        }
    }

    private async checkDatabase(): Promise<HealthCheckResult> {
        const started = Date.now();
        try {
            await Promise.race([
                this.prisma.$queryRaw`SELECT 1`,
                new Promise<never>((_, reject) => {
                    setTimeout(
                        () => reject(new Error("database check timed out")),
                        DB_CHECK_TIMEOUT_MS,
                    );
                }),
            ]);
            return {
                status: "pass",
                latencyMs: Date.now() - started,
            };
        } catch (err) {
            return {
                status: "fail",
                latencyMs: Date.now() - started,
                message:
                    err instanceof Error ? err.message : "database unreachable",
            };
        }
    }
}
