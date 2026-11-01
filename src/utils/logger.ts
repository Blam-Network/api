import { ConsoleLogger } from '@nestjs/common';
import { e_event_level } from '@blamnetwork/datamine';
import { ILoggerSymbol } from 'src/ILogger';
import { datamine_category, datamine_log } from './datamine_events';

/** Nest's console logger that also records each line as a datamine event. */
class DatamineConsoleLogger extends ConsoleLogger {
    private readonly category: string;

    constructor(prefix: string) {
        super(prefix);
        this.category = datamine_category(prefix);
    }

    debug(message: any, ...rest: any[]): void {
        super.debug(message, ...rest);
        datamine_log(e_event_level.verbose, this.category, message);
    }

    log(message: any, ...rest: any[]): void {
        super.log(message, ...rest);
        datamine_log(e_event_level.message, this.category, message);
    }

    warn(message: any, ...rest: any[]): void {
        super.warn(message, ...rest);
        datamine_log(e_event_level.warning, this.category, message);
    }

    error(message: any, ...rest: any[]): void {
        super.error(message, ...rest);
        datamine_log(e_event_level.error, this.category, message);
    }
}

export const loggerWithPrefix = (prefix: string) => ({
    provide: ILoggerSymbol,
    useFactory: () => new DatamineConsoleLogger(prefix),
});
