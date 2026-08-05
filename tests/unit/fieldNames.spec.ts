import { describe, expect, it } from 'vitest';
import { bandFields } from '../../src/dom/fieldNames';
import { DEFAULT_FIELD_PREFIX } from '../../src/PerformanceBandEditor';

/**
 * These literals are the wire contract with the host's server. They are spelled
 * out rather than derived so that changing one has to break a test on purpose.
 */
describe('bandFields', () => {
    it('builds every field as a flat array under the default prefix', () => {
        expect(bandFields(DEFAULT_FIELD_PREFIX)).to.deep.equal({
            id: 'performance_band_id[]',
            color: 'performance_band_color[]',
            minValue: 'performance_band_min_value[]',
            label: 'performance_band_label[]',
            masteryFlag: 'performance_band_mastery_flg[]'
        });
    });

    it('takes the prefix from the caller', () => {
        expect(bandFields('scale')).to.deep.equal({
            id: 'scale_id[]',
            color: 'scale_color[]',
            minValue: 'scale_min_value[]',
            label: 'scale_label[]',
            masteryFlag: 'scale_mastery_flg[]'
        });
    });
});
