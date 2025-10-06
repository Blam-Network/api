import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

@Injectable()
export class UuidWithoutDashesPipe implements PipeTransform<string, string> {
  transform(value: string, _metadata: ArgumentMetadata): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('UUID must be a string');
    }

    let str = value.trim();

    if (str.startsWith('"')) str = str.slice(1);
    if (str.endsWith('"')) str = str.slice(0, -1);

    // ensure it's exactly 32 hex chars
    if (!/^[0-9a-fA-F]{32}$/.test(str)) {
      throw new BadRequestException(`Invalid UUID hex string: ${value}`);
    }

    // insert dashes into 8-4-4-4-12 pattern
    str = str.toLowerCase();
    const dashed =
      str.slice(0, 8) +
      '-' +
      str.slice(8, 12) +
      '-' +
      str.slice(12, 16) +
      '-' +
      str.slice(16, 20) +
      '-' +
      str.slice(20);

    return dashed;
  }
}