import { Injectable } from "@nestjs/common";
import { existsSync, readFileSync } from "fs";
import path, { join } from "path";
import * as sharp from "sharp";
import { RESOURCES_FOLDER } from "src/constants";

export interface EmblemDto {
    armour_primary_color?: number;
    size: number;
    primary: number;
    secondary: boolean;
    background: number;
    primary_color: number;
    secondary_color: number;
    background_color: number;
}

interface Color {
    r: number;
    g: number;
    b: number;
    alpha: number;
}

const COLORS: Color[] = [
    { r: 110, g: 110, b: 110, alpha: 255 },
    { r: 178, g: 178, b: 178, alpha: 255 },
    { r: 200, g: 200, b: 200, alpha: 255 },
    { r: 167, g: 59, b: 59, alpha: 255 },
    { r: 224, g: 115, b: 115, alpha: 255 },
    { r: 242, g: 141, b: 141, alpha: 255 },
    { r: 223, g: 150, b: 0, alpha: 255 },
    { r: 251, g: 184, b: 98, alpha: 255 },
    { r: 255, g: 210, b: 167, alpha: 255 },
    { r: 212, g: 182, b: 50, alpha: 255 },
    { r: 240, g: 205, b: 53, alpha: 255 },
    { r: 255, g: 223, b: 132, alpha: 255 },
    { r: 99, g: 128, b: 28, alpha: 255 },
    { r: 155, g: 176, b: 108, alpha: 255 },
    { r: 218, g: 241, b: 169, alpha: 255 },
    { r: 56, g: 132, b: 137, alpha: 255 },
    { r: 85, g: 196, b: 201, alpha: 255 },
    { r: 156, g: 239, b: 239, alpha: 255 },
    { r: 59, g: 101, b: 158, alpha: 255 },
    { r: 96, g: 148, b: 223, alpha: 255 },
    { r: 163, g: 191, b: 246, alpha: 255 },
    { r: 96, g: 71, b: 155, alpha: 255 },
    { r: 156, g: 129, b: 233, alpha: 255 },
    { r: 208, g: 196, b: 255, alpha: 255 },
    { r: 144, g: 0, b: 81, alpha: 255 },
    { r: 216, g: 69, b: 143, alpha: 255 },
    { r: 255, g: 150, b: 195, alpha: 255 },
    { r: 93, g: 64, b: 22, alpha: 255 },
    { r: 182, g: 150, b: 121, alpha: 255 },
    { r: 228, g: 198, b: 172, alpha: 255 },
];

function getColor(index: number): Color {
    return COLORS[index] ?? { r: 0, g: 0, b: 0, alpha: 0 };
}

function loadImage(index: number): Buffer {
    const emblemPath = join(process.cwd(), RESOURCES_FOLDER, 'emblems', `emblems [${index}].png`);

    if (!existsSync(emblemPath)) {
        throw new Error(`Image not found: ${emblemPath}`);
    }
    return readFileSync(emblemPath);
}


@Injectable()
export class Halo3EmblemsService {
    public async renderEmblem(
        emblem: EmblemDto,
    ) {
        const baseImage = sharp({
            create: {
                width: emblem.size,
                height: emblem.size,
                channels: 4,
                background: emblem.armour_primary_color !== undefined
                    ? getColor(emblem.armour_primary_color)
                    : { r: 0, g: 0, b: 0, alpha: 0 },
            },
        });

        const overlays: Buffer[] = [];

        const backgroundLayer = await this.getLayerImage(
            emblem.background,
            emblem.background_color,
            emblem.size,
            'blue',
        );
        overlays.push(backgroundLayer);

        if (emblem.secondary) {
            const secondaryLayer = await this.getLayerImage(
                emblem.primary,
                emblem.secondary_color,
                emblem.size,
                'red',
            );
            overlays.push(secondaryLayer);
        }

        const primaryLayer = await this.getLayerImage(
            emblem.primary,
            emblem.primary_color,
            emblem.size,
            'green',
        );
        overlays.push(primaryLayer);

        return await baseImage
            .composite(overlays.map((input) => ({ input })))
            .png()
            .toBuffer();
    }

    private async getLayerImage(
        emblemIndex: number,
        colorIndex: number,
        size: number,
        channel: 'red' | 'green' | 'blue',
    ): Promise<Buffer> {
        const image = sharp(loadImage(emblemIndex)).resize(size, size, { kernel: 'nearest' });

        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
        const color = getColor(colorIndex);
        const colored = Buffer.alloc(data.length);

        for (let i = 0; i < data.length; i += 4) {
            let alpha = 0;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            if (channel === 'red' && r > 0) alpha = (r / 15) * 255;
            else if (channel === 'green' && g > 0) alpha = (g / 240) * 255;
            else if (channel === 'blue' && b > 0) alpha = (b / 15) * 255;

            colored[i] = color.r;
            colored[i + 1] = color.g;
            colored[i + 2] = color.b;
            colored[i + 3] = Math.min(255, Math.max(0, alpha));
        }

        return sharp(colored, {
            raw: {
                width: info.width,
                height: info.height,
                channels: 4,
            },
        })
            .png()
            .toBuffer();
    }
}