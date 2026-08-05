import type { Band, BandColor, BandValue, MasteryValue } from '../types';
import { createBand, DEFAULT_COLORS } from './factories';
import { DEFAULT_MAX_VALUE, masteryCount, nextBandValue, sortBands, toValue } from './ranges';

/**
 * What changed, so the view can patch the smallest possible part of the DOM.
 *
 * This exists because the editor is a form: re-rendering a row wholesale would
 * destroy the caret of whoever is typing in it. Every mutation therefore says
 * how far the damage spreads.
 *
 * - `list`    — bands added or removed. Rows must be rebuilt.
 * - `order`   — a threshold moved a band past another. The existing rows are
 *               reordered rather than rebuilt, so the field being typed into
 *               travels with its own value.
 * - `values`  — a threshold changed without moving anything. Every band's range
 *               readout still has to refresh, because a band's upper bound is
 *               the threshold of the band above it.
 * - `color`   — one band's colour token.
 * - `mastery` — one band's mastery flag.
 * - `text`    — a label was typed into. Renders nothing at all: the DOM already
 *               shows what was typed, and re-rendering would move the caret. It
 *               is still reported so that hosts listening via `onChange` hear
 *               about every edit, not just structural ones.
 */
export type BandChange =
    | { type: 'list' }
    | { type: 'order' }
    | { type: 'values' }
    | { type: 'color'; index: number }
    | { type: 'mastery'; index: number }
    | { type: 'text' };

export type BandListener = (change: BandChange) => void;

/**
 * Owns the band array and every mutation to it.
 *
 * The array passed in is adopted rather than copied: the host page hands over
 * `window._performanceBand` and expects the edits to land on that same object.
 *
 * It is **sorted on adoption**, which is a real mutation of the host's array
 * and is meant to be. Band order is derived from the thresholds rather than
 * chosen, so a set that arrived out of order would otherwise render ranges that
 * disagree with the data.
 */
export class BandState {
    private readonly bands: Band[];

    private readonly maxValue: number;

    private readonly colors: BandColor[];

    private readonly listeners = new Set<BandListener>();

    constructor(bands: Band[] = [], maxValue: number = DEFAULT_MAX_VALUE, colors: BandColor[] = DEFAULT_COLORS) {
        this.bands = sortBands(bands);
        this.maxValue = maxValue;
        this.colors = colors.length ? colors : DEFAULT_COLORS;
    }

    all(): Band[] {
        return this.bands;
    }

    at(index: number): Band | undefined {
        return this.bands[index];
    }

    count(): number {
        return this.bands.length;
    }

    masteryTotal(): number {
        return masteryCount(this.bands);
    }

    subscribe(listener: BandListener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    private emit(change: BandChange): void {
        this.listeners.forEach((listener) => listener(change));
    }

    addBand(): Band {
        const band = createBand(nextBandValue(this.bands, this.maxValue), this.nextColor());
        this.bands.push(band);
        sortBands(this.bands);
        this.emit({ type: 'list' });

        return band;
    }

    /**
     * The first palette token no band is using yet, so a new band does not
     * silently duplicate the colour of the one above it. Once the palette is
     * exhausted it rotates, because running out of colours is not a reason to
     * refuse a band.
     */
    private nextColor(): string {
        const used = new Set(this.bands.map((band) => band.color));
        const unused = this.colors.find((color) => !used.has(color.token));

        return (unused ?? this.colors[this.bands.length % this.colors.length]).token;
    }

    removeBand(index: number): void {
        if (!this.at(index)) {
            return;
        }

        this.bands.splice(index, 1);
        this.emit({ type: 'list' });
    }

    setLabel(index: number, label: string): void {
        const band = this.at(index);
        if (band) {
            band.label = label;
            this.emit({ type: 'text' });
        }
    }

    setColor(index: number, color: string): void {
        const band = this.at(index);
        if (band) {
            band.color = color;
            this.emit({ type: 'color', index });
        }
    }

    setMastery(index: number, mastery: MasteryValue): void {
        const band = this.at(index);
        if (band) {
            band.mastery_flg = mastery;
            this.emit({ type: 'mastery', index });
        }
    }

    /**
     * Writes a threshold and re-sorts the set.
     *
     * Sorting on every keystroke is deliberate: the bands are meant to read
     * highest-first at all times, and the range readouts are only correct while
     * that holds. The view reorders the existing rows rather than rebuilding
     * them, so the field being typed into moves with its own value instead of
     * having a neighbour's value swapped underneath the caret.
     */
    setValue(index: number, value: BandValue): void {
        const band = this.at(index);
        if (!band) {
            return;
        }

        band.min_value = value;

        const before = this.bands.slice();
        sortBands(this.bands);
        const reordered = this.bands.some((current, position) => current !== before[position]);

        this.emit(reordered ? { type: 'order' } : { type: 'values' });
    }

    /** Numeric threshold of a band, for the range readouts. */
    valueAt(index: number): number {
        const band = this.at(index);

        return band ? toValue(band.min_value) : 0;
    }
}
