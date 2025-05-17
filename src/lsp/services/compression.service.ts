import { Injectable } from '@nestjs/common';
import { inflate } from 'pako';

@Injectable()
export class CompressionService {
    public inflateIfCompressed(file: Express.Multer.File) {
        try {
            return this.inflate(file);
        } catch (e) {
            // Assume it's not compressed.
            return file.buffer;
        }
    }

    public inflate(file: Express.Multer.File) {
        return inflate(file.buffer.subarray(12))
    }
}