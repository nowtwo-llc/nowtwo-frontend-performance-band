import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ColorPicker } from '../../src/dom/ColorPicker';
import type { BandColor } from '../../src/types';
import { createMockHost } from '../setup';

const PALETTE: BandColor[] = [
    { token: 'blue-base', label: 'Blue' },
    { token: 'green-base', label: 'Green' },
    { token: 'yellow-base', label: 'Yellow' },
    { token: 'red-base', label: 'Red' },
    // Six, not four, so that Up/Down have a second row to move to — the grid
    // is four columns wide.
    { token: 'purple-base', label: 'Purple' },
    { token: 'grey-base', label: 'Grey' }
];

let picker: ColorPicker;
let onChange: Mock<(value: string) => void>;

function build(overrides: Partial<ConstructorParameters<typeof ColorPicker>[0]> = {}): ColorPicker {
    onChange = vi.fn<(value: string) => void>();
    picker = new ColorPicker({
        value: 'blue-base',
        name: 'performance_band_color[]',
        colors: PALETTE,
        allowCustom: false,
        label: 'Band colour',
        host: createMockHost(),
        onChange,
        ...overrides
    });

    document.body.append(picker.element);

    return picker;
}

const trigger = (): HTMLButtonElement => picker.element.querySelector('.band-color-picker--trigger')!;
const listbox = (): HTMLElement => picker.element.querySelector('[role="listbox"]')!;
const popup = (): HTMLElement => picker.element.querySelector('.band-color-picker--popup')!;
const options = (): HTMLElement[] => Array.from(picker.element.querySelectorAll('[role="option"]'));
const field = (): HTMLInputElement => picker.element.querySelector('input[type="hidden"]')!;
const active = (): string | null => listbox().getAttribute('aria-activedescendant');
const activeIndex = (): number => options().findIndex((option) => option.id === active());

