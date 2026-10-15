# Siftbar

**A framework-free, typed filter bar for the web.**

Select a field, choose an operator, enter a value, and get an editable filter chip.
Siftbar builds and edits the filters. Your application decides how to filter local
data or query a backend. Repeated fields are allowed; all conditions combine with AND.

TypeScript-authored JavaScript, no UI framework, and no consumer build requirement.
A small Floating UI positioning dependency is bundled into the browser artifacts.

## Try it / develop locally

This project has not been published to npm or deployed to GitHub Pages yet.

```sh
npm ci
npm run dev
# http://127.0.0.1:4173/siftbar/
```

The examples site progresses from **basic setup → preset buttons → preset dropdown
and Clear**, followed by The Report of the Week API, themes, and a native modal.
The data examples use API-compatible category, rating, and release-date filters.
Setup and actual `updateResults`/HTTP functions are shown inline, with separate copy
buttons; rendering internals and state tools stay optional. Other library field types
remain supported and covered by the interaction fixtures.
The examples use public data services; no custom backend runs in this repository.

### Live example data

All data examples request `https://thereportoftheweekapi.com/api/v1/reports/` using
`category`, `min_rating`, `max_rating`, `min_date`, and `max_date`. An enum “is any of”
selection makes one supported category request per value, then merges/deduplicates
results. Exact local AND checks preserve repeated-condition and null/zero semantics.
The page shows counts and essential status, not live request URLs or plumbing prose.

All results come directly from the API, which now supports cross-origin browser
requests. There is no repository JSON, alternate-source cache, or offline fallback.
Network, HTTP, and invalid-response errors show an error and Retry while preserving
the selected filters. No public proxy is used.

There are no bundled production sample records or silent offline substitutions.
Loading/errors/retry are visible, and an outage does not prevent using the controls
or reading setup code. An internet connection is required for example results;
automated tests intercept these URLs with provider-shaped fixtures for reproducibility.
Allow the relevant hosts in your application's `connect-src` CSP if using these
example adapters. Siftbar itself does not fetch data or require network access.

Other commands:

```sh
npm run typecheck
npm run check:package           # packs/extracts in a temp directory; checks types/imports
npm run lint
npm run build
npm test                       # builds artifacts, then runs core tests
npx playwright install chromium firefox webkit
npm run test:browser            # builds the site, then tests all three browser engines
# If a browser is unavailable locally, select explicitly and report the omission:
BROWSERS=chromium,firefox npm run test:browser
npm run build:site
npm run preview                # serve the generated static site
npm pack                       # builds and packages the library; does NOT publish
```

Development requires Node 22.19+ (or a supported newer Node release). The package
verification script also uses `tar` to inspect the packed artifact. A consuming
page needs only a modern browser, not Node.

## Mounting

From an installed/local package:

```js
import { Siftbar } from 'siftbar';
import 'siftbar/styles.css';

const filters = new Siftbar(document.querySelector('#filters'), {
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'ram_gb', label: 'RAM', type: 'number' },
    { key: 'online', label: 'Online', type: 'boolean' },
  ],
  onChange: updateResults,
});
```

`updateResults` is your application's results or search-request handler, not another
Siftbar helper. Siftbar calls it when committed filters change. It receives the current
filters in the callback payload; your application decides how to apply them.
You do **not** need to construct IDs, store filter state, manage JSON, or call
`getState`/`setState` for normal use. Those APIs are for optional persistence,
restoration, and advanced integration—not required setup.

The demo's `evaluate.js` is application-specific local filtering code, not a required
configuration module or a public library export.

For a plain page, copy the artifacts to your assets directory:

```html
<link rel="stylesheet" href="/assets/siftbar/styles.css">
<div id="filters"></div>
<script defer src="/assets/siftbar/siftbar.browser.js"></script>
<script defer src="/assets/my-filters.js"></script>
```

`my-filters.js` can use `new window.Siftbar(...)`. The standalone script also exposes
`window.SiftbarLibrary`, including `SiftbarValidationError`. Alternatively use an
external module importing `Siftbar` from the self-contained `siftbar.js` file.
See `examples/vanilla/standalone.html` and `examples/vanilla/index.html`.

Importing ESM is safe without `document` or `window`. DOM access begins at mount.
A host may have only one mounted Siftbar; destroy it before remounting. Siftbar appends
an owned subtree and preserves existing host attributes, children, and siblings.
All internal action buttons are non-submit buttons. Editor inputs have no names.

## Presets and clearing

Start with the basic setup above. To add a preset, provide ordinary conditions—no
IDs, version numbers, or serialized state objects:

