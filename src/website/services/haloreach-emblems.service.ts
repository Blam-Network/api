import { Injectable } from "@nestjs/common";
import { existsSync } from "fs";
import { join } from "path";
import * as sharp from "sharp";
import { RESOURCES_FOLDER } from "src/constants";

export interface ReachEmblemDto {
    size: number;
    foreground: number;
    background: number;
    flags: number;
    primary_color: number;
    secondary_color: number;
    background_color: number;
}

export const REACH_EMBLEM_COUNT = 96;

// globals\globals.globals `emblem colors`, linear.
const EMBLEM_COLORS: readonly [number, number, number][] = [
    [0.036706, 0.036706, 0.036706], [0.338667, 0.338667, 0.338667], [0.693872, 0.693872, 0.693872],
    [0.173961, 0.104208, 0.062766], [0.354353, 0.212976, 0.146061], [0.609255, 0.4037, 0.300202],
    [0.179569, 0.205333, 0.099424], [0.317256, 0.389647, 0.158052], [0.483786, 0.59749, 0.267837],
    [0.035559, 0.19749, 0.059473], [0.100534, 0.424941, 0.162184], [0.252213, 0.617098, 0.288547],
    [0.028975, 0.252392, 0.235591], [0.067508, 0.452392, 0.444509], [0.216483, 0.72298, 0.697229],
    [0.046752, 0.11597, 0.232784], [0.13012, 0.223305, 0.385725], [0.27202, 0.439593, 0.703372],
    [0.113734, 0.107698, 0.272], [0.210451, 0.198344, 0.483765], [0.391183, 0.374411, 0.730824],
    [0.366118, 0.052139, 0.052139], [0.660235, 0.058618, 0.058618], [0.824941, 0.302931, 0.302931],
    [0.462077, 0.095308, 0.020289], [0.846873, 0.208637, 0.05127], [0.838799, 0.423268, 0.254152],
    [0.450786, 0.234551, 0.025187], [0.73791, 0.55834, 0.076185], [0.879622, 0.838799, 0.201556],
];

const k_emblem_flag_alternate_foreground_disabled = 1 << 0;
const k_emblem_flag_flip_foreground = 1 << 1;
const k_emblem_flag_flip_background = 1 << 2;

function emblemColor(index: number): [number, number, number] {
    const color = EMBLEM_COLORS[index] ?? EMBLEM_COLORS[0];
    return [Math.sqrt(color[0]), Math.sqrt(color[1]), Math.sqrt(color[2])];
}

function emblemPath(index: number): string {
    const clamped = index >= 0 && index < REACH_EMBLEM_COUNT ? index : 0;
    return join(process.cwd(), RESOURCES_FOLDER, "reach_emblems", `${clamped}.png`);
}

@Injectable()
export class HaloReachEmblemsService {
    private readonly cache = new Map<number, Promise<{ data: Buffer; width: number; height: number }>>();

    private loadEmblem(index: number) {
        let cached = this.cache.get(index);
        if (!cached) {
            const path = emblemPath(index);
            if (!existsSync(path)) {
                throw new Error(`Reach emblem not found: ${path}`);
            }
            cached = sharp(path)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true })
                .then(({ data, info }) => ({ data, width: info.width, height: info.height }));
            this.cache.set(index, cached);
        }
        return cached;
    }

    /** `generate_h3_compatible_emblem_pixel` from `shaders\explicit\player_emblem.hlsl_include`. */
    public async renderEmblem(emblem: ReachEmblemDto): Promise<Buffer> {
        const [foreground, background] = await Promise.all([
            this.loadEmblem(emblem.foreground),
            this.loadEmblem(emblem.background),
        ]);
        const { width, height } = foreground;

        const alternateEnabled = (emblem.flags & k_emblem_flag_alternate_foreground_disabled) === 0;
        const flipForeground = (emblem.flags & k_emblem_flag_flip_foreground) !== 0;
        const flipBackground = (emblem.flags & k_emblem_flag_flip_background) !== 0;
        const primary = emblemColor(emblem.primary_color);
        const secondary = emblemColor(emblem.secondary_color);
        const backgroundColor = emblemColor(emblem.background_color);

        const channel = (value: number, flip: boolean) => {
            const normalized = value / 255;
            return flip ? 1 - normalized : normalized;
        };

        const out = Buffer.alloc(width * height * 4);
        for (let i = 0; i < width * height * 4; i += 4) {
            let value = channel(foreground.data[i + 1], flipForeground);
            let r = primary[0] * value;
            let g = primary[1] * value;
            let b = primary[2] * value;
            let alpha = value;

            if (alternateEnabled) {
                value = channel(foreground.data[i], flipForeground);
                r = r * (1 - value) + secondary[0] * value;
                g = g * (1 - value) + secondary[1] * value;
                b = b * (1 - value) + secondary[2] * value;
                alpha = Math.min(1, alpha + value);
            }

            const back = channel(background.data[i + 2], flipBackground);
            r = backgroundColor[0] * back * (1 - alpha) + r;
            g = backgroundColor[1] * back * (1 - alpha) + g;
            b = backgroundColor[2] * back * (1 - alpha) + b;
            alpha = Math.min(1, back + alpha);

            const normalize = Math.max(alpha, 0.001);
            out[i] = Math.round(Math.min(1, r / normalize) * 255);
            out[i + 1] = Math.round(Math.min(1, g / normalize) * 255);
            out[i + 2] = Math.round(Math.min(1, b / normalize) * 255);
            out[i + 3] = Math.round(alpha * 255);
        }

        return sharp(out, { raw: { width, height, channels: 4 } })
            .resize(emblem.size, emblem.size, { kernel: emblem.size < width ? "lanczos3" : "cubic" })
            .png()
            .toBuffer();
    }
}
