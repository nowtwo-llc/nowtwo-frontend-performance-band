import type { Band, ValidationProblem, ValidationResult } from '../types';
import { DEFAULT_MAX_VALUE, hasFloor, masteryCount, toValue } from './ranges';

/**
 * Checks a band set for the problems that make it unusable once saved.
 *
 * The editor deliberately does not block these itself — half-finished state is
 * normal while someone is still working, and a control that refuses input is
 * worse than one that reports. The rules here are the ones that leave scores
 * unclassifiable or classified twice.
 *
 * The host owns what to do with the result: block submit, warn, or ignore.
 */
export function validateBands(bands: Band[], maxValue: number = DEFAULT_MAX_VALUE): ValidationResult {
    const problems: ValidationProblem[] = [];

    if (!bands.length) {
        problems.push({
            code: 'empty-bands',
            message: 'There are no performance bands. Add at least one before saving.'
        });

        return { valid: false, problems };
    }

    const seen = new Map<number, number>();

    bands.forEach((band, bandIndex) => {
        const label = band.label.trim() || `Band ${bandIndex + 1}`;

        if (!band.label.trim()) {
            problems.push({
                code: 'band-without-label',
                message: `Band ${bandIndex + 1} has no label.`,
                bandIndex
            });
        }

        // Read as zero at runtime so the ordering stays sane while typing, which
        // means a value left unparseable would silently save as a zero
        // threshold rather than fail.
        if (Number.isNaN(parseFloat(String(band.min_value)))) {
            problems.push({
                code: 'band-value-not-numeric',
                message: `"${label}" has a minimum value that is not a number.`,
                bandIndex
            });

            return;
        }

        const value = toValue(band.min_value);

        if (value < 0 || value > maxValue) {
            problems.push({
                code: 'band-value-out-of-range',
                message: `"${label}" starts at ${value}, which is outside the 0–${maxValue} scale.`,
                bandIndex
            });
        }

        // Two bands sharing a threshold means a score at that threshold belongs
        // to both, and which one wins depends on sort stability rather than on
        // anything the person editing chose.
        const first = seen.get(value);
        if (first === undefined) {
            seen.set(value, bandIndex);
        } else {
            problems.push({
                code: 'duplicate-band-value',
                message: `"${label}" starts at ${value}, the same as band ${first + 1}. Scores there would be ambiguous.`,
                bandIndex
            });
        }
    });

    // Without a band at zero the bottom of the scale falls through every
    // threshold and classifies as nothing at all.
    if (!hasFloor(bands)) {
        problems.push({
            code: 'bands-without-floor',
            message: 'No band starts at 0, so the lowest scores fall outside every band.'
        });
    }

    if (!masteryCount(bands)) {
        problems.push({
            code: 'no-mastery-band',
            message: 'No band is marked as mastery, so mastery can never be reached.'
        });
    }

    return { valid: problems.length === 0, problems };
}
