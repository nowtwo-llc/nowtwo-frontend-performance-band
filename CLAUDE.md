# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frontend Performance Band is a browser editor for performance bands: labelled floors on a
score scale, each with a colour token and a mastery flag. Standalone TypeScript with **no
runtime dependencies**, owned by NowTwo LLC.

Published as `@nowtwo-llc/frontend-performance-band` to the public npm registry
(`registry.npmjs.org`). That is the only registry it is published to — `publishConfig` carries
`access: public` and deliberately pins no registry.

This repo is public. All naming, metadata, copyright and documentation must stay under NowTwo
LLC.

**There was no prior implementation.** Before 1.0.0 this repository held an empty Vue 2
component (`src/App.vue` had an empty template and an empty `data()`), a `main.js` that
mounted it, and two committed webpack bundles containing nothing but core-js polyfills and the
Vue runtime. The only description of the intended data shape was the `_performanceBand` global
in the old `index.html`, and that shape is what the model below preserves. Do not describe
1.0.0 as a port, a rewrite or a migration — there was nothing to port.

## Build & Development Commands

```bash
npm run build:dev       # Development UMD build → ./build
npm run build:prod      # UMD + ESM + CJS bundles and types → ./dist
npm run build:types     # Declarations only → ./dist/types
npm run watch           # Development build with file watching
npm test                # Vitest suite (jsdom)
npm run test:watch      # Vitest in watch mode
npm run test:coverage   # Vitest with coverage thresholds enforced
npm run typecheck       # tsc over the library and the tests
npm run lint            # oxlint + Prettier + Stylelint, with fixes
npm run lint:check      # same, no fixes — what CI runs
npm run demo            # Build, then serve the demo at http://localhost:5050
npm run clean           # Remove build/, dist/ and coverage/
```

## Architecture

This is a **form control, not an application**. It renders inputs into the host's form and has
no save, no fetch and no router. What follows are the constraints most likely to be broken by
a well-meaning change.

### 1. Band order is derived, never chosen

A band's position **is** its threshold: the set is sorted highest-first and re-sorted on every
keystroke in a `min_value` field. This is why there is no drag-to-reorder and why SortableJS
is not a dependency — a dragged row would be overruled by the next keystroke.

Do not add drag-and-drop here. If a manual order is ever genuinely wanted, it needs a stored
sort key first; reordering rows against a derived order is a bug, not a feature.

`BandState` **sorts the array it adopts**, in place, in its constructor. That is a real
mutation of the host's `window._performanceBand`, and it is meant to be: the range readouts
are only correct while the list is sorted.

### 2. Form field names are a wire contract

`src/dom/fieldNames.ts` is the single source of the naming scheme, and
`tests/unit/fieldNames.spec.ts` spells the literals out so a change has to break a test on
purpose.

Every field is a flat `name[]` array — `performance_band_id[]`, `_color[]`, `_min_value[]`,
`_label[]`, `_mastery_flg[]` — and the server pairs the five arrays up **by document order**.
Nothing embeds a row index, which is exactly what makes constant re-sorting cheap: the rows
move and the arrays follow with no renaming.

**The mastery flag is a hidden input, and that is load-bearing.** An unchecked checkbox posts
nothing at all, which would shorten that one array and silently shift every following band's
flag onto the wrong band. The checkbox in `BandRow` is deliberately **unnamed**; the hidden
field beside it posts `1` or `0` for every band, always. Never give the checkbox a `name`.

### 3. Never re-render what someone is typing into

Every mutation on `BandState` reports how far the damage spreads, and
`PerformanceBandEditor.apply()` routes each to the narrowest render that covers it:

| `BandChange` | Render |
| --- | --- |
| `list` | Rebuild every row (`renderList`) |
| `order` | Move the existing rows (`syncOrder`) then refresh readouts |
| `values` | Range readouts and the footer only |
| `color` | One row's swatch |
| `mastery` | One row's hidden field, plus the footer tally |
| `text` | **Nothing** |

Label edits report `text`, which renders nothing — the DOM already shows what was typed, so
re-rendering would only move the caret. They are still *reported* so that `onChange` hears
every edit; that is the whole reason the case exists rather than the setter staying silent.

`apply()` calls `notifyChange()` for every change type, which fans out to the `onChange`
option and a bubbling `nt-performance-band:change` DOM event. Never debounce it here — only
the host knows what settling delay its UI wants.

