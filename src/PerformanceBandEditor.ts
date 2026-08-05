import { BandRow } from './dom/BandRow';
import { el, preserveFocus } from './dom/element';
import { buildEmptyState, buildFooter, buildHeader, type Footer } from './dom/layout';
import { createGlobalHost } from './host/globalHost';
import { BandState, type BandChange } from './model/BandState';
import { DEFAULT_COLORS } from './model/factories';
import { bandRange, DEFAULT_MAX_VALUE } from './model/ranges';
import { validateBands } from './model/validate';
import type { Band, BandColor, HostBridge, PerformanceBandEditorOptions, ValidationResult } from './types';

export type {
    Band,
    BandColor,
    BandRange,
    BandValue,
    HostBridge,
    MasteryValue,
    PerformanceBandEditorOptions,
    ProblemCode,
    ValidationProblem,
    ValidationResult
} from './types';

export const DEFAULT_CONTAINER = '#nt-performance-band-app';
export const DEFAULT_FIELD_PREFIX = 'performance_band';
export const ROOT_CLASS = 'nt-performance-band';

/** Dispatched on the editor's root element after every change. */
export const CHANGE_EVENT = 'nt-performance-band:change';

/**
 * A performance band editor.
 *
 * Bands are labelled floors on a score scale: a score falls in the highest band
 * whose minimum it reaches. The editor renders form inputs into a container
 * inside the host's own form and has no save of its own — the host posts the
 * fields. See `dom/fieldNames.ts` for that contract.
 *
 * ```ts
 * const editor = new PerformanceBandEditor({ container: '#nt-performance-band-app' });
 * editor.mount();
 * ```
 *
 * There is no drag-to-reorder here and that is deliberate: a band's position is
 * derived from its threshold, not chosen, so the list re-sorts itself as the
 * thresholds are edited. Dragging a row would only fight the next keystroke.
 */
export class PerformanceBandEditor {
    private readonly options: PerformanceBandEditorOptions;

    private readonly host: HostBridge;

    private readonly state: BandState;

    private readonly prefix: string;

    private readonly maxValue: number;

    private readonly colors: BandColor[];

    private container: HTMLElement | null = null;

    private root: HTMLElement | null = null;

    private list: HTMLElement | null = null;

    private footer: Footer | null = null;

    private rows: BandRow[] = [];

    /**
     * Maps a band in the model to the row rendering it, so a re-sort can move
     * the existing rows instead of rebuilding them. Weak so that removed bands
     * do not pin their rows.
     */
    private readonly rowsByBand = new WeakMap<Band, BandRow>();

    private unsubscribe: (() => void) | null = null;

    constructor(options: PerformanceBandEditorOptions = {}) {
        this.options = options;
        this.host = options.host ?? createGlobalHost(options.hostGlobal);
        this.prefix = options.fieldPrefix ?? DEFAULT_FIELD_PREFIX;
        this.maxValue = options.maxValue ?? DEFAULT_MAX_VALUE;
        this.colors = options.colors?.length ? options.colors : DEFAULT_COLORS;
        this.state = new BandState(options.bands ?? window._performanceBand ?? [], this.maxValue, this.colors);
    }

    /** The live band set. Mutations made through the editor land on this array. */
    get bands(): Band[] {
        return this.state.all();
    }

    /** How many bands are flagged as counting toward mastery. */
    get masteryCount(): number {
        return this.state.masteryTotal();
    }

    /**
     * Reports the problems that would make this band set unusable once saved.
     *
     * The editor never blocks these itself — half-finished state is normal while
     * someone is still working. Call this before submitting and decide what to
     * do with the result.
     */
    validate(): ValidationResult {
        return validateBands(this.state.all(), this.maxValue);
    }

    mount(): this {
        if (this.root) {
            return this;
        }

        this.container = this.resolveContainer();
        this.root = el('div', { class: ROOT_CLASS });

        // role=list pairs with role=listitem on each row, so assistive tech
        // reports how many bands there are and which one you are on. The rows
        // are flex divs, so the semantics have to be stated explicitly.
        this.list = el('div', { class: 'band-list', role: 'list', 'aria-label': 'Performance bands' });
        this.footer = buildFooter(this.host, () => this.addBand());

        this.root.append(buildHeader(), this.list, this.footer.element);
        this.container.append(this.root);

        this.renderList();

        this.unsubscribe = this.state.subscribe((change) => this.apply(change));

        return this;
    }

    /** Removes the editor's DOM and every listener it registered. */
    destroy(): void {
        this.unsubscribe?.();
        this.root?.remove();

        this.unsubscribe = null;
        this.root = null;
        this.list = null;
        this.footer = null;
        this.rows = [];
        this.container = null;
    }

