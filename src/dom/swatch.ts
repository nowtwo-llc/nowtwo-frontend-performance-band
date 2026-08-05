/**
 * How a colour value becomes something you can see.
 *
 * Two kinds of value live in the same field, and the difference decides how it
 * is painted:
 *
 * - A **host theme token** (`blue-base`) is applied as a class and exposed as
 *   `data-color`. The host's stylesheet paints it — this library never does.
 * - A **literal colour** (`#3a6ea5`) has no class to hang on, so it is applied
 *   inline. Only available when the host opts in via `allowCustomColor`.
 */

export const SWATCH_CLASS = 'band-swatch';

/**
 * Strict on purpose. The literal branch writes its value straight into an
 * inline `background`, so this regex is the gate that keeps anything which is
 * not a plain hex colour out of the style attribute. Widen it and you widen a
 * CSS injection surface — see SECURITY.md.
 */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isCustomColor(value: string): boolean {
    return HEX_COLOR.test(value);
}

/**
 * Paints a swatch for a colour value.
 *
 * Both branches fully reset the other's work, because one node is reused as the
 * value changes: a band switched from a custom colour back to a token would
 * otherwise keep its inline background and show the wrong colour under the
 * right class.
 */
export function applySwatch(node: HTMLElement, color: string): void {
    if (isCustomColor(color)) {
        node.className = SWATCH_CLASS;
        node.removeAttribute('data-color');
        node.style.background = color;

        return;
    }

    // Anything that is not a hex colour is treated as a class name, so a value
    // that tried to smuggle CSS in ends up as an inert (and meaningless) class
    // rather than a declaration.
    node.className = color ? `${SWATCH_CLASS} ${color}` : SWATCH_CLASS;

    // The whole attribute, not removeProperty('background'): `background` is a
    // shorthand, and removing a shorthand leaves its longhands behind — the
    // swatch would keep the old colour under the new class. Safe to wipe
    // wholesale because the inline background above is the only inline style
    // this library ever sets on a swatch.
    node.removeAttribute('style');

    if (color) {
        node.setAttribute('data-color', color);
    } else {
        node.removeAttribute('data-color');
    }
}