`syncOrder` **moves the existing rows** rather than rewriting values into fixed positions, so
the field being typed into travels with its own value. `preserveFocus` then restores the
caret, because `append` on an attached node detaches and reinserts it, which blurs it. The
"keeps the caret in the field being typed into through a re-sort" test guards this; if it
starts failing, something widened a patch.

`syncOrder` also re-derives `this.rows` in the same pass. Row handlers resolve their index via
`indexOf(row)` when they fire, never capture it at render time — a stale `rows` array would
address the wrong band on the very next keystroke.

### 4. Host coupling is confined to one interface

Nothing in `src/` may reference a host global, an icon set or a tooltip library except
`src/host/globalHost.ts`. Everything page-specific — icon markup, tooltip attributes,
activation, dismissing tooltips — goes through `HostBridge`. `example/host.js` is the proof:
it is what lets the demo run the real bundle with no application framework behind it, so keep
it working.

**This includes markup hooks.** Attributes that only mean something to a particular host's
JavaScript must come from `tooltipAttributes()`, never be hardcoded in `BandRow`. A `title` is
fine — that is native HTML and works everywhere.

`createGlobalHost` resolves the global on **every call** rather than capturing it once. The
bundle is routinely loaded before the host page finishes wiring itself up, so a reference
taken at module load would pin `undefined` for the life of the page. Every method degrades to
a no-op when its counterpart is missing, so the editor still renders and still posts correct
form data on a page that provides nothing.

**Colour tokens belong to the host.** `blue-base` is a host theme class, not something this
library paints. The token is stored, offered in the picker, posted, applied to the swatch as a
class and exposed as `data-color` — and that is the entire relationship. Do not add colour
values to `PerformanceBandEditor.css`.

The **one** exception is a custom hex colour, which exists only when the host passes
`allowCustomColor`. A hex value has no class to hang on, so `applySwatch()` writes it into an
inline `background`. `src/dom/swatch.ts` decides which route a value takes, and its regex is
the gate on the only path in the library that produces a style declaration — widening it
widens a CSS injection surface. Both branches also fully reset the other's work, because one
swatch node is reused as the value changes.

### 5. Accessibility is behaviour, not polish

This is a form used in education, where conformance is routinely a procurement requirement.
`tests/unit/accessibility.spec.ts` asserts every visible control has an accessible name;
treat a failure there as a broken feature.

Things that look like details and are not:

- **Labels are real `<label for>` elements**, visually hidden via
  `.nt-performance-band-sr-only` (`clip-path`, not `display: none` — the latter removes them
  from the accessibility tree too). Ids come from `uniqueId()` because two editors can share a
  page.
- **The mastery checkbox keeps a visible label.** It is the one control in the row whose
  meaning is not recoverable from the column header once the row scrolls away from it.
- **Threshold fields are `type="text"` + `inputmode="decimal"`.** Never `type="number"`: it
  rejects the half-typed values this editor tolerates (`-`, `1.`) and *throws* on
  `selectionStart`, which `preserveFocus` depends on — and here `preserveFocus` runs on
  potentially every keystroke, because every keystroke can re-sort the list.
- **The span readout carries a visually hidden prefix.** Without it a screen reader announces
  a bare `90 – 100` with no indication of what it measures.
- Reordering has no pointer-only path, because order follows the threshold. That is an
  accessibility property of the design, not an omission — do not "fix" it with drag handles.

### 5a. The colour picker replaced a native control, so it owes what that control gave

`ColorPicker` is a hand-built listbox popup. A `<select>` would have provided all of the
following for free, which is the standard it has to meet — `tests/unit/ColorPicker.spec.ts`
holds it there:

- Trigger is a real `<button>` with `aria-haspopup="listbox"` and `aria-expanded`.
- Popup is `role="listbox"`, swatches are `role="option"` with `aria-selected`.
- **Focus stays on the listbox** and moves virtually via `aria-activedescendant`. That is what
  makes a grid of `<div>`s navigable, and it is why `.band-color-option.is-active` ships with a
  visible marker in the library's own stylesheet — without it a keyboard user navigates blind.
- Up/Down move by `COLUMNS`, not by one. The popup is a grid to the eye and must be one to the
  keyboard.

Three things are load-bearing and non-obvious:

- **The value posts from a hidden input**, not the control — a custom widget is not a form
  element, and the wire format must not depend on one. Same reason as the mastery flag.
- **`mousedown` on the listbox is `preventDefault()`ed.** Without it the listbox blurs on
  mousedown, `focusout` closes the popup, and the click never reaches the swatch.
