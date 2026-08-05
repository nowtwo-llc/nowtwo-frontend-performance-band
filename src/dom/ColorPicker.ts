import type { BandColor, HostBridge } from '../types';
import { el, hostMarkup, uniqueId, VISUALLY_HIDDEN_CLASS } from './element';
import { applySwatch, isCustomColor, SWATCH_CLASS } from './swatch';

export const PICKER_CLASS = 'band-color-picker';
export const POPUP_CLASS = 'band-color-picker--popup';
export const OPTION_CLASS = 'band-color-option';

/**
 * Swatches per row. The grid is a fixed number of columns so that Up and Down
 * can move by a whole row — without a known column count the popup would be a
 * grid to the eye and a flat list to the keyboard.
 */
const COLUMNS = 4;

export interface ColorPickerConfig {
    value: string;
    /** Name of the hidden input that actually posts. */
    name: string;
    colors: BandColor[];
    allowCustom: boolean;
    /** Accessible name for the control, e.g. 'Band colour'. */
    label: string;
    host: HostBridge;
    onChange(value: string): void;
}

interface Option {
    value: string;
    label: string;
    node: HTMLElement;
}

/**
 * A colour picker: a trigger button showing the current colour, opening a grid
 * of swatches.
 *
 * This is a **listbox popup**, implemented rather than borrowed — the library
 * has no runtime dependencies and this is not a reason to acquire one. A native
 * `<select>` would come with all of this for free, so the custom control has to
 * earn its place by being just as operable:
 *
 * - The trigger is a real `<button>` with `aria-haspopup="listbox"` and
 *   `aria-expanded`.
 * - The popup is `role="listbox"`; the swatches are `role="option"` with
 *   `aria-selected`. Focus stays on the listbox and moves virtually through
 *   `aria-activedescendant`, which is what lets a grid of divs be navigable.
 * - Arrows move by one, Up/Down by a row, Home/End jump to the ends, Enter and
 *   Space select, Escape closes and returns focus to the trigger.
 *
 * The value posted is a **hidden input**, not the control, for the same reason
 * the mastery flag is: a custom widget is not a form element, and the wire
 * format must not depend on one.
 */
export class ColorPicker {
    readonly element: HTMLElement;

    private readonly config: ColorPickerConfig;

    private readonly field: HTMLInputElement;

    private readonly trigger: HTMLButtonElement;

    private readonly triggerSwatch: HTMLElement;

    private readonly triggerText: HTMLElement;

    private readonly listbox: HTMLElement;

    private readonly customInput: HTMLInputElement | null = null;

    private readonly options: Option[] = [];

    private readonly listboxId: string;

    private activeIndex = 0;

    private value: string;

    constructor(config: ColorPickerConfig) {
        this.config = config;
        this.value = config.value;
        this.listboxId = uniqueId('nt-band-colors');

        this.field = el('input', { type: 'hidden', name: config.name, value: config.value });

        this.triggerSwatch = el('span', { class: SWATCH_CLASS, 'aria-hidden': 'true' });
        this.triggerText = el('span', { class: 'band-color-picker--value' });

        this.trigger = el(
            'button',
            {
                type: 'button',
                class: 'band-color-picker--trigger button',
                'aria-haspopup': 'listbox',
                'aria-expanded': 'false',
                ...config.host.tooltipAttributes()
            },
            [
                // The button's own content is its accessible name, so the
                // purpose is stated here rather than through a separate
                // <label>, which cannot be associated with a button anyway.
                el('span', { class: VISUALLY_HIDDEN_CLASS }, [`${config.label}: `]),
                this.triggerSwatch,
                this.triggerText,
                hostMarkup(config.host.icon('regular', 'fa-caret-down'), 'band-color-picker--caret')
            ]
        );
        this.trigger.addEventListener('click', () => this.toggle());
        this.trigger.addEventListener('keydown', (event: KeyboardEvent) => this.onTriggerKeydown(event));

        this.listbox = el('div', {
            id: this.listboxId,
            class: 'band-color-picker--options',
            role: 'listbox',
            tabindex: -1,
            'aria-label': config.label
        });
        this.listbox.addEventListener('keydown', (event: KeyboardEvent) => this.onListboxKeydown(event));
        // Keeps focus on the listbox through the click, so selecting a swatch
        // does not blur the control and close the popup before the click lands.
        this.listbox.addEventListener('mousedown', (event: MouseEvent) => event.preventDefault());

        const popup = el('div', { class: POPUP_CLASS, hidden: true }, [this.listbox]);

        if (config.allowCustom) {
            const customId = uniqueId('nt-band-custom');
            this.customInput = el('input', { type: 'color', id: customId, class: 'band-color-picker--custom-input' });
            this.customInput.addEventListener('input', () => this.select(this.customInput!.value, false));
            this.customInput.addEventListener('change', () => this.select(this.customInput!.value, true));

            popup.append(
                el('div', { class: 'band-color-picker--custom' }, [
                    el('label', { for: customId }, ['Custom colour']),
                    this.customInput
                ])
            );
        }

        this.element = el('div', { class: PICKER_CLASS }, [this.field, this.trigger, popup]);
        this.element.addEventListener('focusout', (event: FocusEvent) => this.handleFocusOut(event.relatedTarget));

        config.colors.forEach((color) => this.addOption(color));
        this.setValue(config.value);
    }

