import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHANGE_EVENT, PerformanceBandEditor } from '../../src/PerformanceBandEditor';
import { createBandSet } from '../fixtures/bands';

let container: HTMLElement;
let editor: PerformanceBandEditor | null = null;

function field(name: string, index = 0): HTMLInputElement {
    return Array.from(container.querySelectorAll<HTMLInputElement>(`[name="${name}"]`))[index];
}

function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
}

beforeEach(() => {
    document.body.replaceChildren();
    container = document.createElement('div');
    document.body.append(container);
});

afterEach(() => {
    editor?.destroy();
    editor = null;
});

describe('onChange', () => {
    it('does not fire on mount', () => {
        const onChange = vi.fn();
        editor = new PerformanceBandEditor({ container, bands: createBandSet(), onChange }).mount();

        expect(onChange).to.not.toHaveBeenCalled();
    });

    it('fires on every keystroke in a label, even though nothing re-renders', () => {
        const onChange = vi.fn();
        editor = new PerformanceBandEditor({ container, bands: createBandSet(), onChange }).mount();

        type(field('performance_band_label[]'), 'E');
        type(field('performance_band_label[]'), 'Ex');

        // A `text` change renders nothing at all — it is reported purely so the
        // host hears about it.
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('fires on a threshold edit, whether or not it reorders', () => {
        const onChange = vi.fn();
        editor = new PerformanceBandEditor({ container, bands: createBandSet(), onChange }).mount();

        type(field('performance_band_min_value[]', 1), '80');
        type(field('performance_band_min_value[]', 1), '95');

        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('fires on colour, mastery, add and remove', () => {
        const onChange = vi.fn();
        const instance = new PerformanceBandEditor({ container, bands: createBandSet(), onChange }).mount();
        editor = instance;

        container.querySelector<HTMLButtonElement>('.band-color-picker--trigger')!.click();
        container.querySelectorAll<HTMLElement>('[role="option"]')[3].click();

        const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
        checkbox!.checked = false;
        checkbox!.dispatchEvent(new Event('change'));

        instance.addBand();
        instance.removeBand(0);

        expect(onChange).toHaveBeenCalledTimes(4);
    });

    it('hands over the live band array and the editor itself', () => {
        const onChange = vi.fn();
        const bands = createBandSet();
        const instance = new PerformanceBandEditor({ container, bands, onChange }).mount();
        editor = instance;

        type(field('performance_band_label[]'), 'Exceeded');

        expect(onChange).toHaveBeenCalledWith(bands, instance);
        expect(onChange.mock.calls[0][0][0].label).to.equal('Exceeded');
        expect(onChange.mock.calls[0][1].validate).to.be.a('function');
        expect(onChange.mock.calls[0][1].masteryCount).to.equal(2);
    });
});

describe(CHANGE_EVENT, () => {
    it('bubbles out of the container so a script-tag page can hear it', () => {
        editor = new PerformanceBandEditor({ container, bands: createBandSet() }).mount();
        const listener = vi.fn();
        document.addEventListener(CHANGE_EVENT, listener);

        type(field('performance_band_label[]'), 'Exceeded');

        expect(listener).toHaveBeenCalledTimes(1);

        document.removeEventListener(CHANGE_EVENT, listener);
    });

    it('carries the bands and the mastery count', () => {
        const instance = new PerformanceBandEditor({ container, bands: createBandSet() }).mount();
        editor = instance;

        let detail: { bands: unknown[]; masteryCount: number } | null = null;
        const listener = (event: Event) => {
            detail = (event as CustomEvent).detail;
        };
        container.addEventListener(CHANGE_EVENT, listener);

        instance.addBand();

        expect(detail).to.not.equal(null);
        expect(detail!.bands).to.equal(instance.bands);
        expect(detail!.masteryCount).to.equal(3);

        container.removeEventListener(CHANGE_EVENT, listener);
    });

    it('does not fire on mount', () => {
        const listener = vi.fn();
        document.addEventListener(CHANGE_EVENT, listener);

        editor = new PerformanceBandEditor({ container, bands: createBandSet() }).mount();

        expect(listener).to.not.toHaveBeenCalled();

        document.removeEventListener(CHANGE_EVENT, listener);
    });
});
