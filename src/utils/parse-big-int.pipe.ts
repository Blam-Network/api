import { ArgumentMetadata, HttpStatus, Injectable, Optional, PipeTransform } from "@nestjs/common";
import { ErrorHttpStatusCode, HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";

/**
 * @publicApi
 */
export interface ParseBigIntPipeOptions {
  errorHttpStatusCode?: ErrorHttpStatusCode;
  exceptionFactory?: (errors: string) => any;
  hex?: boolean;
}

const BigIntRegex = /^[0-9]+$/;
const HexBigIntRegex = /^(0x)?[0-9a-fA-F]+$/;

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, Promise<bigint>> {
  protected exceptionFactory: (errors: string) => any;

  constructor(@Optional() protected readonly options?: ParseBigIntPipeOptions) {
    options = options || {};
    const {
      exceptionFactory,
      errorHttpStatusCode = HttpStatus.BAD_REQUEST,
    } = options;

    this.exceptionFactory =
      exceptionFactory ||
      ((error) => new HttpErrorByCode[errorHttpStatusCode](error));
  }

  async transform(value: string, metadata: ArgumentMetadata): Promise<bigint> {
    if (!this.isBigInt(value)) {
      throw this.exceptionFactory(
        `Validation failed (bigint${this.options?.hex ? ' hex' : ''} is expected)`,
      );
    }

    return this.parseBigInt(value);
  }

  protected isBigInt(value: unknown): boolean {
    if (typeof value !== 'string') {
      throw this.exceptionFactory('The value passed as bigint is not a string');
    }
    return this.options?.hex ? HexBigIntRegex.test(value) : BigIntRegex.test(value);
  }

  protected parseBigInt(value: string): bigint {
    try {
      return this.options?.hex ? BigInt(value) : BigInt(value);
    } catch {
      throw this.exceptionFactory('Failed to parse value to bigint');
    }
  }
}
