import type { Band, BandRange, BandValue, MasteryValue } from '../types';

/** Top of the score scale when the host does not say otherwise. */
export const DEFAULT_MAX_VALUE = 100;

/**
 * Resolves a threshold to a number, treating anything unparseable as zero.
 *
 * Text inputs hand back strings, and a half-typed value like `-` or `` is a
 * normal intermediate state rather than an error — reading it as zero keeps the
 * ordering and the range readout sane while someone is still typing.
 */
export function toValue(value: BandValue): number {
    const parsed = parseFloat(String(value));

    return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Resolves a mastery flag to a boolean.
 *
 * Saved bands carry `1`/`0`; the checkbox hands back a boolean. Numeric zero
 * and the string `'0'` both mean "not mastery" — the latter matters because a
 * host that round-trips its data through a form gets strings back.
 */
export function toMastery(value: MasteryValue): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    return toValue(value) !== 0;
}

/**
 * The mastery flag as the host stores it. The hidden field always posts `1` or
 * `0` regardless of which form the value arrived in.
 */
export function masteryFieldValue(value: MasteryValue): string {
    return toMastery(value) ? '1' : '0';
}

/**
 * Sorts bands highest-threshold-first, in place.
 *
 * Order is not a preference here, it is derived: a band runs from its own
 * threshold up to the next one above it, so the list only reads correctly when
 * it is sorted. Comparison goes through `toValue` so bands loaded with string
 * thresholds ('90', '75', '5') sort numerically rather than lexicographically.
 */
export function sortBands(bands: Band[]): Band[] {
    bands.sort((a, b) => toValue(b.min_value) - toValue(a.min_value));

    return bands;
}

/**
 * The span of scores a band covers.
 *
 * A band starts at its own threshold and runs up to the next band above it,
 * exclusive; the highest band is closed at `maxValue`. Assumes the list is
 * sorted, which `BandState` guarantees.
 */
export function bandRange(bands: Band[], index: number, maxValue: number = DEFAULT_MAX_VALUE): BandRange {
    const band = bands[index];
    const from = band ? toValue(band.min_value) : 0;

    if (index <= 0) {
        return { from, to: maxValue, isTop: true };
    }

    return { from, to: toValue(bands[index - 1].min_value), isTop: false };
}

/**
 * The threshold a newly added band should get.
 *
 * A new band is a new top band, and the only room for one is between the
 * current highest threshold and the ceiling — so it lands halfway up that gap.
 * An empty set starts at zero, which is the floor every set needs anyway.
 */
export function nextBandValue(bands: Band[], maxValue: number = DEFAULT_MAX_VALUE): number {
    if (!bands.length) {
        return 0;
    }

    const highest = bands.reduce((max, band) => Math.max(max, toValue(band.min_value)), toValue(bands[0].min_value));

    return Math.round((Math.min(highest, maxValue) + maxValue) / 2);
}

export function masteryCount(bands: Band[]): number {
    return bands.filter((band) => toMastery(band.mastery_flg)).length;
}

/**
 * Whether the lowest band starts at zero. Without a zero floor the bottom of
 * the scale falls into no band at all, which is a scoring hole rather than a
 * style preference — see `model/validate.ts`.
 */
export function hasFloor(bands: Band[]): boolean {
    return bands.some((band) => toValue(band.min_value) === 0);
}
