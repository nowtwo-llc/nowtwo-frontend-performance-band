import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHANGE_EVENT, PerformanceBandEditor, ROOT_CLASS } from '../../src/PerformanceBandEditor';
import { createMockHost } from '../setup';
import { createBand, createBandSet } from '../fixtures/bands';

let container: HTMLElement;
let editor: PerformanceBandEditor | null = null;

function mount(options: ConstructorParameters<typeof PerformanceBandEditor>[0] = {}): PerformanceBandEditor {
    editor = new PerformanceBandEditor({ container, ...options }).mount();

    return editor;
}

function rows(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('.band-container'));
}

function fields(name: string): HTMLInputElement[] {
    return Array.from(container.querySelectorAll<HTMLInputElement>(`[name="${name}"]`));
}

function values(name: string): string[] {
    return fields(name).map((field) => field.value);
}

function type(field: HTMLInputElement, value: string): void {
    field.value = value;
    field.dispatchEvent(new Event('input'));
}

beforeEach(() => {
    document.body.replaceChildren();
    container = document.createElement('div');
    container.id = 'nt-performance-band-app';
    document.body.append(container);
    window._performanceBand = [];
});

afterEach(() => {
    editor?.destroy();
    editor = null;
});

describe('mounting', () => {
    it('renders into an element', () => {
        mount({ bands: createBandSet() });

        expect(container.querySelector(`.${ROOT_CLASS}`)).to.not.equal(null);
        expect(rows()).to.have.length(4);
    });

    it('renders into a selector', () => {
        editor = new PerformanceBandEditor({ container: '#nt-performance-band-app', bands: createBandSet() }).mount();

        expect(container.querySelector(`.${ROOT_CLASS}`)).to.not.equal(null);
    });

    it('falls back to the default container id', () => {
        editor = new PerformanceBandEditor({ bands: createBandSet() }).mount();

        expect(container.querySelector(`.${ROOT_CLASS}`)).to.not.equal(null);
    });

    it('throws when the selector matches nothing', () => {
        expect(() => new PerformanceBandEditor({ container: '#missing' }).mount()).to.throw(
            /cannot find its container/
        );
    });

    it('is idempotent', () => {
        const instance = mount({ bands: createBandSet() });
        instance.mount();

        expect(container.querySelectorAll(`.${ROOT_CLASS}`)).to.have.length(1);
    });

    it('defaults its bands to the host global', () => {
        window._performanceBand = createBandSet();
        editor = new PerformanceBandEditor({ container }).mount();

        expect(editor.bands).to.equal(window._performanceBand);
        expect(rows()).to.have.length(4);
    });

    it('defaults to an empty set when the host global is absent', () => {
        delete window._performanceBand;
        editor = new PerformanceBandEditor({ container }).mount();

        expect(editor.bands).to.deep.equal([]);
    });

    it('renders the empty state and no rows when there are no bands', () => {
        mount({ bands: [] });

        expect(rows()).to.have.length(0);
        expect(container.querySelector('.band-container--empty')?.getAttribute('role')).to.equal('status');
    });
});

describe('form fields', () => {
    it('posts every band as a flat array in document order', () => {
        mount({ bands: createBandSet() });

        expect(values('performance_band_id[]')).to.deep.equal(['b-1', 'b-2', 'b-3', 'b-4']);
        expect(values('performance_band_label[]')).to.deep.equal([
            'Standard Exceeded',
            'Standard Met',
            'Standard Nearly Met',
            'Standard Not Yet Met'
        ]);
        expect(values('performance_band_min_value[]')).to.deep.equal(['90', '75', '50', '0']);
        expect(values('performance_band_color[]')).to.deep.equal([
            'blue-base',
            'green-base',
            'yellow-base',
            'red-base'
        ]);
    });

    it('posts a mastery flag for every band, including the unchecked ones', () => {
        mount({ bands: createBandSet() });

        // A checkbox posts nothing when unchecked, which would shift every
        // following band's flag onto the wrong band — so a hidden field carries
        // it instead.
        expect(values('performance_band_mastery_flg[]')).to.deep.equal(['1', '1', '0', '0']);
        fields('performance_band_mastery_flg[]').forEach((field) => expect(field.type).to.equal('hidden'));
    });

    it('leaves the mastery checkbox itself unnamed so it never posts', () => {
        mount({ bands: createBandSet() });

        container
            .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
            .forEach((box) => expect(box.hasAttribute('name')).to.equal(false));
    });

    it('renames every field with the prefix option', () => {
        mount({ bands: createBandSet(), fieldPrefix: 'scale' });

        expect(fields('scale_label[]')).to.have.length(4);
        expect(fields('performance_band_label[]')).to.have.length(0);
    });

    it('uses a text input with inputmode for the threshold, never type=number', () => {
        mount({ bands: createBandSet() });
        const field = fields('performance_band_min_value[]')[0];

        // type=number rejects the half-typed values this editor tolerates and
        // throws on selectionStart, which preserveFocus depends on.
        expect(field.type).to.equal('text');
        expect(field.getAttribute('inputmode')).to.equal('decimal');
    });
});

