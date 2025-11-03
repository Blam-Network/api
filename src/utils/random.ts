import seedrandom from 'seedrandom';

export class DeterministicRandomizer {
    private rng: seedrandom.PRNG;

    constructor(seed: string) {
        this.rng = seedrandom(seed);
    }

    next(): number {
        return this.rng();
    }

    pick<T>(array: T[]): T {
        const index = Math.floor(this.rng() * array.length);
        return array[index];
    }
}