- **Closing is done with `focusout`, deliberately not a document click listener.** `focusout`
  already covers clicking away, tabbing away and focusing another picker, and it leaves nothing
  to unregister when `renderList` throws a row away. Do not add a document-level listener here;
  rows are rebuilt constantly and it would leak one per row.

`.band-container` therefore **must not** set `overflow: hidden` — it would clip the popup. Cells
that can overflow clip themselves instead.

### 6. Only one value may ever be HTML-parsed

`hostMarkup()` in `dom/element.ts` is the **single** place anything becomes markup, and only
one host-supplied value reaches it: icon markup. Everything the person editing the bands types
is written with `value` or `textContent` and can never be parsed.

`icon()` accepts a `Node` as well as a string, and a `Node` is used as-is, so a host can opt
out of HTML parsing entirely. Nodes are **cloned** on insertion: a host that builds its icon
once and returns the same element would otherwise have `append` move that single element from
one control to the next, leaving only the last one rendered.

Do not add a second `innerHTML` anywhere. If something needs host-supplied markup, route it
through `hostMarkup` so the surface stays enumerable — SECURITY.md documents exactly this one.

### Source layout

```
src/
  PerformanceBandEditor.ts   Public controller. The only module in tsconfig.types.json.
  bundle.ts                  Webpack entry: CSS side-effect import + re-export.
  types.ts                   Data model and the HostBridge contract.
  model/
    BandState.ts             Owns the band array and every mutation to it.
    ranges.ts                toValue / toMastery / sortBands / bandRange / nextBandValue.
    factories.ts             New band shape and the default colour palette.
    validate.ts              Reports problems; never blocks input.
  dom/
    BandRow.ts               One row, built once and patched.
    ColorPicker.ts           The swatch-grid listbox popup.
    swatch.ts                Token-vs-hex routing; the only inline-style path.
    fieldNames.ts            The form contract.
    element.ts               el() / hostMarkup() / clear() / preserveFocus() / uniqueId().
    layout.ts                Header, footer, empty state.
  host/
    globalHost.ts            The only file that reads a host global.
```

`BandRow` deliberately **does not know its own index** — every field name is a flat array, so
a re-sort needs no renaming. If you find yourself wanting to pass an index into a row, check
first that you are not about to reintroduce index-embedded field names.

The model keys are snake_case (`min_value`, `mastery_flg`) because `BandState` adopts
`window._performanceBand` and the host expects edits to land on that same object under those
same keys. Do not camelCase them.

## Distribution

`package.json` ships four artifacts through an `exports` map:

| Condition | File |
| --- | --- |
| `import` | `dist/frontend-performance-band.mjs` |
| `require` | `dist/frontend-performance-band.cjs` |
| `types` | `dist/types/PerformanceBandEditor.d.ts` |
| `unpkg` / script tag | `dist/frontend-performance-band.min.js` (UMD, exposes the `PerformanceBandEditor` global) |
| `./style.css` | `dist/frontend-performance-band.css` |

The CSS is always a separate file — never inlined into the JavaScript, so consumers must
import the stylesheet themselves. It carries layout only; colour and control styling come from
the host page via classes the markup reuses (`input`, `button`, `dataList`).

`dist/` and `build/` are gitignored. `prepublishOnly` rebuilds `dist/` so published output
always matches the tagged source.

## Build System

Webpack 5 with **esbuild-loader**. `webpack.config.js` exports a single UMD config in
development and an array of three (UMD, ESM, CJS) in production.

Things that are load-bearing and easy to break:

- **esbuild-loader, not ts-loader.** TypeScript 7 is the native Go port and exposes no JS
  compiler API, so ts-loader (which calls `createProgram`/`createLanguageService`) cannot run
  against it at all. esbuild only strips types — it never type-checks and never emits
  declarations.
- **ES2020 lives in three places** and they must move together: `target` in `tsconfig.json`,
  `target` on the esbuild-loader rule, and `BUILD_TARGET` in `webpack.config.js`. Webpack's
  runtime wrapper follows the last one, so a mismatch silently ships syntax the tsconfig
  promised not to.
- **The CJS config uses `src/PerformanceBandEditor.ts` as its entry, not `src/bundle.ts`.**
  Bundling the CSS import there pulls in webpack's automatic-publicPath runtime, which throws
  outside a browser and breaks `require()` at load time.
- **Declarations are emitted once** by `tsc -p tsconfig.types.json`. esbuild cannot produce
  them.