    private resolveContainer(): HTMLElement {
        const target = this.options.container ?? DEFAULT_CONTAINER;

        if (target instanceof HTMLElement) {
            return target;
        }

        const found = document.querySelector<HTMLElement>(target);
        if (!found) {
            throw new Error(`PerformanceBandEditor cannot find its container element: ${target}`);
        }

        return found;
    }

    /**
     * Routes a state change to the narrowest render that covers it. Anything
     * broader than necessary would rebuild inputs out from under the caret.
     */
    private apply(change: BandChange): void {
        switch (change.type) {
            case 'list':
                this.renderList();
                break;
            case 'order':
                this.syncOrder();
                this.refresh();
                break;
            case 'values':
                this.refresh();
                break;
            case 'color':
                this.rows[change.index]?.updateColor();
                break;
            case 'mastery':
                this.rows[change.index]?.updateMastery();
                this.refresh();
                break;
            case 'text':
                // Renders nothing: the field already shows what was typed.
                break;
            default:
                break;
        }

        this.notifyChange();
    }

    /**
     * Tells the host something changed, both ways: the `onChange` option for
     * module consumers and a DOM event for `<script>`-tag pages that never see
     * the instance.
     *
     * Fires on every keystroke. Debouncing belongs to the host, which is the
     * only side that knows what its own UI needs.
     */
    private notifyChange(): void {
        this.options.onChange?.(this.state.all(), this);

        this.root?.dispatchEvent(
            new CustomEvent(CHANGE_EVENT, {
                bubbles: true,
                detail: { bands: this.state.all(), masteryCount: this.state.masteryTotal() }
            })
        );
    }

    private renderList(): void {
        if (!this.list) {
            return;
        }

        this.list.replaceChildren();
        this.rows = [];

        if (!this.state.count()) {
            this.list.append(buildEmptyState());
            this.refresh();
            this.activate();

            return;
        }

        this.state.all().forEach((band) => {
            const row = new BandRow({
                band,
                prefix: this.prefix,
                colors: this.colors,
                host: this.host,
                callbacks: {
                    onRemove: () => this.removeBand(this.indexOf(row)),
                    onLabelInput: (value) => this.state.setLabel(this.indexOf(row), value),
                    onValueInput: (value) => this.state.setValue(this.indexOf(row), value),
                    onColorChange: (token) => this.state.setColor(this.indexOf(row), token),
                    onMasteryChange: (mastery) => this.state.setMastery(this.indexOf(row), mastery)
                }
            });

            this.rowsByBand.set(band, row);
            this.rows.push(row);
            this.list?.append(row.element);
        });

        this.refresh();
        this.activate();
    }

    /**
     * Reorders the existing rows to match the model after a threshold moved one
     * past another.
     *
     * `append` moves a node that is already a child, so the field being typed
     * into travels with its own value rather than having a neighbour's value
     * written over it. `preserveFocus` puts the caret back, because that move
     * detaches and reinserts the node.
     *
     * `this.rows` is re-derived in the same pass: handlers resolve their band
     * through `indexOf(row)`, so a stale array would address the wrong band on
     * the very next keystroke.
     */
    private syncOrder(): void {
        if (!this.list) {
            return;
        }

        const reordered = this.state
            .all()
            .map((band) => this.rowsByBand.get(band))
            .filter((row): row is BandRow => Boolean(row));

        this.rows = reordered;

        preserveFocus(() => {
            reordered.forEach((row) => this.list?.append(row.element));
        });
    }

    /**
     * A row's position is looked up when a handler fires, not captured when it
     * is wired. Rows outlive their original index — every threshold edit can
     * re-sort the set — so a captured index would address the wrong band.
     */
    private indexOf(row: BandRow): number {
        return this.rows.indexOf(row);
    }

    /**
     * Refreshes everything derived from the thresholds. A band's upper bound is
     * the threshold of the band above it, so one edit changes two readouts and
     * it is cheaper to redo them all than to work out which.
     */
    private refresh(): void {
        this.rows.forEach((row, index) => row.updateRange(bandRange(this.state.all(), index, this.maxValue)));
        this.footer?.setSummary(this.state.count(), this.state.masteryTotal());
    }

    /** Lets the host wire up tooltips on nodes that were just inserted. */
    private activate(): void {
        if (this.root) {
            this.host.activate(this.root);
        }
    }

    /**
     * Adds a band and puts the caret in its threshold field.
     *
     * The threshold is what decides where the band lands, and a new band is
     * added at the top of the scale by default — so it is the one field that
     * always needs attention next.
     */
    addBand(): Band {
        const band = this.state.addBand();
        this.rowsByBand.get(band)?.focusValue();

        return band;
    }

    /** Removes a band, as its own remove button does. */
    removeBand(index: number): void {
        if (index < 0) {
            return;
        }

        // The removed row owned an open tooltip; without this it is orphaned on
        // screen with nothing under it.
        this.host.hideTooltips();
        this.state.removeBand(index);
    }
}
