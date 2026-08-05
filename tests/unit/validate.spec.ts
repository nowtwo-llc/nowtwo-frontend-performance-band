import { describe, expect, it } from 'vitest';
import { validateBands } from '../../src/model/validate';
import type { ProblemCode } from '../../src/types';
import { createBand, createBandSet } from '../fixtures/bands';

function codes(bands: Parameters<typeof validateBands>[0], maxValue?: number): ProblemCode[] {
    return validateBands(bands, maxValue).problems.map((problem) => problem.code);
}

describe('validateBands', () => {
    it('accepts the band set the host template ships with', () => {
        const result = validateBands(createBandSet());

        expect(result.valid).to.equal(true);
        expect(result.problems).to.have.length(0);
    });

    it('reports an empty set and stops there', () => {
        const result = validateBands([]);

        expect(result.valid).to.equal(false);
        expect(result.problems.map((problem) => problem.code)).to.deep.equal(['empty-bands']);
    });

    it('reports a band with no label, naming its position', () => {
        const bands = createBandSet();
        bands[1].label = '   ';

        const problem = validateBands(bands).problems.find((item) => item.code === 'band-without-label');

        expect(problem?.bandIndex).to.equal(1);
        expect(problem?.message).to.contain('Band 2');
    });

    it('reports a threshold that is not a number', () => {
        const bands = createBandSet();
        bands[0].min_value = 'abc';

        const problem = validateBands(bands).problems.find((item) => item.code === 'band-value-not-numeric');

        expect(problem?.bandIndex).to.equal(0);
        expect(problem?.message).to.contain('Standard Exceeded');
    });

    it('does not also report an unparseable threshold as out of range or duplicated', () => {
        const bands = [createBand({ min_value: 'abc', label: 'One' }), createBand({ min_value: 0, label: 'Two' })];

        expect(codes(bands)).to.deep.equal(['band-value-not-numeric']);
    });

    it('reports a threshold outside the scale at either end', () => {
        expect(codes([createBand({ min_value: -1 }), createBand({ min_value: 0 })])).to.contain(
            'band-value-out-of-range'
        );
        expect(codes([createBand({ min_value: 101 }), createBand({ min_value: 0 })])).to.contain(
            'band-value-out-of-range'
        );
    });

    it('measures range against a custom ceiling', () => {
        expect(codes([createBand({ min_value: 4 }), createBand({ min_value: 0 })], 4)).to.not.contain(
            'band-value-out-of-range'
        );
        expect(codes([createBand({ min_value: 5 }), createBand({ min_value: 0 })], 4)).to.contain(
            'band-value-out-of-range'
        );
    });

    it('reports two bands sharing a threshold, pointing at the second', () => {
        const bands = [
            createBand({ min_value: 50, label: 'First' }),
            createBand({ min_value: 50, label: 'Second' }),
            createBand({ min_value: 0, label: 'Floor' })
        ];

        const problem = validateBands(bands).problems.find((item) => item.code === 'duplicate-band-value');

        expect(problem?.bandIndex).to.equal(1);
        expect(problem?.message).to.contain('Second');
        expect(problem?.message).to.contain('band 1');
    });

    it('reports a set with no band at zero', () => {
        const bands = createBandSet();
        bands[3].min_value = 20;

        expect(codes(bands)).to.contain('bands-without-floor');
    });

    it('reports a set where nothing counts as mastery', () => {
        const bands = createBandSet().map((band) => ({ ...band, mastery_flg: 0 }));

        expect(codes(bands)).to.contain('no-mastery-band');
    });

    it('falls back to a positional name when the label is blank', () => {
        const problem = validateBands([createBand({ label: '', min_value: 500 })]).problems.find(
            (item) => item.code === 'band-value-out-of-range'
        );

        expect(problem?.message).to.contain('Band 1');
    });
});