```js
document.querySelector('#workstations').addEventListener('click', () => {
  filters.setFilters([
    { field: 'ram_gb', operator: 'gte', value: 32 },
    { field: 'online', operator: 'eq', value: true },
  ]);
});
document.querySelector('#clear').addEventListener('click', () => filters.clear());
```

For a dropdown, store these lists under preset names and call
`filters.setFilters(presets[event.target.value])` in its change handler. The examples
show both approaches with ordinary HTML controls; there is no separate preset API
or controller to learn.

`setFilters(conditions, { emit = true })` replaces all conditions, generates IDs,
validates atomically, and calls your change handler automatically. It supports
repeated fields and copies supplied values. Pass `{ emit: false }` only when you
intentionally want a silent update. Invalid conditions preserve saved filters and
the active draft; explicit `id` properties are rejected. `FilterCondition` is exported
for TypeScript callers. `clear()` emits when there are saved filters to remove.

## Configuration

Options: `fields` (required), `label`, `placeholder`, `theme` (`system`, `light`,
`dark`), optional `messages`, and optional `onChange(state, detail)`. Configuration is defensively copied.
Initialization never emits a change.

Every field has a unique nonempty `key`, nonempty `label`, and a `type`:

| Type | Value | Optional settings |
| --- | --- | --- |
| `text` | JSON string, preserved exactly | — |
| `number` | Finite JSON number | `integer`, `min`, `max`, positive `step`, display `suffix` |
| `date` | Actual date as `YYYY-MM-DD` | Date-only, years 0001–9999; no time/timezone |
| `boolean` | JSON boolean | UI presents “equals true” / “equals false” |
| `enum` | String identifier or array of identifiers | Required static `options: [{ value, label }]` |

Shared field settings:

- `aliases: string[]` for field-name search; `group: string` for headings.
- `nullable: true` enables empty/not-empty operators.
- `operators: OperatorId[]` restricts and orders supported operators; must be nonempty
  and duplicate-free. Types always constrain allowed operators.
- `defaultOperator` preselects the operator after field selection; otherwise the first
  allowed operator is selected. Preselection never commits a filter.
- Equality defaults to “equals” (`eq`) and “does not equal” (`neq`).
- `operatorLabels: { [operatorId]: string }` changes labels, never serialized IDs.
- `formatValue(value)` optionally returns plain display text. Formatting affects
  chips only; built-in operation requires no functions in configuration.

Native number/date inputs are used. Core validation additionally rejects invalid
calendar dates, non-finite numbers, incompatible types, and constraints; values are
never silently rounded. Numeric `step` is anchored at `min`, otherwise zero. Only
floating-point representation error is tolerated when checking step alignment.
Numbers use JavaScript's IEEE-754 precision; arbitrary-precision decimals/integers
are not supported.

Text, including whitespace and `""`, is preserved. Empty string is a valid explicit
text value, not an automatic nullable condition. An untouched blank text draft is
not auto-saved; type and clear the input, or press Enter, to explicitly save `""`.
Field-search input is navigation, not a free-text filter.

Enum identifiers are strings, independent from display labels. Single choices store
one identifier. Multi-choices store a nonempty, duplicate-free array with order
preserved. Search matches option labels; it does not fetch suggestions. Unlike `text`,
an enum only accepts one of the predefined values; arbitrary or case-changed strings
are rejected, including through programmatic presets/state restoration.

For example, a review category is a constrained string:

```js
{ key: 'category', label: 'Category', type: 'enum', options: [
  { value: 'Running On Empty', label: 'Running On Empty' },
  { value: 'Energy Crisis', label: 'Energy Crisis' },
  { value: 'Drink Review', label: 'Drink Review' },
] }
```

The Report of the Week examples use the six categories accepted by its API. Dataset-only
categories remain visible in unfiltered rows but are not offered as API filter choices.
Options sit directly beneath the Value control. For `any_of`/`none_of`, selected values
appear as chips inside that control with individually labeled × removal buttons.
Removing values edits the draft; clicking/tabbing away saves a valid selection, while
Escape or an empty/invalid selection preserves the previously saved filter.

## Messages and localization

Pass a plain `messages` mapping to override built-in text, including controls,
validation feedback, operator/type labels, and accessibility announcements:

