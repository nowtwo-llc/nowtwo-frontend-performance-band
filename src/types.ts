/**
 * The performance band data model, plus the seams the editor uses to talk to
 * its host page. Everything here is either persisted by the host or supplied by
 * it, so treat the shapes as a contract rather than an implementation detail.
 */

/**
 * Threshold values arrive from two places with two different types: the host's
 * saved bands (numbers) and the editor's own text inputs (strings). Rather than
 * coercing at the boundary and lying about one of them, the model admits both
 * and `toValue()` is the single place that resolves it.
 */
export type BandValue = number | string;

/**
 * The mastery flag has the same problem from the other direction: it is
 * persisted as `1`/`0` but a checkbox hands back a boolean. `toMastery()`
 * resolves both, and the hidden field the host posts is always written as
 * `1`/`0`.
 */
export type MasteryValue = number | boolean;

/**
 * One band: a labelled floor on the score scale.
 *
 * The keys are snake_case because this is the shape the host hands over as
 * `window._performanceBand` and the editor **adopts that array** — renaming
 * them here would mean the host's own object stopped matching what it saves.
 */
export interface Band {
    /** Empty for a band the host has not saved yet. */
    id: string;
    /** Host colour token, e.g. `blue-base`. Meaningful only to the host's CSS. */
    color: string;
    /** Lowest score that falls in this band. */
    min_value: BandValue;
    label: string;
    /** Whether reaching this band counts as mastery. */
    mastery_flg: MasteryValue;
}

/** A selectable colour token, as offered in each row's colour menu. */
export interface BandColor {
    /** The value stored on the band and posted to the host. */
    token: string;
    /** What the option reads as in the menu. */
    label: string;
}

/**
 * The span of scores a band covers: from its own threshold up to — but not
 * including — the next band above it. The top band runs to `maxValue`.
 */
export interface BandRange {
    from: number;
    to: number;
    /** True for the highest band, whose range is closed at `maxValue`. */
    isTop: boolean;
}

/**
 * Everything the editor needs from the page it is embedded in.
 *
 * This is the only seam between the editor and its host. Nothing else in the
 * library may reach for a global, an icon set or a tooltip library — which is
 * what lets the same bundle run in any host, and what lets the demo run it with
 * no host framework at all.
 *
 * The default implementation reads a global object of this shape; see
 * `host/globalHost.ts`.
 */
export interface HostBridge {
    /**
     * Returns an icon.
     *
     * Return a `Node` to avoid HTML parsing altogether — it is cloned and
     * inserted as-is. A returned **string is parsed as HTML** and must
     * therefore be trusted. Prefer the node form where you can.
     */
    icon(style: string, name: string): string | Node;
    /**
     * Extra attributes for a control that already carries a `title`, letting the
     * host upgrade it from a native tooltip to a styled one. Return `{}` to keep
     * the native behaviour.
     */
    tooltipAttributes(): Record<string, string>;
    /** Called after nodes are inserted so the host can activate them. */
    activate(root: HTMLElement): void;
    /** Dismisses any open tooltip, e.g. one attached to a node about to be removed. */
    hideTooltips(): void;
}

export interface PerformanceBandEditorOptions {
    /** Element or selector to render into. Defaults to `#nt-performance-band-app`. */
    container?: string | HTMLElement;
    /** Initial bands. Defaults to `window._performanceBand`, then to an empty set. */
    bands?: Band[];
    /**
     * Prefix for every generated form field name. Defaults to
     * `performance_band`, which is what the host form expects — see
     * `dom/fieldNames.ts`.
     */
    fieldPrefix?: string;
    /**
     * Top of the score scale, used for the highest band's range readout and for
     * range validation. Defaults to 100.
     */
    maxValue?: number;
    /**
     * Colour tokens offered in each row's menu. Defaults to the four the host
     * template ships with; supply your own to match a different palette.
     */
    colors?: BandColor[];
    /** Host integration. Defaults to a bridge backed by the `hostGlobal` object. */
    host?: HostBridge;
    /**
     * Name of the global carrying the host bridge. Defaults to
     * `PerformanceBandHost`. Ignored when `host` is supplied directly.
     */
    hostGlobal?: string;
    /**
     * Called after every change to the bands, including individual keystrokes
     * in a label or threshold field.
     *
     * This is how a host marks its form dirty, warns on unsaved navigation or
     * live-validates. It is deliberately chatty rather than debounced: only the
     * host knows what an appropriate settling delay is for its own UI.
     */
    onChange?: (bands: Band[], editor: PerformanceBandEditorLike) => void;
}

/**
 * The part of the editor handed to `onChange`. Typed structurally so `types.ts`
 * stays free of an import cycle back to `PerformanceBandEditor.ts`.
 */
export interface PerformanceBandEditorLike {
    readonly bands: Band[];
    readonly masteryCount: number;
    validate(): ValidationResult;
}

export type ProblemCode =
    /** There are no bands at all. */
    | 'empty-bands'
    /** A band has no label. */
    | 'band-without-label'
    /** A band's threshold is not a number. */
    | 'band-value-not-numeric'
    /** A band's threshold falls outside 0…`maxValue`. */
    | 'band-value-out-of-range'
    /** Two bands share a threshold, so a score between them is ambiguous. */
    | 'duplicate-band-value'
    /** No band starts at zero, so the lowest scores fall into no band at all. */
    | 'bands-without-floor'
    /** No band is flagged as mastery, so nothing can ever be met. */
    | 'no-mastery-band';

export interface ValidationProblem {
    code: ProblemCode;
    /** Human-readable, safe to show to the person editing the bands. */
    message: string;
    /** Index of the band at fault, when the problem is scoped to one. */
    bandIndex?: number;
}

export interface ValidationResult {
    valid: boolean;
    problems: ValidationProblem[];
}

declare global {
    interface Window {
        /** Populated by the host template before the editor is constructed. */
        _performanceBand?: Band[];
    }
}
