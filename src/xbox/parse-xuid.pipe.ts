import { ArgumentMetadata, HttpStatus, Injectable, Optional, PipeTransform } from "@nestjs/common";
import { ErrorHttpStatusCode, HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";
import { parseXuid } from "src/xbox/xuid";

const BANNED_XUIDS = [
  2535442705942709n
]

/**
 * @publicApi
 */
export interface ParseXUIDPipeOptions {
  /**
   * The HTTP status code to be used in the response when the validation fails.
   */
  errorHttpStatusCode?: ErrorHttpStatusCode;
  /**
   * A factory function that returns an exception object to be thrown
   * if validation fails.
   * @param error Error message
   * @returns The exception object
   */
  exceptionFactory?: (errors: string) => any;
}

const XUIDRegex = /[0-9A-Fa-z]{16}/

/**
 * Defines the ParseXUID Pipe
 *
 * @publicApi
 */
@Injectable()
export class ParseXUIDPipe implements PipeTransform<string> {
  protected exceptionFactory: (errors: string) => any;

  constructor(@Optional() protected readonly options?: ParseXUIDPipeOptions) {
    options = options || {};
    const {
      exceptionFactory,
      errorHttpStatusCode = HttpStatus.BAD_REQUEST,
    } = options;

    this.exceptionFactory =
      exceptionFactory ||
      (error => new HttpErrorByCode[errorHttpStatusCode](error));
  }

  async transform(value: string, metadata: ArgumentMetadata): Promise<BigInt> {
    if (!this.isXUID(value)) {
      throw this.exceptionFactory(
        `Validation failed (XUID is expected)`,
      );
    }

    const parsedXuid = parseXuid(value);

    if (this.isBannedXuid(parsedXuid)) {
      throw this.exceptionFactory(
        `Validation failed (XUID is expected)`,
      );
    }

    return parsedXuid;
  }

  protected isXUID(str: unknown, version = 'all') {
    if (typeof str !== 'string') {
      throw this.exceptionFactory('The value passed as XUID is not a string');
    }
    return XUIDRegex?.test(str);
  }

  protected isBannedXuid(xuid: BigInt) {
    return BANNED_XUIDS.includes(xuid.valueOf());
  }
}