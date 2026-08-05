import type { Band, BandColor, BandRange, HostBridge } from '../types';
import { masteryFieldValue, toMastery } from '../model/ranges';
import { ColorPicker } from './ColorPicker';
import { el, hiddenLabel, hostMarkup, uniqueId, VISUALLY_HIDDEN_CLASS } from './element';
import { bandFields } from './fieldNames';

export interface BandRowCallbacks {
    onRemove(): void;
    onLabelInput(value: string): void;
    onValueInput(value: string): void;
    onColorChange(token: string): void;
    onMasteryChange(mastery: boolean): void;
}

export interface BandRowConfig {
    band: Band;
    prefix: string;
    colors: BandColor[];
    allowCustomColor: boolean;
    host: HostBridge;
    callbacks: BandRowCallbacks;
}

/**
 * One band: its colour, label, threshold, the span it covers and whether it
 * counts as mastery.
 *
 * The row is built once and then patched. It never rebuilds its own label or
 * threshold inputs, because those are what someone is usually typing into —
 * only the range readout, the swatch and the mastery field are updated, and
 * each of those has a method that touches nothing else.
 *
 * The row deliberately does not know its own index. Every field name is a flat
 * `[]` array paired by document order, so a re-sort moves the row and the wire
 * format follows with no renaming at all.
 */
export class BandRow {
    readonly element: HTMLElement;

    readonly band: Band;

    private readonly host: HostBridge;

    private readonly callbacks: BandRowCallbacks;

    private readonly colorPicker: ColorPicker;

    private readonly labelField: HTMLInputElement;

    private readonly valueField: HTMLInputElement;

    private readonly rangeReadout: HTMLElement;

    private readonly masteryCheckbox: HTMLInputElement;

    /**
     * What the host actually posts for the mastery flag.
     *
     * An unchecked checkbox posts nothing, which would shorten the
     * `…_mastery_flg[]` array and shift every following band's flag onto the
     * wrong band. This always posts, and always as `1` or `0`.
     */
    private readonly masteryField: HTMLInputElement;

    constructor({ band, prefix, colors, allowCustomColor, host, callbacks }: BandRowConfig) {
        this.band = band;
        this.host = host;
        this.callbacks = callbacks;

        const fields = bandFields(prefix);

        const labelId = uniqueId('nt-band-label');
        const valueId = uniqueId('nt-band-value');
        const masteryId = uniqueId('nt-band-mastery');

        this.colorPicker = new ColorPicker({
            value: band.color,
            name: fields.color,
            colors,
            allowCustom: allowCustomColor,
            label: 'Band colour',
            host,
            onChange: (value) => this.callbacks.onColorChange(value)
        });

        this.labelField = el('input', {
            type: 'text',
            id: labelId,
            class: 'input',
            name: fields.label,
            placeholder: 'Band label',
            value: band.label
        });
        this.labelField.addEventListener('input', () => this.callbacks.onLabelInput(this.labelField.value));

        // Deliberately type="text" with inputmode, not type="number". A number
        // input rejects the half-typed states this editor tolerates ('-', '1.')
        // and throws on selectionStart, which preserveFocus depends on — and
        // preserveFocus is what keeps the caret in place through the re-sort
        // that every keystroke here can trigger.
        this.valueField = el('input', {
            type: 'text',
            id: valueId,
            inputmode: 'decimal',
            class: 'input',
            name: fields.minValue,
            placeholder: 'Minimum',
            value: String(band.min_value)
        });
        this.valueField.addEventListener('input', () => this.callbacks.onValueInput(this.valueField.value));

        this.rangeReadout = el('span');

        this.masteryField = el('input', {
            type: 'hidden',
            name: fields.masteryFlag,
            value: masteryFieldValue(band.mastery_flg)
        });

        this.masteryCheckbox = el('input', {
            type: 'checkbox',
            id: masteryId,
            checked: toMastery(band.mastery_flg)
        });
        this.masteryCheckbox.checked = toMastery(band.mastery_flg);
        this.masteryCheckbox.addEventListener('change', () =>
            this.callbacks.onMasteryChange(this.masteryCheckbox.checked)
        );

        this.element = this.build(el('input', { type: 'hidden', name: fields.id, value: band.id }), {
            labelId,
            valueId,
            masteryId
        });
    }

    private build(
        idField: HTMLInputElement,
        ids: { labelId: string; valueId: string; masteryId: string }
    ): HTMLElement {
        const removeButton = this.iconButton('fa-trash', 'Remove band', () => this.callbacks.onRemove());

        return el('div', { class: 'band-container', role: 'listitem' }, [
            idField,
            // The picker names itself through its trigger's own content, so
            // there is no separate <label> here — a label cannot be associated
            // with a button anyway.
            el('div', { class: 'band-container--color' }, [this.colorPicker.element]),
            el('div', { class: 'band-container--label' }, [hiddenLabel(ids.labelId, 'Band label'), this.labelField]),
            el('div', { class: 'band-container--value' }, [hiddenLabel(ids.valueId, 'Minimum value'), this.valueField]),
            el('div', { class: 'band-container--range' }, [
                el('span', { class: VISUALLY_HIDDEN_CLASS }, ['Covers scores: ']),
                this.rangeReadout
            ]),
            el('div', { class: 'band-container--mastery' }, [
                this.masteryField,
                this.masteryCheckbox,
                // A visible label here, unlike the rest of the row: a lone
                // checkbox with no adjacent text is the one control whose
                // meaning is not obvious from the column header once the row
                // scrolls away from it.
                el('label', { for: ids.masteryId, class: 'band-mastery-label' }, ['Mastery'])
            ]),
            el('div', { class: 'band-container--actions' }, [removeButton])
        ]);
    }

    /**
     * `title` is set unconditionally so the control is labelled even with no
     * host at all; the bridge only adds whatever upgrades that to a styled
     * tooltip.
     */
    private iconButton(icon: string, title: string, onClick: () => void): HTMLButtonElement {
        const button = el(
            'button',
            {
                type: 'button',
                class: 'button button--link',
                title,
                // These buttons have no text, only an icon whose markup comes
                // from the host — so `title` alone is not a reliable accessible
                // name. `aria-label` is.
                'aria-label': title,
                ...this.host.tooltipAttributes()
            },
            [hostMarkup(this.host.icon('regular', icon))]
        );
        button.addEventListener('click', onClick);

        return button;
    }

    /**
     * Updates just the range readout. Safe to call on every keystroke.
     *
     * The upper bound is exclusive for every band but the highest, which is why
     * it reads `75 – <90` rather than pretending the scale is whole numbers.
     */
    updateRange(range: BandRange): void {
        this.rangeReadout.textContent = range.isTop ? `${range.from} – ${range.to}` : `${range.from} – <${range.to}`;
    }

    /** Reflects the band's colour onto the picker. */
    updateColor(): void {
        this.colorPicker.setValue(this.band.color);
    }

    /** Writes the mastery flag into the field the host actually posts. */
    updateMastery(): void {
        this.masteryField.value = masteryFieldValue(this.band.mastery_flg);
        this.masteryCheckbox.checked = toMastery(this.band.mastery_flg);
    }

    /** Puts focus on the threshold field, used when a new band is added. */
    focusValue(): void {
        this.valueField.focus();
    }
}
