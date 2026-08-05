import { describe, expect, it, vi } from 'vitest';
import { BandState, type BandChange } from '../../src/model/BandState';
import { DEFAULT_COLORS } from '../../src/model/factories';
import { createBand, createBandSet } from '../fixtures/bands';

function record(state: BandState): BandChange[] {
    const changes: BandChange[] = [];
    state.subscribe((change) => changes.push(change));

    return changes;
}

describe('BandState', () => {
    it('adopts the array it is given rather than copying it', () => {
        const bands = createBandSet();

        expect(new BandState(bands).all()).to.equal(bands);
    });

    it('sorts on adoption, because band order is derived from the thresholds', () => {
        const bands = [createBand({ min_value: 50 }), createBand({ min_value: 90 }), createBand({ min_value: 0 })];
        const state = new BandState(bands);

        expect(state.all().map((band) => band.min_value)).to.deep.equal([90, 50, 0]);
        // The sort landed on the host's own array, not on a copy.
        expect(bands.map((band) => band.min_value)).to.deep.equal([90, 50, 0]);
    });

    it('defaults to an empty set', () => {
        expect(new BandState().count()).to.equal(0);
    });

    it('reports counts, mastery totals and thresholds', () => {
        const state = new BandState(createBandSet());

        expect(state.count()).to.equal(4);
        expect(state.masteryTotal()).to.equal(2);
        expect(state.valueAt(1)).to.equal(75);
        expect(state.valueAt(99)).to.equal(0);
        expect(state.at(0)?.label).to.equal('Standard Exceeded');
        expect(state.at(99)).to.equal(undefined);
    });

    describe('addBand', () => {
        it('adds a band at the top of the scale and reports a list change', () => {
            const state = new BandState(createBandSet());
            const changes = record(state);
            const band = state.addBand();

            expect(band.min_value).to.equal(95);
            expect(state.all()[0]).to.equal(band);
            expect(changes).to.deep.equal([{ type: 'list' }]);
        });

        it('picks a colour no other band is using', () => {
            const state = new BandState([createBand({ color: 'blue-base' })]);

            expect(state.addBand().color).to.equal('green-base');
        });

        it('rotates once the palette is exhausted rather than refusing a band', () => {
            const bands = DEFAULT_COLORS.map((color, index) =>
                createBand({ color: color.token, min_value: index * 10 })
            );
            const state = new BandState(bands);

            expect(DEFAULT_COLORS.map((color) => color.token)).to.contain(state.addBand().color);
        });

        it('honours a supplied palette', () => {
            const state = new BandState([], 100, [{ token: 'custom', label: 'Custom' }]);

            expect(state.addBand().color).to.equal('custom');
        });

        it('falls back to the default palette when handed an empty one', () => {
            const state = new BandState([], 100, []);

            expect(state.addBand().color).to.equal(DEFAULT_COLORS[0].token);
        });
    });

    describe('removeBand', () => {
        it('removes the band and reports a list change', () => {
            const state = new BandState(createBandSet());
            const changes = record(state);
            state.removeBand(1);

            expect(state.count()).to.equal(3);
            expect(state.all().map((band) => band.label)).to.not.contain('Standard Met');
            expect(changes).to.deep.equal([{ type: 'list' }]);
        });

        it('ignores an index that does not exist', () => {
            const state = new BandState(createBandSet());
            const changes = record(state);
            state.removeBand(99);

            expect(state.count()).to.equal(4);
            expect(changes).to.have.length(0);
        });
    });

    describe('setValue', () => {
        it('reports `values` when the order is unchanged', () => {
            const state = new BandState(createBandSet());
            const changes = record(state);
            state.setValue(1, '80');

            expect(state.at(1)?.min_value).to.equal('80');
            expect(changes).to.deep.equal([{ type: 'values' }]);
        });

        it('re-sorts and reports `order` when a band overtakes another', () => {
            const state = new BandState(createBandSet());
            const changes = record(state);
            state.setValue(1, '95');

            expect(state.all().map((band) => band.label)[0]).to.equal('Standard Met');
            expect(changes).to.deep.equal([{ type: 'order' }]);
        });

        it('tolerates a half-typed value without reordering on every character', () => {
            const state = new BandState(createBandSet());
            state.setValue(1, '');

            // '' reads as 0, which is below the 0-floor band only on a tie —
            // the point is that it does not throw and the value is kept verbatim.
            expect(state.at(state.all().findIndex((band) => band.label === 'Standard Met'))?.min_value).to.equal('');
        });

        it('ignores an index that does not exist', () => {
            const state = new BandState(createBandSet());
            const changes = record(state);
            state.setValue(99, '10');

            expect(changes).to.have.length(0);
        });
    });

    describe('text, colour and mastery', () => {
        it('reports a label edit as `text`, which renders nothing', () => {
            const state = new BandState(createBandSet());
            const changes = record(state);
            state.setLabel(0, 'Exceeded');

            expect(state.at(0)?.label).to.equal('Exceeded');
            expect(changes).to.deep.equal([{ type: 'text' }]);
        });

        it('reports a colour change against its band', () => {
            const state = new BandState(createBandSet());
            const changes = record(state);
            state.setColor(2, 'red-base');

            expect(state.at(2)?.color).to.equal('red-base');
            expect(changes).to.deep.equal([{ type: 'color', index: 2 }]);
        });

        it('reports a mastery change against its band', () => {
            const state = new BandState(createBandSet());
            const changes = record(state);
            state.setMastery(2, true);

            expect(state.at(2)?.mastery_flg).to.equal(true);
            expect(state.masteryTotal()).to.equal(3);
            expect(changes).to.deep.equal([{ type: 'mastery', index: 2 }]);
        });

        it('ignores indexes that do not exist', () => {
            const state = new BandState(createBandSet());
            const changes = record(state);
            state.setLabel(99, 'x');
            state.setColor(99, 'x');
            state.setMastery(99, true);

            expect(changes).to.have.length(0);
        });
    });

    describe('subscribe', () => {
        it('stops notifying after the returned function is called', () => {
            const state = new BandState(createBandSet());
            const listener = vi.fn();
            const unsubscribe = state.subscribe(listener);

            state.setLabel(0, 'a');
            unsubscribe();
            state.setLabel(0, 'b');

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
});
