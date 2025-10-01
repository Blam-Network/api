import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodTypeAny, ZodError, z } from 'zod';

@Injectable()
export class ParseBungieHeaderPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown) {
    if (typeof value === 'string') {
      let str = value;

      if (str.startsWith('"') && str.endsWith('"')) {
        str = str.substring(1, str.length - 1);
      }

      value = str;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid Bungie header',
        errors: (result.error as ZodError).errors,
      });
    }

    return result.data;
  }
}


export const parseBungieHeader = (schema: z.ZodTypeAny) => {
  return z.preprocess((val: unknown) => {
    if (typeof val !== 'string') return val;

    let str = val; // now str is string type

    if (str.startsWith('"')) {
      str = str.substring(1);
    }
    if (str.endsWith('"')) {
      str = str.substring(0, str.length - 1);
    }

    return str;
  }, schema);
};