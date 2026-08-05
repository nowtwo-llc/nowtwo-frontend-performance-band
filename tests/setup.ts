import { vi } from 'vitest';
import type { HostBridge } from '../src/types';
import { DEFAULT_HOST_GLOBAL } from '../src/host/globalHost';

/**
 * Installs a host bridge on the global the default implementation reads.
 *
 * Tests that go through this exercise the same path a `<script>`-tag page
 * takes, rather than bypassing the global lookup by injecting a bridge.
 */
export function installHostGlobal(): void {
    (globalThis as Record<string, unknown>)[DEFAULT_HOST_GLOBAL] = {
        icon: vi.fn((style: string, icon: string) => `<i class="${style} ${icon}"></i>`),
        tooltipAttributes: vi.fn(() => ({ 'data-tooltip': 'true' })),
        activate: vi.fn(),
        hideTooltips: vi.fn()
    };
}

export function removeHostGlobal(): void {
    delete (globalThis as Record<string, unknown>)[DEFAULT_HOST_GLOBAL];
}

/** A fully mocked bridge, for tests that assert on host calls directly. */
export function createMockHost(): HostBridge {
    return {
        icon: vi.fn((style: string, name: string) => `<i class="${style} ${name}"></i>`),
        tooltipAttributes: vi.fn(() => ({})),
        activate: vi.fn(),
        hideTooltips: vi.fn()
    };
}

installHostGlobal();

window._performanceBand = [];
