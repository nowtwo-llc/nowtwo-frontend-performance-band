import type { Band } from '../../src/types';

export function createBand(overrides: Partial<Band> = {}): Band {
    return {
        id: 'band-1',
        color: 'blue-base',
        min_value: 90,
        label: 'Standard Exceeded',
        mastery_flg: 1,
        ...overrides
    };
}

/**
 * The band set the host template ships with, which is the shape every wire
 * contract test is written against.
 */
export function createBandSet(): Band[] {
    return [
        { id: 'b-1', color: 'blue-base', min_value: 90, label: 'Standard Exceeded', mastery_flg: 1 },
        { id: 'b-2', color: 'green-base', min_value: 75, label: 'Standard Met', mastery_flg: 1 },
        { id: 'b-3', color: 'yellow-base', min_value: 50, label: 'Standard Nearly Met', mastery_flg: 0 },
        { id: 'b-4', color: 'red-base', min_value: 0, label: 'Standard Not Yet Met', mastery_flg: 0 }
    ];
}
