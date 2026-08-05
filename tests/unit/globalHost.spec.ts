import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGlobalHost, DEFAULT_HOST_GLOBAL } from '../../src/host/globalHost';
import { installHostGlobal, removeHostGlobal } from '../setup';

afterEach(() => {
    installHostGlobal();
});

describe('createGlobalHost', () => {
    it('reads the default global', () => {
        expect(createGlobalHost().icon('regular', 'fa-plus')).to.equal('<i class="regular fa-plus"></i>');
    });

    it('reads a named global instead when asked', () => {
        (globalThis as Record<string, unknown>).OtherHost = { icon: () => 'other' };

        expect(createGlobalHost('OtherHost').icon('regular', 'fa-plus')).to.equal('other');

        delete (globalThis as Record<string, unknown>).OtherHost;
    });

    it('resolves the global on every call, not once at construction', () => {
        removeHostGlobal();
        const host = createGlobalHost();

        // The bundle routinely loads before the host page finishes wiring
        // itself up, so a reference captured here would pin undefined forever.
        expect(host.icon('regular', 'fa-plus')).to.equal('');

        (globalThis as Record<string, unknown>)[DEFAULT_HOST_GLOBAL] = { icon: () => 'late' };

        expect(host.icon('regular', 'fa-plus')).to.equal('late');
    });

    it('degrades every method to a no-op when there is no global at all', () => {
        removeHostGlobal();
        const host = createGlobalHost();
        const root = document.createElement('div');

        expect(host.icon('regular', 'fa-plus')).to.equal('');
        expect(host.tooltipAttributes()).to.deep.equal({});
        expect(() => host.activate(root)).to.not.throw();
        expect(() => host.hideTooltips()).to.not.throw();
    });

    it('degrades individual missing members, so a host can adopt only what it needs', () => {
        (globalThis as Record<string, unknown>)[DEFAULT_HOST_GLOBAL] = { icon: () => 'only-icons' };
        const host = createGlobalHost();

        expect(host.icon('regular', 'fa-plus')).to.equal('only-icons');
        expect(host.tooltipAttributes()).to.deep.equal({});
        expect(() => host.hideTooltips()).to.not.throw();
    });

    it('passes through to every member the global does implement', () => {
        const activate = vi.fn();
        const hideTooltips = vi.fn();
        (globalThis as Record<string, unknown>)[DEFAULT_HOST_GLOBAL] = {
            icon: () => 'i',
            tooltipAttributes: () => ({ 'data-x': '1' }),
            activate,
            hideTooltips
        };

        const host = createGlobalHost();
        const root = document.createElement('div');
        host.activate(root);
        host.hideTooltips();

        expect(host.tooltipAttributes()).to.deep.equal({ 'data-x': '1' });
        expect(activate).toHaveBeenCalledWith(root);
        expect(hideTooltips).toHaveBeenCalled();
    });
});
