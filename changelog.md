# Change Log

This project follows [semantic versioning](https://semver.org/).

## v1.0.0

The first release. The repository previously held an empty Vue 2 component, a script that
mounted it, and two committed webpack bundles containing nothing but polyfills and the Vue
runtime — there was no editor. This release is the editor.

### Added

- **`PerformanceBandEditor`**, a dependency-free TypeScript editor for performance bands:
  labelled floors on a score scale, each with a host colour token and a mastery flag. It
  renders form inputs into the host's own form and has no save of its own.
- **Bands sort themselves.** A band's position is its threshold, so the set is kept
  highest-first and re-sorts on every keystroke in a minimum-value field. The existing rows are
  *moved* rather than rebuilt and the caret is preserved, so the field being typed into travels
  with its own value.

  There is deliberately no drag-to-reorder: a dragged row would be overruled by the next
  keystroke. One consequence is that reordering has never needed a mouse.
- **A "Covers" readout per band**, showing the span it claims — from its own threshold up to
  the next band above it, with the highest band closed at `maxValue` (default 100). It updates
  as neighbours move.
- **`onChange` option and a bubbling `nt-performance-band:change` event.** Both fire on every
  edit, including individual keystrokes, so a host can mark its form dirty, warn on unsaved
  navigation or live-validate. Neither fires on mount, and neither is debounced — only the host
  knows what delay its UI wants.
- **`validate()`**, returning `{ valid, problems }`. Codes: `empty-bands`,
  `band-without-label`, `band-value-not-numeric`, `band-value-out-of-range`,
  `duplicate-band-value`, `bands-without-floor` and `no-mastery-band`, each carrying
  `bandIndex` where the problem is scoped to one band. The editor reports rather than blocks;
  half-finished state is normal while someone is still working.
- **A `HostBridge` seam.** Nothing in the library reaches for a host global. Define
  `window.PerformanceBandHost`, or pass a `host` option. Every member is optional and anything
  omitted degrades to a no-op — with no bridge at all the icons render empty and everything
  else still works. `example/host.js` is a complete worked bridge.
- **Configurable colour palette** via the `colors` option, defaulting to the four tokens the
  host template ships with. A band loaded with a token outside the palette keeps it rather than
  being silently re-saved as something else.
- **Accessibility as behaviour.** Real `<label for>` elements on every control, a visible label
  on the mastery checkbox, `aria-label` on icon-only buttons, `role="list"`/`"listitem"`, an
  `aria-live` summary, a `role="status"` empty state, and a visually hidden prefix on the span
  readout. `tests/unit/accessibility.spec.ts` enforces it.
- **Four build artifacts** through an `exports` map — UMD, ESM, CJS and declarations — plus a
  separate stylesheet. The UMD build is genuinely one file: there are no runtime dependencies,
  so a host template loads nothing alongside it.
- **A published demo** at `example/`, deployed to GitHub Pages, which runs the real bundle with
  no application framework behind it.
- **Tooling and CI**: Vitest on jsdom with enforced coverage thresholds, `tsc` as the type
  gate, oxlint, Prettier, Stylelint, Dependabot, and workflows for CI, npm trusted publishing
  and the Pages demo.

### Form fields

Every field is a flat array paired by document order:

| Field | Notes |
| --- | --- |
| `performance_band_id[]` | Empty for a new band |
| `performance_band_color[]` | Host theme token |
| `performance_band_min_value[]` | |
| `performance_band_label[]` | |
| `performance_band_mastery_flg[]` | Always `1` or `0`, from a hidden input |

The mastery flag posts from a hidden input rather than the checkbox on purpose: an unchecked
checkbox posts nothing, which would shorten that one array and shift every following band's
flag onto the wrong band.

### Removed

- The empty Vue 2 component, its mount script, and the `jquery`, `vue`, `vuex`, `vue-router`,
  `vee-validate`, `moment` and `node-sass` era of dependencies that came with them.
- The committed `src/www/` and `dist/` bundles. `dist/` is now gitignored and built on publish.
- The vendored host stylesheets that were checked into `css/`. The demo brings its own
  stand-in host theme instead.
