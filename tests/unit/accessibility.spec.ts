import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PerformanceBandEditor } from '../../src/PerformanceBandEditor';
import { VISUALLY_HIDDEN_CLASS } from '../../src/dom/element';
import { createBand, createBandSet } from '../fixtures/bands';

/**
 * This is a form used in education, where conformance is routinely a
 * procurement requirement. Treat a failure here as a broken feature, not as a
 * missing polish item.
 */
let container: HTMLElement;
let editor: PerformanceBandEditor | null = null;

function mount(bands = createBandSet()): PerformanceBandEditor {
    editor = new PerformanceBandEditor({ container, bands }).mount();

    return editor;
}

/**
 * The accessible name of a form control, by the routes this editor uses:
 * `aria-label`, an associated `<label for>`, or — for a button — its own
 * content. An icon-only button has no content, which is exactly why those carry
 * an explicit `aria-label`.
 */
function accessibleName(control: Element): string {
    const label = control.id ? container.querySelector(`label[for="${control.id}"]`) : null;
    const ownText = control.tagName === 'BUTTON' ? control.textContent : null;

    return (control.getAttribute('aria-label') ?? label?.textContent ?? ownText ?? '').trim();
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

describe('accessible names', () => {
    it('gives every input, select and button a name', () => {
        mount();

        const controls = Array.from(container.querySelectorAll('input, select, button')).filter(
            (control) => !(control instanceof HTMLInputElement && control.type === 'hidden')
        );

        expect(controls.length).to.be.greaterThan(0);
        controls.forEach((control) => {
            expect(accessibleName(control), `${control.tagName}#${control.id} has no accessible name`).to.not.equal('');
        });
    });

    it('binds labels by for/id rather than relying on placeholders', () => {
        mount();
        const label = container.querySelector<HTMLInputElement>('input[name="performance_band_label[]"]')!;

        expect(label.id).to.not.equal('');
        expect(container.querySelector(`label[for="${label.id}"]`)?.textContent).to.equal('Band label');
    });

    it('hides those labels visually but leaves them in the accessibility tree', () => {
        mount();
        const hidden = container.querySelector(`.${VISUALLY_HIDDEN_CLASS}`);

        // clip-path, not display:none — the latter removes the label from the
        // accessibility tree as well, which is the opposite of the point.
        expect(hidden).to.not.equal(null);
        expect(hidden?.tagName).to.equal('LABEL');
    });

    it('gives ids that do not collide between two editors on one page', () => {
        const second = document.createElement('div');
        document.body.append(second);

        mount();
        const other = new PerformanceBandEditor({ container: second, bands: createBandSet() }).mount();

        const ids = Array.from(document.querySelectorAll<HTMLElement>('[id]')).map((node) => node.id);

        expect(new Set(ids).size).to.equal(ids.length);

        other.destroy();
    });

    it('names the icon-only remove button, which has no text of its own', () => {
        mount();
        const remove = container.querySelector('button[aria-label]')!;

        expect(remove.getAttribute('aria-label')).to.equal('Remove band');
        expect(remove.getAttribute('title')).to.equal('Remove band');
    });

    it('gives the mastery checkbox a visible label, since a lone checkbox reads as nothing', () => {
        mount();
        const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        const label = container.querySelector(`label[for="${checkbox.id}"]`);

        expect(label?.textContent).to.equal('Mastery');
        expect(label?.className).to.not.contain(VISUALLY_HIDDEN_CLASS);
    });
});

describe('structure and announcements', () => {
    it('states the list semantics the flex rows do not carry on their own', () => {
        mount();

        expect(container.querySelector('[role="list"]')?.getAttribute('aria-label')).to.equal('Performance bands');
        expect(container.querySelectorAll('[role="listitem"]')).to.have.length(4);
    });

    it('announces the summary politely, because it changes on every toggle', () => {
        mount();
        const status = container.querySelector('.band-footer-container [role="status"]');

        expect(status?.getAttribute('aria-live')).to.equal('polite');
    });

    it('announces the empty state, which is the only feedback a last delete gives', () => {
        const instance = mount([createBand()]);
        instance.removeBand(0);

        expect(container.querySelector('.band-container--empty')?.getAttribute('role')).to.equal('status');
    });

    it('labels the range readout for screen readers, not just the column header', () => {
        mount();
        const range = container.querySelector('.band-container--range');

        expect(range?.querySelector(`.${VISUALLY_HIDDEN_CLASS}`)?.textContent).to.equal('Covers scores: ');
    });

    it('hides the decorative swatch from assistive tech', () => {
        mount();

        expect(container.querySelector('.band-swatch')?.getAttribute('aria-hidden')).to.equal('true');
    });
});

describe('keyboard use', () => {
    it('needs no pointer to reorder, because order follows the threshold', () => {
        const instance = mount();
        const value = container.querySelectorAll<HTMLInputElement>('[name="performance_band_min_value[]"]')[3];

        value.focus();
        value.value = '99';
        value.dispatchEvent(new Event('input'));

        // Typing alone moved the band to the top and left the caret where it
        // was — there is no drag-only path to reordering in this editor.
        expect(instance.bands[0].label).to.equal('Standard Not Yet Met');
        expect(document.activeElement).to.equal(value);
    });

    it('keeps every control reachable after a re-sort', () => {
        mount();
        const value = container.querySelectorAll<HTMLInputElement>('[name="performance_band_min_value[]"]')[3];
        value.value = '99';
        value.dispatchEvent(new Event('input'));

        const controls = Array.from(container.querySelectorAll('input, select, button')).filter(
            (control) => !(control instanceof HTMLInputElement && control.type === 'hidden')
        );

        controls.forEach((control) => {
            expect(control.hasAttribute('disabled')).to.equal(false);
            expect(accessibleName(control)).to.not.equal('');
        });
    });
});
