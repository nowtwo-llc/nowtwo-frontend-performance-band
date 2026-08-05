# Frontend Performance Band

[![CI](https://github.com/nowtwo-llc/nowtwo-frontend-performance-band/actions/workflows/ci.yml/badge.svg)](https://github.com/nowtwo-llc/nowtwo-frontend-performance-band/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A performance band editor for the browser. Labelled score thresholds, mastery flags and host
colour tokens — rendered as form inputs inside your own form.

```bash
npm install @nowtwo-llc/frontend-performance-band
```

## What it is

A performance band is a **labelled floor on a score scale**. A score falls into the highest
band whose minimum it reaches, so four bands at 90, 75, 50 and 0 partition 0–100 into
"Standard Exceeded", "Standard Met", "Standard Nearly Met" and "Standard Not Yet Met". Each
band also carries a colour token and a flag for whether reaching it counts as mastery.

The editor maintains that set, keeps every band's covered span current as its neighbours move,
and writes the whole thing into the surrounding form as named inputs.

It has **no save of its own**. The host page owns the form, the submit and the persistence —
which means adopting it is mostly a matter of reading the field names below.

[**Live demo →**](https://nowtwo-llc.github.io/nowtwo-frontend-performance-band/)

## Use

```ts
import { PerformanceBandEditor } from '@nowtwo-llc/frontend-performance-band';
import '@nowtwo-llc/frontend-performance-band/style.css';

const editor = new PerformanceBandEditor({
    container: '#nt-performance-band-app',
    bands: window._performanceBand
});

editor.mount();
```

Via a script tag, the UMD build exposes `PerformanceBandEditor` as a global:

```html
<link rel="stylesheet" href="/dist/frontend-performance-band.min.css" />
<script src="/dist/frontend-performance-band.min.js"></script>
<script>
    new PerformanceBandEditor({ container: '#nt-performance-band-app' }).mount();
</script>
```

The stylesheet is always a separate file — it is never inlined into the JavaScript, so you
must import it yourself. It carries **layout only**: the markup reuses your own `input`,
`button` and `dataList` classes so the editor inherits whatever theme is in force.

## Order is derived, not dragged

There is no drag-to-reorder here, deliberately. A band's position **is** its threshold, so the
list re-sorts itself as thresholds are edited — dragging a row would only fight the next
keystroke. Typing `95` into the bottom band moves it to the top on that keystroke, and the
caret stays where it was.

That also means reordering has never needed a mouse.

## Options

| Option | Default | Purpose |
| --- | --- | --- |
| `container` | `'#nt-performance-band-app'` | Element or selector to render into. Throws if a selector matches nothing. |
| `bands` | `window._performanceBand`, then `[]` | Initial bands. **Adopted, not copied** — edits land on the array you pass, and it is sorted in place on adoption. |
| `fieldPrefix` | `'performance_band'` | Prefix for every generated form field name. |
| `maxValue` | `100` | Top of the score scale, used for the highest band's span and for range validation. |
| `colors` | Four host tokens | Colour tokens offered in each row's picker. |
| `allowCustomColor` | `false` | Adds a custom hex swatch to the picker. See below — it changes what `color` can contain. |
| `host` | Bridge backed by `hostGlobal` | Host integration — see below. |
| `hostGlobal` | `'PerformanceBandHost'` | Name of the global carrying the host bridge. Ignored when `host` is passed. |
| `onChange` | — | Called after every edit, including individual keystrokes. |

## API

| Member | Description |
| --- | --- |
| `mount()` | Renders the editor. Idempotent. |
| `destroy()` | Removes the DOM and every listener. |
| `bands` | The live band array. |
| `masteryCount` | How many bands are flagged as counting toward mastery. |
| `validate()` | `{ valid, problems }` — see below. |
| `addBand()` | Adds a band at the top of the scale and focuses its threshold. |
| `removeBand(index)` | Removes a band, as its own remove button does. |

## Reacting to edits

Pass `onChange`, or listen for the `nt-performance-band:change` event on the container — the
event exists so `<script>`-tag pages that never hold the instance get the same news.

```ts
new PerformanceBandEditor({
    container: '#nt-performance-band-app',
    onChange: (bands, editor) => {
        form.dataset.dirty = 'true';
        saveButton.disabled = !editor.validate().valid;
    }
}).mount();
```

```js
document
    .querySelector('#nt-performance-band-app')
    .addEventListener('nt-performance-band:change', (event) => {
        console.log(event.detail.bands, event.detail.masteryCount);
    });
```

Both fire on **every keystroke**, and neither fires on mount. Debouncing is left to you, since
only the host knows what settling delay its own UI wants.

## Validation

The editor never blocks input — half-finished state is normal while someone is still working,
and a control that refuses input is worse than one that reports. Call `validate()` before
submitting and decide what to do:

```ts
const { valid, problems } = editor.validate();
if (!valid) {
    problems.forEach((p) => console.warn(p.code, p.message, p.bandIndex));
}
```

| `code` | Meaning |
| --- | --- |
| `empty-bands` | No bands at all |
| `band-without-label` | A band has a blank label |
| `band-value-not-numeric` | A threshold would silently save as zero |
| `band-value-out-of-range` | A threshold falls outside `0…maxValue` |
| `duplicate-band-value` | Two bands share a threshold, so scores there are ambiguous |
| `bands-without-floor` | No band starts at 0, so the lowest scores fall into no band |
| `no-mastery-band` | Nothing is flagged as mastery, so mastery can never be reached |

Problems carry `bandIndex` where the problem is scoped to one band, so you can point at the
row at fault.

## Accessibility

- Every input and select has a real `<label>`, visually hidden to fit the dense row layout.
  Placeholders are not relied on as names.
- The mastery checkbox keeps a **visible** label — a lone checkbox is the one control whose
  meaning is not recoverable from the column header once the row scrolls away from it.
- Icon-only buttons carry `aria-label` as well as `title`.
- **The colour picker is a proper listbox popup.** The trigger is a real button with
  `aria-haspopup`/`aria-expanded`; the grid is `role="listbox"` with `role="option"` swatches and
  `aria-selected`. Focus stays on the listbox and moves virtually via `aria-activedescendant`, so
  the active swatch is announced and carries a visible marker. <kbd>↓</kbd> opens, arrows move
  (<kbd>↑</kbd>/<kbd>↓</kbd> by a row, since it is a grid), <kbd>Home</kbd>/<kbd>End</kbd> jump to
  the ends, <kbd>Enter</kbd>/<kbd>Space</kbd> select, <kbd>Esc</kbd> closes and returns focus.
- Bands expose `role="list"` / `role="listitem"`; the summary is an `aria-live` region; the
  empty state is `role="status"`.
- The span readout carries a visually hidden "Covers scores:" prefix, so it is not a bare pair
  of numbers to a screen reader.
- **Reordering never needed a mouse**, because order follows the threshold you type.
- Threshold fields are `type="text"` with `inputmode="decimal"` — deliberately not
  `type="number"`, which rejects half-typed values and breaks caret preservation through the
  re-sort.

## Form fields

The editor posts through your form, so these names are a contract with your server.

| Field | Shape |
| --- | --- |
| `performance_band_id[]` | One per band, in document order. Empty for a new band. |
| `performance_band_color[]` | One per band |
| `performance_band_min_value[]` | One per band |
| `performance_band_label[]` | One per band |
| `performance_band_mastery_flg[]` | One per band, always `1` or `0` |

Every field is a plain array and the server pairs them up **by document order** — the five
arrays are read together, index for index, to reassemble each band. Nothing embeds a row
index, which is what makes the constant re-sorting cheap: after a re-sort the rows are moved
into their new order and the arrays follow with no renaming at all. Change `fieldPrefix` and
every name above changes with it.

**The mastery flag is a hidden input, not the checkbox.** An unchecked checkbox posts nothing
at all, which would shorten that one array and silently shift every following band's flag onto
the wrong band. The checkbox is unnamed and carries no wire meaning; the hidden field posts
`1` or `0` for every band, always.

## Host integration

Everything page-specific goes through a single `HostBridge`:

```ts
interface HostBridge {
    icon(style: string, name: string): string | Node;
    tooltipAttributes(): Record<string, string>;
    activate(root: HTMLElement): void;
    hideTooltips(): void;
}
```

`icon()` may return a **`Node`** rather than a string, in which case nothing is HTML-parsed —
the node is cloned per use, so one cached icon element works across every control. Strings are
parsed as HTML and must be trusted. See [SECURITY.md](SECURITY.md).

Pass one as the `host` option, or — for the `<script>` build, where you may not want to write
module code — define a global of the same shape and the editor will find it:

```html
<script>
    window.PerformanceBandHost = {
        icon: (style, name) => myIcons[name]
    };
</script>
```

**Every member is optional.** Anything you leave out degrades to a no-op, so the editor still
renders and still posts correct form data on a page that provides nothing at all.

`example/host.js` is a complete worked bridge, and it is what lets the demo run the real bundle
with no application framework behind it.

### Colours are yours

By default `color` is a **host theme token**, not a colour this library knows how to paint. The
editor stores it, offers it in the picker and posts it; your stylesheet is what gives
`blue-base` a blue. The token is applied to the swatch as a class and exposed as `data-color`,
so you can hook either:

```css
.blue-base {
    background: #3a6ea5;
}
```

The picker is built into the library — a swatch grid, no dependency, and no `<select>`. It
defaults to the four tokens the host template ships with; pass `colors` to offer your own:

```ts
new PerformanceBandEditor({
    colors: [
        { token: 'brand-strong', label: 'Strong' },
        { token: 'brand-weak', label: 'Weak' }
    ]
});
```

A band loaded with a token that is not in the palette keeps it — it gets an option of its own
rather than being silently re-saved as something else.

The picker ships **layout only**, like the rest of the stylesheet. Give the popup a surface of
its own or it will render transparent over the row beneath it:

```css
.band-color-picker--popup {
    border: 1px solid #ddd;
    background: #fff;
    box-shadow: 0 6px 20px rgb(0 0 0 / 18%);
}
```

### Custom colours

`allowCustomColor: true` adds a hex swatch to the picker. It is **off by default, and that
default is the safe one**: a token is a class your stylesheet paints wherever a band appears in
your application, whereas a hex value has no class to hang on and is applied inline.

```ts
new PerformanceBandEditor({ allowCustomColor: true });
```

Turn it on and `color` can come back as `#3a6ea5`, so anything else that renders a band by
class name has to handle that too. Existing token data is untouched — only a band someone
deliberately gives a custom colour is affected. The library decides which is which by matching
a strict hex pattern; anything else is treated as a class name and can never become a style
declaration. See [SECURITY.md](SECURITY.md).

## Data model

```ts
interface Band {
    id: string;
    color: string;
    min_value: number | string;
    label: string;
    mastery_flg: number | boolean;
}
```

The keys are snake_case because this is the shape the host hands over as
`window._performanceBand`, and the editor adopts that array rather than copying it.

`color` is a host theme token by default, and only ever a hex literal if you turned on
`allowCustomColor` and someone used it.

`min_value` admits both numbers and strings because both genuinely occur — a saved band
carries a number, a text input hands back a string. Comparison and sorting always go through a
numeric parse, and a half-typed value reads as zero rather than breaking the order.
`mastery_flg` is the same story from the other direction: persisted as `1`/`0`, handed back by
a checkbox as a boolean.

## License

MIT © NowTwo LLC. See [LICENSE](LICENSE).