```js
const filters = new Siftbar(document.querySelector('#filters'), {
  fields: [{ key: 'name', label: 'Nombre', type: 'text' }],
  messages: {
    label: 'Filtros',
    placeholder: 'Añadir un filtro…',
    clear: 'Limpiar',
    clearLabel: 'Limpiar filtros',
    editFilterLabel: 'Editar {filter}',
    filterAdded: 'Filtro añadido: {filter}.',
    operators: { eq: 'es', contains: 'contiene' },
    fieldTypes: { text: 'texto' },
    validation: { minimum: 'El mínimo es {min}.' },
  },
});
```

Omitted keys inherit English defaults **one key at a time**, including nested
mappings. This example is partial; supply the full catalog for a completely
translated UI. `DEFAULT_MESSAGES`, `SiftbarMessages`, and `SiftbarMessageOverrides`
are exported for discovering keys and checking TypeScript configuration.

Templates use named parameters such as `{filter}`, interpolated once as plain
text. No functions, HTML, translation dependency, or locale detection are needed.
Unknown keys/parameters, empty strings, and invalid values are rejected before
mounting with a precise `SiftbarValidationError` path. Existing top-level `label`
and `placeholder` override message defaults; field `operatorLabels` override
message operator labels. Saved state and event/callback payloads are unchanged.
Programmer-facing API/configuration diagnostics remain English.

See the [complete message catalog, parameters, and precedence rules](docs/messages.md).

## Operators

