# Contributing to Frontend Performance Band

Thanks for taking the time to contribute.

## Getting set up

**Use Node 22** — there is an `.nvmrc`, so `nvm use` picks it up.

The `engines` field says `>=20` because that describes *consumers*: the package ships browser
code that never executes in Node, so it imposes almost nothing on the projects that install
it. Developing it is stricter — the dev toolchain floor is **Node 22.22.2**, set by jsdom 30.
On an older Node the test run can fail before a single test executes. That constraint
deliberately lives in `.nvmrc` rather than in `engines`, which would push it onto consumers
who are unaffected by it.

```bash
git clone git@github.com:nowtwo-llc/nowtwo-frontend-performance-band.git
cd nowtwo-frontend-performance-band
npm install
npm test
```

## Development workflow

```bash
npm run watch        # rebuild ./build on change
npm run test:watch   # re-run the suite on change
```

To see a change in a real browser, run `npm run demo`. It builds and serves at
<http://localhost:5050> (`PORT=…` to change it), mirroring the deployed layout so the page's
relative `../dist/` paths resolve exactly as they do on GitHub Pages. Opening
`example/index.html` directly works too, but only after a build.

The demo supplies its own `HostBridge` through `example/host.js`. That is not a convenience —
it is the proof that the editor's host coupling is confined to one interface, so keep it
working.

## Before opening a pull request

Run the same checks CI does:

```bash
npm run typecheck
npm run lint
npm test
npm run build:prod
```

`npm run lint` autofixes what it can. Formatting is Prettier's job — run `npm run format`
rather than hand-formatting around it. CSS formatting goes through `stylelint-prettier`.

## Conventions

- **Band order is derived, never chosen.** A band's position is its threshold, so the list
  re-sorts on every keystroke in a `min_value` field. That is why there is no drag-to-reorder
  and no SortableJS dependency; a dragged row would be overruled by the next keystroke. If a
  manual order is ever wanted it needs a stored sort key first.
- **Form field names are a wire contract.** The editor has no save of its own; it renders
  inputs into the host's form and the host posts them. `src/dom/fieldNames.ts` is the single
  source of that scheme and `tests/unit/fieldNames.spec.ts` spells the literals out on
  purpose, so changing one has to break a test deliberately. Every field is a flat `[]` array
  paired by document order — nothing embeds a row index, which is what keeps re-sorting cheap.
- **The mastery checkbox must stay unnamed.** An unchecked checkbox posts nothing, which would
  shorten the `…_mastery_flg[]` array and shift every following band's flag onto the wrong
  band. The hidden input beside it is what posts, always as `1` or `0`.
- **Never re-render what someone is typing into.** Every state change reports how far the
  damage spreads (see `BandChange`) and the editor patches the narrowest thing that covers it.
  A change that widens a patch will silently start eating keystrokes — the "keeps the caret in
  the field being typed into through a re-sort" test guards the worst case.
- **Host coupling goes through `HostBridge`.** Nothing else in `src/` may reference a host
  global, an icon set or a tooltip library — including markup hooks like `data-*` attributes
  that only a particular host's JavaScript understands. `src/host/globalHost.ts` is the only
  file that reads a global, and it resolves it on every call rather than capturing it, because
  the bundle is routinely loaded before the host page finishes wiring itself up.
- **Colour tokens belong to the host.** The library stores, offers and posts a token; the
  host's stylesheet paints it. Do not put colour values in `PerformanceBandEditor.css`.
- **The library is strict-mode TypeScript 7.** `tsconfig.json` targets ES2020 with `bundler`
  module resolution. The tests type-check under `tsconfig.test.json`, which only adds Node
  types and `noEmit`.
- **ES2020 is set in three places** and they must move together: `target` in `tsconfig.json`,
  `target` on the esbuild-loader rule, and `BUILD_TARGET` in `webpack.config.js`. Webpack's
  own runtime wrapper follows the last one, so a mismatch silently ships syntax the tsconfig
  promised not to.
- **esbuild does not type-check.** It only strips types, so `npm run build` will not fail on a
  type error — `npm run typecheck` is the gate, and CI runs it before building.
- **Tests run on jsdom against `src/`,** so no build is needed to run them. With no runtime
  dependencies there is nothing to mock; every behaviour, including the re-sort, is reachable
  through the public API.

## Releasing

Releases publish to the public npm registry from CI:

1. Bump `version` in `package.json`.
2. Commit, then tag: `git tag v1.0.1 && git push --tags`.

The publish workflow verifies the tag matches `package.json`, runs the full check suite, and
publishes. `prepublishOnly` rebuilds `dist/` from the tagged source, so build output never
needs to be committed.