describe('editing', () => {
    it('writes a label through without re-rendering the field being typed into', () => {
        const instance = mount({ bands: createBandSet() });
        const field = fields('performance_band_label[]')[0];
        field.focus();
        type(field, 'Exceeded');

        expect(instance.bands[0].label).to.equal('Exceeded');
        expect(document.activeElement).to.equal(field);
        expect(fields('performance_band_label[]')[0]).to.equal(field);
    });

    it('re-sorts the rows when a threshold overtakes another', () => {
        const instance = mount({ bands: createBandSet() });
        type(fields('performance_band_min_value[]')[1], '95');

        expect(values('performance_band_label[]')).to.deep.equal([
            'Standard Met',
            'Standard Exceeded',
            'Standard Nearly Met',
            'Standard Not Yet Met'
        ]);
        expect(instance.bands[0].label).to.equal('Standard Met');
    });

    it('keeps the caret in the field being typed into through a re-sort', () => {
        mount({ bands: createBandSet() });
        const field = fields('performance_band_min_value[]')[1];
        field.focus();
        field.value = '95';
        field.setSelectionRange(2, 2);
        field.dispatchEvent(new Event('input'));

        // The row moved, so the node was detached and reinserted. If this ever
        // fails, something widened a patch or dropped preserveFocus.
        expect(document.activeElement).to.equal(field);
        expect(field.selectionStart).to.equal(2);
        expect(field.value).to.equal('95');
    });

    it('keeps handlers pointing at the right band after a re-sort', () => {
        const instance = mount({ bands: createBandSet() });
        const field = fields('performance_band_min_value[]')[1];
        type(field, '95');

        // The same input is now the first row. Typing a label into that row
        // must edit the band that moved, not whatever is at index 1 now.
        type(fields('performance_band_label[]')[0], 'Renamed');

        expect(instance.bands[0].label).to.equal('Renamed');
        expect(instance.bands[1].label).to.equal('Standard Exceeded');
    });

    it('updates the range readouts when a threshold changes', () => {
        mount({ bands: createBandSet() });
        const readouts = () =>
            Array.from(container.querySelectorAll('.band-container--range')).map((node) =>
                node.textContent?.replace('Covers scores: ', '')
            );

        expect(readouts()).to.deep.equal(['90 – 100', '75 – <90', '50 – <75', '0 – <50']);

        type(fields('performance_band_min_value[]')[1], '80');

        expect(readouts()).to.deep.equal(['90 – 100', '80 – <90', '50 – <80', '0 – <50']);
    });

    it('honours a custom ceiling in the top band readout', () => {
        mount({ bands: [createBand({ min_value: 3 }), createBand({ min_value: 0 })], maxValue: 4 });

        expect(container.querySelector('.band-container--range')?.textContent).to.contain('3 – 4');
    });

    it('writes the mastery flag into the field the host posts', () => {
        const instance = mount({ bands: createBandSet() });
        const checkbox = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[2];
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));

        expect(instance.bands[2].mastery_flg).to.equal(true);
        expect(values('performance_band_mastery_flg[]')[2]).to.equal('1');
        expect(instance.masteryCount).to.equal(3);
    });

    it('reflects a colour change onto the swatch', () => {
        const instance = mount({ bands: createBandSet() });
        const select = container.querySelectorAll<HTMLSelectElement>('select')[0];
        select.value = 'red-base';
        select.dispatchEvent(new Event('change'));

        expect(instance.bands[0].color).to.equal('red-base');
        expect(container.querySelector('.band-swatch')?.getAttribute('data-color')).to.equal('red-base');
        expect(container.querySelector('.band-swatch')?.className).to.contain('red-base');
    });

    it('keeps a colour token that is not in the palette instead of silently re-saving it', () => {
        mount({ bands: [createBand({ color: 'teal-base' })] });
        const select = container.querySelector<HTMLSelectElement>('select');

        expect(select?.value).to.equal('teal-base');
    });
});

