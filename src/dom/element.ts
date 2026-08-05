export type Attributes = Record<string, string | number | boolean | null | undefined>;

export type Child = Node | string | null | undefined;

/**
 * Minimal element builder.
 *
 * `false`, `null` and `undefined` attribute values are dropped rather than
 * stringified, so conditional attributes read as `{ disabled: isLocked }`.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes: Attributes = {},
    children: Child[] = []
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);

    Object.entries(attributes).forEach(([name, value]) => {
        if (value === null || value === undefined || value === false) {
            return;
        }

        node.setAttribute(name, value === true ? '' : String(value));
    });

    children.forEach((child) => {
        if (child === null || child === undefined) {
            return;
        }

        node.append(child);
    });

    return node;
}

/**
 * Renders a value supplied by the host bridge.
 *
 * Accepts a `Node` as well as a string, and returning a `Node` is the way for a
 * host to avoid HTML parsing entirely — the node is used as-is, so nothing is
 * ever interpreted as markup. A string is still parsed as HTML, which is why
 * the bridge contract says string values must be trusted. See SECURITY.md.
 *
 * Nodes are **cloned**. A host that builds its icons once and returns the same
 * element each time would otherwise have that single element moved from one
 * button to the next by `append`, so only the last one would render.
 *
 * Nothing the person editing the bands types ever reaches this; their input is
 * written with `value` and `textContent`.
 */
export function hostMarkup(value: string | Node, className?: string): HTMLSpanElement {
    const node = document.createElement('span');
    if (className) {
        node.className = className;
    }

    if (typeof value === 'string') {
        node.innerHTML = value;
    } else {
        node.append(value.cloneNode(true));
    }

    return node;
}

export function clear(node: HTMLElement): void {
    node.replaceChildren();
}

/** Class applied to content that must reach screen readers but not the screen. */
export const VISUALLY_HIDDEN_CLASS = 'nt-performance-band-sr-only';

let idSequence = 0;

/**
 * A document-unique id.
 *
 * Labels are associated by `for`/`id`, so the ids have to be unique across the
 * whole page — two editors on one page, or a row rebuilt after a delete, must
 * never collide. Monotonic rather than derived from position, because position
 * changes on every re-sort and the association would silently break if it did.
 */
export function uniqueId(prefix: string): string {
    idSequence += 1;

    return `${prefix}-${idSequence}`;
}

/**
 * A label bound to `htmlFor`, hidden visually but present for assistive tech.
 *
 * The rows are a dense single-line grid with no room for visible labels, and
 * placeholders are not a substitute: they vanish on focus and are announced
 * inconsistently. A real `<label>` also gives click-to-focus and a voice-control
 * target, which `aria-label` does not.
 */
export function hiddenLabel(htmlFor: string, text: string): HTMLLabelElement {
    return el('label', { for: htmlFor, class: VISUALLY_HIDDEN_CLASS }, [text]);
}

/**
 * Runs a DOM mutation without losing the caret.
 *
 * Moving an element with `append` detaches and reinserts it, which blurs it.
 * The bands re-sort while someone is typing a threshold, so without this the
 * field they are in loses focus on the keystroke that changes the order.
 */
export function preserveFocus(mutate: () => void): void {
    const active = document.activeElement;
    const isTextField = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
    const start = isTextField ? active.selectionStart : null;
    const end = isTextField ? active.selectionEnd : null;

    mutate();

    if (!isTextField || !active.isConnected) {
        return;
    }

    active.focus();

    if (start !== null && end !== null) {
        active.setSelectionRange(start, end);
    }
}
