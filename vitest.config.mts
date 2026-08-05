import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // The editor is pure DOM manipulation — element creation, class names,
        // form field names and input values — so it needs a document but never
        // a layout engine or real rendering.
        environment: 'jsdom',
        include: ['tests/**/*.spec.ts'],
        setupFiles: ['./tests/setup.ts'],
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: [
                // Type-only declarations; there is no runtime to cover.
                'src/css.d.ts',
                'src/types.ts',
                // A webpack shim that re-exports the public API and pulls in the
                // stylesheet. Tests import src/PerformanceBandEditor.ts directly,
                // so this would report 0% and understate real coverage.
                'src/bundle.ts'
            ],
            reporter: ['text', 'lcov'],
            // Floors set just under the current numbers (99.00 / 96.29 / 100
            // / 98.95), so an accidental drop fails CI but ordinary refactoring
            // does not. Raise them when coverage climbs; never lower them to
            // make a build pass.
            thresholds: {
                statements: 98,
                branches: 95,
                functions: 99,
                lines: 98
            }
        }
    }
});
