import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import ILogger, { ILoggerSymbol } from 'src/ILogger';

/**
 * Background service that periodically cleans up sessions older than 7 days
 */
@Injectable()
export class SessionCleanupService implements OnModuleInit, OnModuleDestroy {
    private readonly checkInterval = 60 * 60 * 1000; // Check every hour (in milliseconds)
    private readonly sessionLifetime = 7 * 24 * 60 * 60 * 1000; // Delete sessions older than 7 days (in milliseconds)
    private readonly abandonedStatWriteLifetime = 24 * 60 * 60 * 1000; // Delete staged stat writes older than 24 hours
    private intervalHandle: NodeJS.Timeout | null = null;

    constructor(
        private readonly prisma: PrismaService,
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {}

    onModuleInit() {
        this.logger.log(
            `Session cleanup service started. Will check for old sessions every ${this.checkInterval / (60 * 60 * 1000)} hours`,
        );
        // Run cleanup immediately on startup, then schedule periodic runs
        this.cleanupOldSessions();
        this.cleanupAbandonedStatWrites();
        this.intervalHandle = setInterval(() => {
            this.cleanupOldSessions();
            this.cleanupAbandonedStatWrites();
        }, this.checkInterval);
    }

    onModuleDestroy() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
        this.logger.log('Session cleanup service stopped');
    }

    private async cleanupOldSessions(): Promise<void> {
        try {
            const cutoffDate = new Date(Date.now() - this.sessionLifetime);

            this.logger.log(
                `Starting session cleanup. Looking for sessions older than ${cutoffDate.toISOString()} (created before ${this.sessionLifetime / (24 * 60 * 60 * 1000)} days ago)`,
            );

            // Find all sessions older than the cutoff date
            const oldSessions = await this.prisma.ares_session.findMany({
                where: {
                    created_at: {
                        lt: cutoffDate,
                    },
                },
            });

            if (oldSessions.length === 0) {
                this.logger.log('No old sessions found to clean up');
                return;
            }

            this.logger.log(`Found ${oldSessions.length} old session(s) to delete`);

            let deletedSessions = 0;

            for (const session of oldSessions) {
                // Delete the session
                await this.prisma.ares_session.delete({
                    where: { identifier: session.identifier },
                });
                deletedSessions++;

                const ageInDays = (Date.now() - session.created_at.getTime()) / (24 * 60 * 60 * 1000);
                this.logger.log(
                    `Deleting session ${session.identifier} (created ${session.created_at.toISOString()}, age: ${ageInDays.toFixed(2)} days)`,
                );
            }

            this.logger.log(
                `Session cleanup completed. Deleted ${deletedSessions} session(s)`,
            );
        } catch (error) {
            this.logger.error(`Error occurred while cleaning up old sessions: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'N/A'}`);
        }
    }

    /**
     * Deletes staged stat writes that were never finalized. A finalized session removes its own
     * staged rows on session end, so any rows left older than abandonedStatWriteLifetime belong to
     * a session whose end notification never arrived and would otherwise leak forever.
     */
    private async cleanupAbandonedStatWrites(): Promise<void> {
        try {
            const cutoffDate = new Date(Date.now() - this.abandonedStatWriteLifetime);

            const result = await this.prisma.ares_sessions_stat_writes.deleteMany({
                where: {
                    created_at: {
                        lt: cutoffDate,
                    },
                },
            });

            if (result.count > 0) {
                this.logger.log(
                    `Stat write cleanup completed. Deleted ${result.count} abandoned staged stat write(s) older than ${cutoffDate.toISOString()}`,
                );
            }
        } catch (error) {
            this.logger.error(`Error occurred while cleaning up abandoned stat writes: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'N/A'}`);
        }
    }
}
