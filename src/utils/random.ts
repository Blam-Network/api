import * as seedrandom from 'seedrandom';

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

    pick_and_remove<T>(array: T[]): T {
        if (array.length === 0)
            throw new Error('Cannot pick from an empty array');

        const index = Math.floor(this.rng() * array.length);
        const [item] = array.splice(index, 1);
        return item;
    }
}