describe('adding and removing', () => {
    it('adds a band at the top of the scale and focuses its threshold', () => {
        const instance = mount({ bands: createBandSet() });
        container.querySelectorAll<HTMLButtonElement>('.band-footer-container button')[0].click();

        expect(instance.bands).to.have.length(5);
        expect(instance.bands[0].min_value).to.equal(95);
        expect(document.activeElement).to.equal(fields('performance_band_min_value[]')[0]);
    });

    it('adds the first band into an empty set', () => {
        const instance = mount({ bands: [] });
        instance.addBand();

        expect(instance.bands).to.have.length(1);
        expect(instance.bands[0].min_value).to.equal(0);
        expect(rows()).to.have.length(1);
    });

    it('removes a band from its own button and tells the host to drop tooltips', () => {
        const host = createMockHost();
        const instance = mount({ bands: createBandSet(), host });
        rows()[1].querySelector<HTMLButtonElement>('button[aria-label="Remove band"]')?.click();

        expect(instance.bands).to.have.length(3);
        expect(values('performance_band_label[]')).to.not.contain('Standard Met');
        expect(host.hideTooltips).toHaveBeenCalled();
    });

    it('ignores a remove for a row that is no longer there', () => {
        const instance = mount({ bands: createBandSet() });
        instance.removeBand(-1);

        expect(instance.bands).to.have.length(4);
    });

    it('returns to the empty state when the last band goes', () => {
        const instance = mount({ bands: [createBand()] });
        instance.removeBand(0);

        expect(rows()).to.have.length(0);
        expect(container.querySelector('.band-container--empty')).to.not.equal(null);
    });
});

describe('summary and validation', () => {
    it('reports how many bands there are and how many count as mastery', () => {
        mount({ bands: createBandSet() });

        expect(container.querySelector('.band-footer-container [role="status"]')?.textContent).to.equal(
            '4 bands · 2 counting as mastery'
        );
    });

    it('says "band" in the singular', () => {
        mount({ bands: [createBand()] });

        expect(container.querySelector('.band-footer-container [role="status"]')?.textContent).to.contain('1 band ·');
    });

    it('exposes the same validation the model reports', () => {
        const instance = mount({ bands: [] });

        expect(instance.validate().valid).to.equal(false);
        expect(instance.validate().problems[0].code).to.equal('empty-bands');
    });

    it('validates against a custom ceiling', () => {
        const instance = mount({ bands: [createBand({ min_value: 50 }), createBand({ min_value: 0 })], maxValue: 4 });

        expect(instance.validate().problems.map((problem) => problem.code)).to.contain('band-value-out-of-range');
    });
});

describe('host integration', () => {
    it('lets the host activate the nodes it just inserted', () => {
        const host = createMockHost();
        mount({ bands: createBandSet(), host });

        expect(host.activate).toHaveBeenCalled();
    });

    it('asks the host for its icons and tooltip attributes', () => {
        const host = createMockHost();
        mount({ bands: createBandSet(), host });

        expect(host.icon).toHaveBeenCalledWith('regular', 'fa-trash');
        expect(host.tooltipAttributes).toHaveBeenCalled();
    });

    it('reads a named global when one is given', () => {
        (globalThis as Record<string, unknown>).OtherHost = { icon: vi.fn(() => '') };
        mount({ bands: createBandSet(), hostGlobal: 'OtherHost' });

        expect((globalThis as Record<string, unknown>).OtherHost).to.have.property('icon');

        delete (globalThis as Record<string, unknown>).OtherHost;
    });

    it('offers a supplied colour palette', () => {
        mount({
            bands: [createBand({ color: 'a' })],
            colors: [
                { token: 'a', label: 'A' },
                { token: 'b', label: 'B' }
            ]
        });

        expect(Array.from(container.querySelectorAll('option')).map((option) => option.textContent)).to.deep.equal([
            'A',
            'B'
        ]);
    });
});

describe('destroy', () => {
    it('removes the DOM and stops responding to state changes', () => {
        const instance = mount({ bands: createBandSet() });
        const onChange = vi.fn();
        instance.destroy();

        expect(container.querySelector(`.${ROOT_CLASS}`)).to.equal(null);

        // The subscription is gone, so a later mutation renders nothing and
        // notifies nobody.
        instance.addBand();

        expect(onChange).to.not.toHaveBeenCalled();
        expect(container.querySelector(`.${ROOT_CLASS}`)).to.equal(null);
    });

    it('can be called twice', () => {
        const instance = mount({ bands: createBandSet() });
        instance.destroy();

        expect(() => instance.destroy()).to.not.throw();
    });

    it('stops dispatching the change event', () => {
        const instance = mount({ bands: createBandSet() });
        const listener = vi.fn();
        document.addEventListener(CHANGE_EVENT, listener);
        instance.destroy();
        instance.addBand();

        expect(listener).to.not.toHaveBeenCalled();

        document.removeEventListener(CHANGE_EVENT, listener);
    });
});