    private addOption(color: BandColor): Option {
        const node = el(
            'div',
            {
                id: uniqueId('nt-band-color-option'),
                class: OPTION_CLASS,
                role: 'option',
                'aria-selected': 'false',
                title: color.label
            },
            [
                el('span', { class: SWATCH_CLASS, 'aria-hidden': 'true' }),
                el('span', { class: VISUALLY_HIDDEN_CLASS }, [color.label])
            ]
        );

        applySwatch(node.firstElementChild as HTMLElement, color.token);
        node.addEventListener('click', () => this.select(color.token, true));

        const option: Option = { value: color.token, label: color.label, node };
        this.options.push(option);
        this.listbox.append(node);

        return option;
    }

    /**
     * Makes sure a value has an option, so a band loaded with a token outside
     * the palette keeps it rather than being silently re-saved as whatever
     * happened to be selected instead.
     */
    private ensureOption(value: string): void {
        if (!value || isCustomColor(value) || this.options.some((option) => option.value === value)) {
            return;
        }

        this.addOption({ token: value, label: value });
    }

    /** The label to show on the trigger for a value. */
    private labelFor(value: string): string {
        if (isCustomColor(value)) {
            return value;
        }

        return this.options.find((option) => option.value === value)?.label ?? value;
    }

    /** Reflects a value onto the control. Never calls `onChange`. */
    setValue(value: string): void {
        this.ensureOption(value);
        this.value = value;
        this.field.value = value;

        applySwatch(this.triggerSwatch, value);
        this.triggerText.textContent = this.labelFor(value);

        this.options.forEach((option, index) => {
            const selected = option.value === value;
            option.node.setAttribute('aria-selected', selected ? 'true' : 'false');

            if (selected) {
                this.activeIndex = index;
            }
        });

        if (this.customInput && isCustomColor(value)) {
            this.customInput.value = value;
        }
    }

    private select(value: string, close: boolean): void {
        this.setValue(value);
        this.config.onChange(value);

        if (close) {
            this.close();
            this.trigger.focus();
        }
    }

    private toggle(): void {
        if (this.trigger.getAttribute('aria-expanded') === 'true') {
            this.close();

            return;
        }

        this.open();
    }

    open(): void {
        this.trigger.setAttribute('aria-expanded', 'true');
        this.element.querySelector(`.${POPUP_CLASS}`)?.removeAttribute('hidden');

        this.setActive(this.options.findIndex((option) => option.value === this.value));
        this.listbox.focus();
    }

    close(): void {
        this.trigger.setAttribute('aria-expanded', 'false');
        this.element.querySelector(`.${POPUP_CLASS}`)?.setAttribute('hidden', '');
        this.listbox.removeAttribute('aria-activedescendant');
    }

    /** True while the popup is showing. */
    get isOpen(): boolean {
        return this.trigger.getAttribute('aria-expanded') === 'true';
    }

    /**
     * Closes when focus leaves the control entirely.
     *
     * This is why there is no document-level click listener: `focusout` already
     * covers clicking away, tabbing away and focusing another picker, and it
     * leaves nothing to unregister when a row is thrown away.
     */
    handleFocusOut(next: EventTarget | null): void {
        if (next instanceof Node && this.element.contains(next)) {
            return;
        }

        this.close();
    }

    private setActive(index: number): void {
        if (!this.options.length) {
            return;
        }

        this.activeIndex = Math.min(Math.max(index, 0), this.options.length - 1);
        const option = this.options[this.activeIndex];

        this.listbox.setAttribute('aria-activedescendant', option.node.id);
        this.options.forEach((current) => current.node.classList.remove('is-active'));
        option.node.classList.add('is-active');
    }

    private onTriggerKeydown(event: KeyboardEvent): void {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return;
        }

        // Otherwise the arrow keys scroll the page instead of opening the
        // control they are aimed at.
        event.preventDefault();
        this.open();
    }

    private onListboxKeydown(event: KeyboardEvent): void {
        const moves: Record<string, number | undefined> = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -COLUMNS,
            ArrowDown: COLUMNS
        };

        const move = moves[event.key];
        if (move !== undefined) {
            event.preventDefault();
            this.setActive(this.activeIndex + move);

            return;
        }

        switch (event.key) {
            case 'Home':
                event.preventDefault();
                this.setActive(0);
                break;
            case 'End':
                event.preventDefault();
                this.setActive(this.options.length - 1);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.select(this.options[this.activeIndex].value, true);
                break;
            case 'Escape':
                event.preventDefault();
                this.close();
                this.trigger.focus();
                break;
            default:
                break;
        }
    }
}