| Field | Operator IDs |
| --- | --- |
| Text | `eq`, `neq`, `contains`, `not_contains`, `starts_with`, `ends_with` |
| Number | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between` |
| Date | `on`, `before`, `after`, `between` |
| Boolean | `eq` with `true` or `false` |
| Enum | `eq`, `neq`, `any_of`, `none_of` |
| Any explicitly nullable field | additionally `is_empty`, `is_not_empty` |

Number/date `between` stores an ordered two-element array and is inclusive. Date
`before`/`after` are exclusive. Empty/not-empty stores exactly `null`; it never
confuses `0` or `false` with emptiness. Your backend defines whether “empty” means
null, missing, empty string, or another domain rule.

Siftbar has no core evaluator. The example-only evaluator defaults to case-insensitive
text matching, with `caseSensitive: true` available, and considers null/missing/empty
string empty. It uses actual booleans, not JavaScript truthiness for boolean matching.

## Advanced: saved state and validation

```json
{
  "version": 1,
  "combinator": "and",
  "filters": [
    { "id": "filter-1", "field": "name", "operator": "contains", "value": "Andy" },
    { "id": "filter-2", "field": "ram_gb", "operator": "gte", "value": 32 }
  ]
}
```

No labels, callbacks, DOM, Dates, or backend expressions belong in saved state.
Filter IDs are nonempty strings and unique within a state. Fresh IDs are `filter-N`
with a per-instance increasing counter that skips IDs restored or previously issued
in that instance. IDs survive edits/restoration; generated DOM IDs are instance-scoped.

```js
const saved = filters.getState(); // Detached snapshot; safe to mutate or serialize.
filters.setState(JSON.parse(JSON.stringify(saved))); // Silent by default.
filters.setState(saved, { emit: true });
filters.clear();                  // Emits by default if filters were present.
filters.clear({ emit: false });
filters.focus();                  // Focus/open the add-field picker.
filters.destroy();                // Idempotent; removes owned DOM and listeners.
```

All restoration validates before assignment. Unknown fields/operators, duplicate IDs,
wrong version/combinator, unexpected state/filter properties, missing/wrong values,
invalid ranges, and invalid enum identifiers throw `SiftbarValidationError` with
`issues: [{ code, path, message }]`. Existing saved state and an active draft remain
intact on rejection. Successful clear/set cancels the draft. Snapshots and supplied
arrays are not mutated. Calling methods other than destroy after destruction throws.

`validateSchema`, `validateState`, `isCalendarDate`, `operatorsFor`,
`supportedOperators`, `OPERATOR_LABELS`, and `DEFAULT_MESSAGES` are also exported. Pass validated schema
from `validateSchema` into `validateState` when using these helpers directly.

## Events

Every emitted change dispatches a bubbling `siftbar:change` CustomEvent on the host:

```js
host.addEventListener('siftbar:change', ({ detail }) => {
  console.log(detail.state, detail.reason, detail.filterId);
});
```

Reasons: `add`, `edit`, `remove`, `clear`, `set`. `filterId` accompanies individual
condition changes. The DOM event is dispatched before `onChange`; callback and event
receive separate snapshots of the same transition, isolated from internal state.
Multiple listeners on the same DOM event naturally share its event payload.

Creation/removal/edit each emits once. Draft changes and cancellation never emit.
Initialization and default `setState` are silent. Explicit `setState(..., {emit:true})`
emits even for identical state. `setFilters` emits a `set` change by default, even
for an identical condition list; clearing an already empty bar does not emit.

## Interaction and accessibility

- Search fields by label/alias; arrows navigate pickers, Enter selects.
- Selecting a field opens an editable **Field | Operator | Value** row immediately,
  with an allowed operator preselected. The row wraps on narrow screens.
- Boolean and no-value operators (such as “is not empty”) show only **Field | Operator**;
  no unnecessary value column or placeholder is rendered.
- There are no Cancel/Add/Apply buttons. Clicking or tabbing away saves a valid draft.
  Invalid/incomplete drafts are discarded without changing saved filters.
- Field/operator use native selects. Enter moves from Field to Operator, then to the
  value input; for boolean/no-value choices, Operator Enter commits directly.
- Enter in text/number/date value inputs validates and commits. Enum Enter selects
  or toggles an option; click or tab away to commit selections.
- Click or keyboard-activate a chip to edit. Leaving saves only that chip, retaining
  its ID. Escape cancels the draft and preserves the original.
- An empty add input's Backspace focuses the last chip; a second Backspace removes it.
  Delete removes a focused edit chip. Each chip also has a labeled remove button.
- Native text editing keys are retained; IME Enter never commits.
- Tab/Shift+Tab are not trapped. Auto-save does not pull focus away from the user's
  destination; Escape cancellation returns focus to the opener.
- Clear/removal, successful state restoration, and destroy explicitly discard drafts
  instead of auto-saving them. Programmatic Turbo teardown likewise discards drafts.
- Popovers stay in the instance subtree and use the native top layer where available,
  preserving modal focus context and theme variables. Floating UI positions/clamps
  them on scroll/resize. Chips wrap and truncate only visually.

Automated axe scans and keyboard browser tests are included. They do **not** establish
complete accessibility; use `docs/manual-checks.md` for human keyboard, screen-reader,
touch, zoom, and reduced-motion checks. See `docs/verification.md` for actual coverage.

## Styling

Import `siftbar/styles.css` for the default theme. Override variables on the instance:

```css
.my-filter-host .siftbar {
  --siftbar-focus-color: #7053b8;
  --siftbar-chip-bg: #f1edfa;
  --siftbar-chip-text: #493477;
  --siftbar-radius: 16px;
  --siftbar-font-family: inherit;
}
```

Public variables: `--siftbar-surface`, `--siftbar-text`, `--siftbar-muted`,
`--siftbar-border`, `--siftbar-chip-bg`, `--siftbar-chip-text`,
`--siftbar-option-active`, `--siftbar-focus-color`, `--siftbar-error-color`,
`--siftbar-radius`, `--siftbar-chip-radius`, `--siftbar-gap`, `--siftbar-padding`,
`--siftbar-font-family`, `--siftbar-font-size`, `--siftbar-shadow`,
`--siftbar-popup-width`, `--siftbar-editor-width`, `--siftbar-popup-z`,
`--siftbar-list-height`. The field picker and two-column editor default to 380px;
the three-column editor defaults to 720px. All are clamped to the viewport. `--siftbar-editor-width` controls the editor
independently; an explicit `--siftbar-popup-width` also applies to the editor unless
its width is overridden.

Import `siftbar/base.css` **instead** for a complete custom skin. Stable hooks:
`.siftbar`, `.siftbar__bar`, `.siftbar__chip`, `.siftbar__chip-edit`,
`.siftbar__chip-remove`, `.siftbar__add`, `.siftbar__clear`, `.siftbar__popup`,
`.siftbar__heading`, `.siftbar__context`, `.siftbar__context-button`,
`.siftbar__editor-row`, `.siftbar__editor-row--no-value`, `.siftbar__field-select`,
`.siftbar__operator-select`, `.siftbar__value-cell`,
`.siftbar__label`, `.siftbar__picker-input`, `.siftbar__value-input`,
`.siftbar__values`, `.siftbar__list`, `.siftbar__option`, `.siftbar__type`,
`.siftbar__group`, `.siftbar__error`, `.siftbar__selection`, `.siftbar__enum-control`,
`.siftbar__enum-dropdown`, `.siftbar__enum-tokens`, `.siftbar__enum-chip`,
`.siftbar__enum-chip-label`, `.siftbar__enum-chip-remove`.

States: root `data-theme`; option `data-active`/`aria-selected`; input
`aria-invalid`; popup `data-positioned` and `data-step="field"|"value"`. Internal nesting is not a compatibility
promise. No global reset, shadow DOM, external fonts, or runtime CSS injection.

## Rails / server-rendered integration boundary

No Rails gem, Ruby helper implementation, or Rails app is built here. An external
gem can vendor `dist/siftbar.js`, `siftbar.browser.js`, `styles.css`/`base.css`, version
metadata, and license files. The browser builds are self-contained and work at
fingerprinted asset URLs; no runtime dependency imports, sibling asset fetches, CDN,
Node, or consumer compilation are required. Importmap can pin the browser ESM file;
ordinary JavaScript bundlers can also consume package ESM.

All built-in configuration can be plain JSON. A helper could render escaped config:

```erb
<%# Integration pattern only; no siftbar helper is shipped here. %>
<%= tag.div data: { controller: "siftbar", siftbar_config_value: config.to_json } do %>
  <%= tag.div data: { siftbar_target: "host" } %>
  <%= hidden_field_tag :filters, saved_state.to_json,
        data: { siftbar_target: "state" } %>