function key(target: HTMLElement, k: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

beforeEach(() => {
    document.body.replaceChildren();
});

afterEach(() => {
    picker.element.remove();
});

describe('the posted value', () => {
    it('lives in a hidden input, not the control', () => {
        build();

        // A custom widget is not a form element, so the wire format must not
        // depend on one — the same reason the mastery flag posts from a hidden
        // input.
        expect(field().type).to.equal('hidden');
        expect(field().name).to.equal('performance_band_color[]');
        expect(field().value).to.equal('blue-base');
    });

    it('follows the selection', () => {
        build();
        trigger().click();
        options()[3].click();

        expect(field().value).to.equal('red-base');
        expect(onChange).toHaveBeenCalledWith('red-base');
    });

    it('is reflected by setValue without reporting a change', () => {
        build();
        picker.setValue('green-base');

        expect(field().value).to.equal('green-base');
        expect(trigger().textContent).to.contain('Green');
        expect(onChange).to.not.toHaveBeenCalled();
    });
});

describe('the trigger', () => {
    it('names itself and shows the current colour', () => {
        build();

        expect(trigger().textContent).to.contain('Band colour');
        expect(trigger().textContent).to.contain('Blue');
        expect(trigger().getAttribute('aria-haspopup')).to.equal('listbox');
        expect(trigger().getAttribute('aria-expanded')).to.equal('false');
    });

    it('hides the decorative swatch from assistive tech', () => {
        build();

        expect(trigger().querySelector('.band-swatch')?.getAttribute('aria-hidden')).to.equal('true');
    });

    it('opens and closes on click', () => {
        build();
        trigger().click();

        expect(picker.isOpen).to.equal(true);
        expect(trigger().getAttribute('aria-expanded')).to.equal('true');
        expect(popup().hasAttribute('hidden')).to.equal(false);

        trigger().click();

        expect(picker.isOpen).to.equal(false);
        expect(popup().hasAttribute('hidden')).to.equal(true);
    });

    it('opens on the arrow keys and stops them scrolling the page', () => {
        build();
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
        trigger().dispatchEvent(event);

        expect(picker.isOpen).to.equal(true);
        expect(event.defaultPrevented).to.equal(true);
    });

    it('ignores keys that are not meant to open it', () => {
        build();
        key(trigger(), 'a');

        expect(picker.isOpen).to.equal(false);
    });
});

describe('the listbox', () => {
    it('states its role and marks the selected option', () => {
        build();
        trigger().click();

        expect(options()).to.have.length(6);
        expect(options()[0].getAttribute('aria-selected')).to.equal('true');
        expect(options()[1].getAttribute('aria-selected')).to.equal('false');
    });

    it('takes focus on open and starts on the selected option', () => {
        build({ value: 'yellow-base' });
        trigger().click();

        expect(document.activeElement).to.equal(listbox());
        expect(activeIndex()).to.equal(2);
    });

    it('moves one swatch at a time with left and right', () => {
        build();
        trigger().click();

        key(listbox(), 'ArrowRight');
        expect(activeIndex()).to.equal(1);

        key(listbox(), 'ArrowLeft');
        expect(activeIndex()).to.equal(0);
    });

    it('moves a whole row with up and down, because it is a grid', () => {
        build();
        trigger().click();

        key(listbox(), 'ArrowDown');
        expect(activeIndex()).to.equal(4);

        key(listbox(), 'ArrowUp');
        expect(activeIndex()).to.equal(0);
    });

    it('clamps at both ends rather than wrapping', () => {
        build();
        trigger().click();

        key(listbox(), 'ArrowLeft');
        expect(activeIndex()).to.equal(0);

        key(listbox(), 'End');
        key(listbox(), 'ArrowDown');
        expect(activeIndex()).to.equal(5);
    });

    it('jumps to either end with Home and End', () => {
        build({ value: 'green-base' });
        trigger().click();

        key(listbox(), 'End');
        expect(activeIndex()).to.equal(5);

        key(listbox(), 'Home');
        expect(activeIndex()).to.equal(0);
    });

    it('selects with Enter, closing and returning focus to the trigger', () => {
        build();
        trigger().click();
        key(listbox(), 'ArrowRight');
        key(listbox(), 'Enter');

        expect(onChange).toHaveBeenCalledWith('green-base');
        expect(picker.isOpen).to.equal(false);
        expect(document.activeElement).to.equal(trigger());
    });

    it('selects with Space', () => {
        build();
        trigger().click();
        key(listbox(), 'End');
        key(listbox(), ' ');

        expect(onChange).toHaveBeenCalledWith('grey-base');
    });

    it('closes on Escape without selecting, and returns focus', () => {
        build();
        trigger().click();
        key(listbox(), 'ArrowRight');
        key(listbox(), 'Escape');

        expect(onChange).to.not.toHaveBeenCalled();
        expect(picker.isOpen).to.equal(false);
        expect(document.activeElement).to.equal(trigger());
    });

    it('ignores keys it has no use for', () => {
        build();
        trigger().click();
        key(listbox(), 'q');

        expect(picker.isOpen).to.equal(true);
        expect(activeIndex()).to.equal(0);
    });

    it('keeps focus through a click so the selection lands', () => {
        build();
        trigger().click();
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        listbox().dispatchEvent(event);

        // Without this the listbox blurs on mousedown, focusout closes the
        // popup, and the click never reaches the swatch.
        expect(event.defaultPrevented).to.equal(true);
    });

    it('drops aria-activedescendant when it closes', () => {
        build();
        trigger().click();
        picker.close();

        expect(active()).to.equal(null);
    });
});

describe('closing on focus loss', () => {
    it('closes when focus leaves the control entirely', () => {
        build();
        const outside = document.createElement('button');
        document.body.append(outside);
        trigger().click();

        picker.element.dispatchEvent(new FocusEvent('focusout', { relatedTarget: outside, bubbles: true }));

        expect(picker.isOpen).to.equal(false);
    });

    it('closes when focus goes nowhere at all', () => {
        build();
        trigger().click();

        picker.element.dispatchEvent(new FocusEvent('focusout', { relatedTarget: null, bubbles: true }));

        expect(picker.isOpen).to.equal(false);
    });

    it('stays open while focus moves within the control', () => {
        build({ allowCustom: true });
        trigger().click();
        const custom = picker.element.querySelector<HTMLInputElement>('input[type="color"]')!;

        picker.element.dispatchEvent(new FocusEvent('focusout', { relatedTarget: custom, bubbles: true }));

        expect(picker.isOpen).to.equal(true);
    });
});

describe('values outside the palette', () => {
    it('keeps an unknown token by giving it an option of its own', () => {
        build({ value: 'teal-base' });

        expect(field().value).to.equal('teal-base');
        expect(options()).to.have.length(7);
        expect(options()[6].getAttribute('aria-selected')).to.equal('true');
        expect(trigger().textContent).to.contain('teal-base');
    });

    it('does not add a second option when the same unknown token is set again', () => {
        build({ value: 'teal-base' });
        picker.setValue('teal-base');

        expect(options()).to.have.length(7);
    });

    it('tolerates an empty colour', () => {
        build({ value: '' });

        expect(options()).to.have.length(6);
        expect(field().value).to.equal('');
    });
});

describe('custom colours', () => {
    it('offers no custom input unless the host opts in', () => {
        build();

        expect(picker.element.querySelector('input[type="color"]')).to.equal(null);
    });

    it('gives the custom input a real label', () => {
        build({ allowCustom: true });
        const custom = picker.element.querySelector<HTMLInputElement>('input[type="color"]')!;

        expect(picker.element.querySelector(`label[for="${custom.id}"]`)?.textContent).to.equal('Custom colour');
    });

    it('reports each intermediate value but only closes on commit', () => {
        build({ allowCustom: true });
        trigger().click();
        const custom = picker.element.querySelector<HTMLInputElement>('input[type="color"]')!;

        custom.value = '#3a6ea5';
        custom.dispatchEvent(new Event('input'));

        // Dragging around a colour wheel fires input continuously; closing on
        // each one would shut the picker under the pointer.
        expect(onChange).toHaveBeenCalledWith('#3a6ea5');
        expect(picker.isOpen).to.equal(true);

        custom.dispatchEvent(new Event('change'));

        expect(picker.isOpen).to.equal(false);
    });

    it('paints a hex value inline, since it has no host class to hang on', () => {
        build({ allowCustom: true, value: '#3a6ea5' });
        const swatch = trigger().querySelector<HTMLElement>('.band-swatch')!;

        expect(swatch.style.background).to.not.equal('');
        expect(swatch.hasAttribute('data-color')).to.equal(false);
        expect(trigger().textContent).to.contain('#3a6ea5');
    });

    it('clears the inline paint when it goes back to a token', () => {
        build({ allowCustom: true, value: '#3a6ea5' });
        picker.setValue('green-base');
        const swatch = trigger().querySelector<HTMLElement>('.band-swatch')!;

        // One node is reused as the value changes, so a leftover inline
        // background would show the old colour under the new class.
        expect(swatch.style.background).to.equal('');
        expect(swatch.getAttribute('data-color')).to.equal('green-base');
        expect(swatch.className).to.contain('green-base');
    });

    it('does not treat a hex value as a palette token', () => {
        build({ allowCustom: true, value: '#3a6ea5' });

        expect(options()).to.have.length(6);
        expect(options().every((option) => option.getAttribute('aria-selected') === 'false')).to.equal(true);
    });
});
