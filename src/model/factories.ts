import type { Band, BandColor, BandValue } from '../types';

/**
 * The colour tokens the host template ships with.
 *
 * They are host theme tokens, not colours this library knows how to paint — the
 * stylesheet here is layout only, and the host's CSS is what gives `blue-base`
 * a blue. Supply the `colors` option to offer a different palette.
 */
export const DEFAULT_COLORS: BandColor[] = [
    { token: 'blue-base', label: 'Blue' },
    { token: 'green-base', label: 'Green' },
    { token: 'yellow-base', label: 'Yellow' },
    { token: 'red-base', label: 'Red' }
];

/**
 * A new band. The empty `id` is what tells the host this row is new and needs
 * an identifier assigned on save — an existing band always carries the id it
 * was loaded with.
 *
 * A new band is the new top of the scale, so it is flagged as mastery by
 * default: the bands above the mastery line are the ones a new band is almost
 * always being added to.
 */
export function createBand(minValue: BandValue = 0, color: string = DEFAULT_COLORS[0].token): Band {
    return { id: '', color, min_value: minValue, label: '', mastery_flg: 1 };
}
