# Security Policy

## Supported versions

Only the latest published version of `@nowtwo-llc/frontend-performance-band` receives security
fixes.

## Reporting a vulnerability

Please **do not open a public issue** for a security report.

Use GitHub's private vulnerability reporting instead — go to the
[Security tab](https://github.com/nowtwo-llc/nowtwo-frontend-performance-band/security/advisories/new)
and open a draft advisory. That keeps the report private until a fix ships.

If you cannot use that, email <support@nowtwo.io>.

Please include what the issue is, how to reproduce it, and which version you tested.
We aim to acknowledge reports within a few business days.

## Scope

This is a browser UI component. It renders form inputs, makes no network calls of its own, has
no runtime dependencies, and collects nothing. The host page owns authentication,
authorisation and persistence.

The things most worth reporting:

- **HTML injection.** Values typed by the person editing the bands — labels and threshold
  values — never become markup. They are written with `value` and `textContent`, so they
  cannot be parsed as HTML.

  Exactly one value can be parsed as HTML, and it **has a way to opt out**:

  | Value | Source | Avoiding HTML parsing |
  | --- | --- | --- |
  | Icon markup | `HostBridge.icon()` | Return a `Node` instead of a string — it is cloned and inserted as-is |

  The string form is trusted by design: it comes from the host application, not from the
  person using the editor.

  If you find any path that turns *editor* input into parsed markup or executed script, that
  is a vulnerability and we want to hear about it.

- **CSS injection through a colour value.** A band's `color` reaches the DOM by one of two
  routes, and which one is chosen by a strict hex test in `src/dom/swatch.ts`:

  | Value | Route |
  | --- | --- |
  | Matches `#rgb` / `#rrggbb` | Written into an inline `background` |
  | Anything else | Written as a **class name** via `className` / `data-color` |

  The regex is the gate on the only path that produces a style declaration, so a value such as
  `red; background: url(...)` fails it and lands on the class-name branch, where it becomes an
  inert class rather than CSS. A report that any non-hex value can reach the inline branch is
  a vulnerability.

  The inline branch only ever runs when the host passes `allowCustomColor: true`; with the
  default the field is treated purely as a host theme token.

- **Form field names.** The editor's inputs post through the host's form under the names
  documented in `src/dom/fieldNames.ts`. Every field is a flat array paired up by document
  order, so a bug that makes one array shorter or differently ordered than the others silently
  attaches a band's colour, threshold or mastery flag to the wrong band. That is a
  data-integrity issue — report it.

  The mastery flag is the known trap here: it posts from a hidden input precisely because an
  unchecked checkbox posts nothing and would shift every following flag by one.

- **Supply chain.** Anything about the published artifacts, the build, or the release
  workflow — for example a discrepancy between the published tarball and the tagged source.
  Releases are published from CI using npm trusted publishing and carry build provenance,
  which you can verify with `npm audit signatures`.

Server-side handling of the posted bands is the host application's responsibility and is
outside this package's scope.