- **No vendor split.** There are no runtime dependencies, so the UMD build is genuinely one
  file. Do not introduce `splitChunks` — a host template having to load two files is exactly
  what this packaging avoids.
- Cleaning is done by the npm scripts (`rm -rf`), not a webpack plugin — three configs writing
  to one directory would delete each other's output.

## TypeScript setup

Running **TypeScript 7** (the native Go port). Three configs:

- `tsconfig.json` — the library. ES2020 target, `bundler` resolution, strict. Covers `src`
  only.
- `tsconfig.test.json` — the tests and `vitest.config.mts`. Adds Node types and `noEmit`.
- `tsconfig.types.json` — declaration-only emit, rooted at `src/PerformanceBandEditor.ts`.

`tsc` does two jobs and both are required: `npm run typecheck` is the **only** type gate
(esbuild does not check types, so `npm run build` will happily bundle broken code), and
`npm run build:types` is the only source of `.d.ts` files.

**Do not reintroduce Vue.** `vue-tsc` cannot run against the Go port — it resolves
`typescript/lib/tsc`, which the native package does not export, and dies with
`ERR_PACKAGE_PATH_NOT_EXPORTED`. Adding an SFC would mean either dropping to TypeScript 5/6 or
shipping `.vue` files with no type checking at all.

## Testing

Vitest on jsdom. The suite imports from `src/`, so no build is needed to run tests.

Assertions are chai-style (`expect(x).to.equal(y)`), which Vitest supports natively since its
`expect` is built on chai. `no-unused-expressions` is disabled for `tests/**` because those
assertions are bare expressions.

`tests/setup.ts` installs a `PerformanceBandHost` global so the default bridge is exercised on
its real path; `createMockHost()` is for tests that assert on host calls directly.

Nothing is mocked out of the library itself — with no runtime dependencies there is nothing to
stub, and every behaviour including the re-sort is reachable through the public API.

Coverage thresholds in `vitest.config.mts` sit just under the current numbers. Raise them when
coverage climbs; never lower them to make a build pass.

## Code Style

- Prettier: 120 char width, 4-space indent, single quotes, no trailing commas, always arrow
  parens.
- **oxlint** (`.oxlintrc.json`) rather than ESLint. typescript-eslint hard-refuses TypeScript
  7 at runtime, and ESLint's own parser cannot read TypeScript without it; oxlint parses TS
  natively in Rust. The trade-off is no type-aware rules — `strict` under `tsc` carries that
  weight now.
- Stylelint via `stylelint-prettier`. Stylelint 15/16 removed the stylistic rules; don't
  re-add rules like `media-feature-colon-space-after` — Prettier owns formatting.
- CSS is flat, plain CSS. There is no preprocessor and no reason to introduce one for a
  layout-only stylesheet.

## CI

- `ci.yml` — typecheck, lint, test with coverage, build, `npm pack --dry-run` on pushes and
  PRs to `main`.
- `publish.yml` — on `v*` tags. Verifies the tag matches `package.json`, then publishes to npm
  via OIDC trusted publishing (no token; needs `id-token: write`, Node >= 22.14.0 and
  npm >= 11.5.1, so it upgrades npm because setup-node ships 10.x).
- `pages.yml` — deploys `example/` plus `dist/` to GitHub Pages. The demo is served at
  `/example/` so its `../dist/...` paths resolve the same way they do locally.

Two things in the workflows are security controls, not style — do not "tidy" them away:

- **The npm job sets `environment: npm-publish`.** That environment carries required
  reviewers, so a `v*` tag queues a release for approval instead of publishing immediately.
  The name must stay identical to the Environment field on the npm trusted publisher; GitHub
  puts it in the OIDC claim and npm rejects a mismatch.
- **Every action is pinned to a full commit SHA** with the version in a trailing comment. Tags
  can be force-moved by a compromised action repo; SHAs cannot. Dependabot updates the pins.
  Never replace a SHA with `@v5` to make a diff cleaner.

## Host template

The host template defines the container and the data before mounting:

```html
<div id="nt-performance-band-app"></div>
<script>
    var _performanceBand = [
        { id: '', color: 'blue-base', min_value: 90, label: 'Standard Exceeded', mastery_flg: 1 }
    ];
</script>
<script src="…/frontend-performance-band.min.js"></script>
<script>
    new PerformanceBandEditor({ container: '#nt-performance-band-app' }).mount();
</script>
```

A host that wants icons or styled tooltips defines a `window.PerformanceBandHost` object
before mounting. `example/host.js` is a complete worked example.
