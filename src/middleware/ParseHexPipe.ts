import { ArgumentMetadata, HttpStatus, Injectable, Optional, ParseIntPipeOptions, PipeTransform } from "@nestjs/common";
import { HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";

export const isUndefined = (obj: any): obj is undefined =>
  typeof obj === 'undefined';

const isNil = (val: any): val is null | undefined =>
  isUndefined(val) || val === null;

@Injectable()
export class ParseHexPipe implements PipeTransform<string> {
  protected exceptionFactory: (error: string) => any;

  constructor(@Optional() protected readonly options?: ParseIntPipeOptions) {
    options = options || {};
    const { exceptionFactory, errorHttpStatusCode = HttpStatus.BAD_REQUEST } =
      options;

    this.exceptionFactory =
      exceptionFactory ||
      (error => new HttpErrorByCode[errorHttpStatusCode](error));
  }

  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    if (isNil(value) && this.options?.optional) {
      return value;
    }
    if (!this.isNumeric(value)) {
      throw this.exceptionFactory(
        'Validation failed (numeric string is expected)',
      );
    }
    return parseInt(value, 16);
  }

  protected isNumeric(value: string): boolean {
    return (
      ['string', 'number'].includes(typeof value) &&
      /^-?[\da-fA-F]+$/.test(value) &&
      isFinite(parseInt(value, 16))
    );
  }
}