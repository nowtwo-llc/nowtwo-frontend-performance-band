import { describe, expect, it } from 'vitest';
import {
    bandRange,
    DEFAULT_MAX_VALUE,
    hasFloor,
    masteryCount,
    masteryFieldValue,
    nextBandValue,
    sortBands,
    toMastery,
    toValue
} from '../../src/model/ranges';
import { createBand, createBandSet } from '../fixtures/bands';

describe('toValue', () => {
    it('passes numbers through', () => {
        expect(toValue(90)).to.equal(90);
    });

    it('parses numeric strings, which is what a text input hands back', () => {
        expect(toValue('75')).to.equal(75);
        expect(toValue('12.5')).to.equal(12.5);
    });

    it('reads a half-typed value as zero rather than NaN', () => {
        expect(toValue('')).to.equal(0);
        expect(toValue('-')).to.equal(0);
        expect(toValue('abc')).to.equal(0);
    });
});

describe('toMastery', () => {
    it('accepts the boolean a checkbox hands back', () => {
        expect(toMastery(true)).to.equal(true);
        expect(toMastery(false)).to.equal(false);
    });

    it('accepts the 1/0 the host persists', () => {
        expect(toMastery(1)).to.equal(true);
        expect(toMastery(0)).to.equal(false);
    });
});

describe('masteryFieldValue', () => {
    it('always posts 1 or 0 whichever form the value arrived in', () => {
        expect(masteryFieldValue(true)).to.equal('1');
        expect(masteryFieldValue(1)).to.equal('1');
        expect(masteryFieldValue(false)).to.equal('0');
        expect(masteryFieldValue(0)).to.equal('0');
    });
});

describe('sortBands', () => {
    it('sorts highest threshold first', () => {
        const bands = [createBand({ min_value: 50 }), createBand({ min_value: 90 }), createBand({ min_value: 0 })];

        expect(sortBands(bands).map((band) => band.min_value)).to.deep.equal([90, 50, 0]);
    });

    it('sorts string thresholds numerically, not lexicographically', () => {
        const bands = [
            createBand({ min_value: '9' }),
            createBand({ min_value: '75' }),
            createBand({ min_value: '50' })
        ];

        expect(sortBands(bands).map((band) => band.min_value)).to.deep.equal(['75', '50', '9']);
    });

    it('sorts in place, because the array is the host object', () => {
        const bands = [createBand({ min_value: 10 }), createBand({ min_value: 20 })];

        expect(sortBands(bands)).to.equal(bands);
    });
});

describe('bandRange', () => {
    it('closes the highest band at the ceiling', () => {
        expect(bandRange(createBandSet(), 0)).to.deep.equal({ from: 90, to: DEFAULT_MAX_VALUE, isTop: true });
    });

    it('runs a band up to the threshold of the band above it', () => {
        expect(bandRange(createBandSet(), 1)).to.deep.equal({ from: 75, to: 90, isTop: false });
        expect(bandRange(createBandSet(), 3)).to.deep.equal({ from: 0, to: 50, isTop: false });
    });

    it('honours a custom ceiling', () => {
        expect(bandRange(createBandSet(), 0, 4).to).to.equal(4);
    });

    it('reports a zero floor for an index that does not exist', () => {
        expect(bandRange([], 0)).to.deep.equal({ from: 0, to: DEFAULT_MAX_VALUE, isTop: true });
    });
});

describe('nextBandValue', () => {
    it('starts an empty set at the floor', () => {
        expect(nextBandValue([])).to.equal(0);
    });

    it('lands halfway between the current top and the ceiling', () => {
        expect(nextBandValue(createBandSet())).to.equal(95);
    });

    it('honours a custom ceiling', () => {
        expect(nextBandValue([createBand({ min_value: 2 })], 4)).to.equal(3);
    });

    it('does not exceed the ceiling when a band already sits above it', () => {
        expect(nextBandValue([createBand({ min_value: 200 })], 100)).to.equal(100);
    });
});

describe('masteryCount', () => {
    it('counts bands flagged as mastery in either form', () => {
        expect(masteryCount(createBandSet())).to.equal(2);
        expect(masteryCount([createBand({ mastery_flg: true }), createBand({ mastery_flg: 0 })])).to.equal(1);
    });
});

describe('hasFloor', () => {
    it('is true when some band starts at zero', () => {
        expect(hasFloor(createBandSet())).to.equal(true);
    });

    it('is false when the lowest band leaves a hole at the bottom', () => {
        expect(hasFloor([createBand({ min_value: 40 })])).to.equal(false);
    });
});