<% end %>
```

Use Rails tag helpers' attribute escaping, **not** `raw` or `html_safe` on JSON.
An external Stimulus adapter parses that JSON, constructs Siftbar, and syncs the
hidden input from bubbling change events. After initial/silent restoration, it syncs
explicitly from `getState()`. See the JavaScript recipe in
`examples/integration/stimulus-controller.js`.

Destroy on controller disconnect and before Turbo caches the page; persist only
committed state in consumer-owned markup first. Remount and silently restore on
reconnection/return, including Turbo Frame replacement. Avoid duplicate mounting;
never cache generated chips/popups as though they were fresh server markup. Actual
Rails-version and gem packaging support belongs to the external gem's maintainers.

## Security and CSP

Labels, values, and formatter results render as text, not HTML. Strings are never
evaluated as code. Your server must independently validate fields/operators/values,
authorize access, parameterize queries, and apply CSRF protections. Siftbar JSON is
not SQL and does not grant permissions. API transport belongs to your application.

The library needs no eval, inline script handlers, embedded credentials, external
requests, or stylesheet injection. It does set individual inline positioning style
properties (`left`, `top`, `maxWidth`, `maxHeight`) at runtime. Check your CSP/style
policy; compatibility with every strict policy is not claimed. The static guide's
layout is illustrative and not a CSP integration test.

## Distribution and GitHub Pages

`npm run build` emits browser ESM/script files with source maps, declarations, CSS,
version metadata, and bundled dependency license notices. `npm pack` packages only
the library artifacts, README, message reference, and license; examples/site are not runtime dependencies.

`npm run build:site` produces `site-dist/`, including `.nojekyll` and a public
`license.txt`, with relative URLs working at a domain root or any repository path
such as `/siftbar/`. No custom base URL, router rewrites, or committed build output
are needed. `.gitignore` excludes generated assets, dependencies, test output,
local environment files, logs, and editor files; keep `package-lock.json` committed.

To publish after pushing this repository to GitHub:

1. Open **Settings → Pages → Build and deployment** and select **GitHub Actions**.
2. Push changes to **master**; the deployment workflow runs automatically.
   You can also use **Actions → Deploy examples to GitHub Pages → Run workflow**.
3. Approve the `github-pages` environment if repository rules require it.
4. Open the URL shown by the deployment, normally `https://<owner>.github.io/<repo>/`.

The workflow deploys automatically on pushes to **master**, with manual runs also available.
Pushes to other branches do not automatically deploy.
It installs Node 22 and all three Playwright browsers/system dependencies, runs the
complete checks, uploads `site-dist/`, and deploys only after a successful build.
Deployment permissions are scoped to the deploy job; failed checks retain browser
diagnostics for seven days. No extra secrets or personal access token are required
for a standard Pages deployment. The browser examples call the public review API.

Local preview uses `npm run build:site && npm run preview`. No remote repository or
Pages deployment has been created/run by this implementation; hosted verification
and adding the final demo URL remain separate steps.

## Limitations and license

V1: flat AND, five built-in types, static enum options, date-only values. No async
entity suggestions, custom-editor plugin API, wrappers, parser, SQL generation,
network requests in core, table framework, or inferred fields. Modern browsers are
the target; native popovers are preferred, with a fixed-position fallback that does
not promise clipping escape in older browsers.

[MIT](LICENSE), copyright Siftbar contributors. Floating UI is MIT and its notices ship with
the browser artifacts. This is an independent implementation of the PowerSearch
interaction concept, not a Meta component or copied Astryx source.
