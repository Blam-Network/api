import {
    e_event_level,
    event,
    events_initialize,
    events_server_start,
    k_event_level_none,
} from '@blamnetwork/datamine';

/** Category for each server's logger prefix, e.g. 'Ares LIVE' -> 'web_private:ares_live:'. */
export const datamine_category = (prefix: string): string =>
    `web_private:${prefix.toLowerCase().replace(/[^a-z0-9_-]+/g, '_')}:`;

/**
 * Starts web_private's event logs (report files under EVENTS_ROOT, default ./logs).
 * The live event server Datamine Explorer connects to is off unless
 * DATAMINE_EVENTS_PORT is set; it listens on DATAMINE_EVENTS_HOST, default 127.0.0.1.
 */
export async function datamine_events_start(): Promise<void> {
    events_initialize({
        root: process.env.EVENTS_ROOT ?? './logs',
        name: 'web_private',
        categories: [
            {
                name: 'web_private:',
                // Nest's ConsoleLogger already prints every line.
                display_level: k_event_level_none,
                display_color: { red: 0.6, green: 0.8, blue: 1 },
                log_level: e_event_level.verbose,
                log_name: 'web_private.txt',
                remote_log_level: k_event_level_none,
            },
        ],
    });

    const port = process.env.DATAMINE_EVENTS_PORT;
    if (!port) {
        return;
    }
    const { url } = await events_server_start({
        host: process.env.DATAMINE_EVENTS_HOST ?? '127.0.0.1',
        port: Number(port),
    });
    event(e_event_level.message, `${datamine_category('events')} live events at %s`, url);
}

/** Logs `message` under `category` at `level`; a no-op before datamine_events_start. */
export function datamine_log(level: e_event_level, category: string, message: unknown): void {
    const text = message instanceof Error ? message.stack ?? message.message : String(message);
    event(level, `${category} %s`, text);
}
