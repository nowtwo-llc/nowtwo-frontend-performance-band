import type { HostBridge } from '../types';

/** Name of the global the default bridge reads. */
export const DEFAULT_HOST_GLOBAL = 'PerformanceBandHost';

/**
 * A host bridge whose members are all optional, which is what a page actually
 * defines: most hosts supply icons but have no opinion on the rest.
 */
type PartialHost = Partial<HostBridge>;

/**
 * Resolved on every call rather than captured once.
 *
 * The bundle is often loaded before the host page finishes wiring itself up, so
 * a reference taken at module load would pin `undefined` for the lifetime of
 * the page.
 */
function resolve(globalName: string): PartialHost | undefined {
    return (globalThis as Record<string, unknown>)[globalName] as PartialHost | undefined;
}

/**
 * The default host bridge: it reads a global object of the same shape, so a
 * page using the `<script>` build can integrate without writing any module
 * code — it just defines `window.PerformanceBandHost` before mounting.
 *
 * Every method degrades to a no-op when the global, or that member of it, is
 * missing. That is deliberate: the editor still renders and still posts correct
 * form data on a page that provides nothing, so a host can adopt the pieces it
 * cares about and ignore the rest.
 *
 * Pass a `HostBridge` directly via the `host` option to skip globals entirely.
 */
export function createGlobalHost(globalName: string = DEFAULT_HOST_GLOBAL): HostBridge {
    return {
        icon(style: string, name: string): string | Node {
            return resolve(globalName)?.icon?.(style, name) ?? '';
        },

        tooltipAttributes(): Record<string, string> {
            return resolve(globalName)?.tooltipAttributes?.() ?? {};
        },

        activate(root: HTMLElement): void {
            resolve(globalName)?.activate?.(root);
        },

        hideTooltips(): void {
            resolve(globalName)?.hideTooltips?.();
        }
    };
}
