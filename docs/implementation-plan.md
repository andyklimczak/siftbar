# Siftbar v1 implementation plan

Status: v0.1.0 implemented locally. Core, UI, distributions, examples site, optional
JavaScript integration recipes, and automated checks are in place. See
[verification.md](./verification.md) for actual results and outstanding checks.
WebKit/human accessibility checks and remote deployment are not claimed complete.

## Authority and product

The original requirements are preserved in [build-brief.md](./build-brief.md).
This plan incorporates the follow-up discussion and records implementation defaults.
[PowerSearch reference notes](./powersearch-reference.md) distinguish observed public
behavior from our choices. When this plan refines the brief, the change is explicit.

Build a polished, neutral, framework-independent structured filter bar. A consumer
supplies a schema, mounts a control, and receives versioned JSON; the library does
not require data rows or execute queries. V1 supports text, number, date-only,
boolean, and static searchable enum fields with flat AND logic.

## Decisions from discussion

- Ship attractive neutral defaults, but make both small theme adjustments and full
  visual restyling straightforward.
- Runtime dependencies are allowed when justified. Framework independence and
  no consumer build requirement remain mandatory. Prefer a small dependency budget
  rather than making zero dependencies a release gate.
- Adding a filter appends it; it never replaces another filter with the same field.
  Multiple conditions, including repeated fields, remain visible and combine with
  AND. Do not reject logically contradictory but individually valid conditions.
- Editing is a separate intentional action on an existing chip. Auto-save updates
  only that condition, preserving its ID; Escape and invalid input preserve saved state.
- Invalid configuration or programmatic state restoration throws a documented
  `SiftbarValidationError` with structured issues. Restoration is atomic and silent
  by default. Interactive validation appears inline.
- Include a public examples/playground page deployable to GitHub Pages, so visitors
  can try the library before integrating it. The same page is a local manual-testing
  surface and an automated browser-test target.
- Keep the JavaScript library compatible with a future, externally maintained Rails
  wrapper gem that exposes ERB helpers and vendors the released assets. No gem,
  Ruby code, or Rails application will be built in this repository.

## Working defaults

These are recommendations, not additional questions blocking implementation:

- TypeScript source; JavaScript ESM, declaration files, a standalone browser bundle,
  and separate CSS exports. Standalone usage requires no framework or build tool.
- Vitest for core tests and Playwright for browser flows; automated accessibility
  scans supplement, rather than replace, documented manual checks.
- MIT license, copyright Siftbar contributors; bundled Floating UI notices ship with
  the distribution. No Astryx source has been copied.
- Current modern Chromium, Firefox, and Safari as the initial browser target. Record
  exact tested versions and any missing features before release; no legacy promise.
- String enum identifiers, separate from labels: `{ value: 'active', label: 'Active' }`.
  `eq`/`neq` store one identifier, `any_of`/`none_of` store nonempty arrays of unique
  identifiers. Unknown options are invalid; preserve valid array order on restoration.
- Boolean state uses `operator: 'eq'` and a JSON boolean. The UI offers “equals true”
  and “equals false”; these are choices, not two different wire-format operators.
- Preserve text exactly, including whitespace. Empty string is a valid explicit
  text value; it is distinct from the nullable no-value operators.
- Async options/entities, custom editor APIs, wrappers, query parsing, nested logic,
  and a public local evaluator remain outside v1. Keep internal editor boundaries
  clean without prematurely promising a plugin API.

## Interaction model

Use one compact anchored editor, not a large query-builder form. The field picker
opens from the add input; typing there searches field labels and aliases only.

1. Select a field.
2. Immediately show one editable Field | Operator | Value row, wrapping on mobile.
3. Adjust the operator/value; leaving the editor auto-saves a valid draft. Enter is
   also supported for scalar/boolean/no-value conditions.
4. Append a chip and return focus to the add control.

Field/operator context remains visible and can be revisited without clearing saved
filters. Selecting another field discards the old field's draft value. Operator
changes discard incompatible drafts; compatible drafts may survive only when the
value shape and constraints remain valid, with no implicit coercion.

A configured `defaultOperator` preselects the operator; otherwise choose the first
allowed operator. Show the value editor immediately. Field/operator native selects
remain editable in the row. Boolean and nullable choices omit the entire value
column. Selection/preselection alone never commits saved state. Valid drafts save
when clicking or tabbing away; there are no Cancel/Add/Apply buttons. Untouched
blank text is incomplete, but explicitly entered empty strings remain supported.
These interactions supersede the original sequential-picker/explicit-button plan
following UI review.

Saved chips have separate edit and remove buttons, not nested interactive elements.
Opening a chip creates a detached draft. Escape abandons it; native selects retain
platform-specific picker dismissal behavior. Leaving saves valid drafts and discards
invalid ones without modifying saved filters. Explicit clear/remove, restoration,
and destroy discard drafts. Tab/Shift+Tab are not trapped; auto-save preserves the
user's destination focus, including while switching chips.

After explicit Enter/Escape, restore focus to the appropriate add/edit control.
After removal, focus a neighboring chip or the add input. Empty-input Backspace
first focuses/selects the last chip; a subsequent deliberate deletion removes it.
Native text editing shortcuts remain untouched, and IME Enter never commits.

## Styling contract

Offer three levels of customization without a CSS framework or shadow DOM:

1. **Default:** import `siftbar/styles.css` for structural rules plus the neutral skin.
2. **Theme:** override documented `--siftbar-*` variables on the mounted root for
   color, surface, border, typography, spacing, radius, focus, chips, and popup sizing.
3. **Full skin:** import `siftbar/base.css` for minimal structural/accessibility rules
   and write appearance rules against documented `.siftbar__*` classes and state
   attributes. Internal DOM nesting is not a public compatibility promise.

Use low-specificity, namespaced selectors; no global resets, inline appearance
styles, `!important`, runtime stylesheet injection, or required external fonts.
Use inherited typography and logical CSS properties. Document stable styling hooks
and states instead of requiring consumers to depend on incidental markup.

Provide system light/dark defaults and explicit per-instance theme selection.
Demonstrate neutral, dark, and an application-branded theme on the same page.
Keep full chip text available to assistive technology despite visual ellipsis.

Popup architecture must preserve instance theming. Prefer owned-subtree/top-layer
hosting where practical; if portaling is needed, retain theme scope and custom CSS
hooks explicitly. Test two differently themed instances, including their popups.
The positioning spike must verify modal dialogs, clipping, scrolling, viewport
edges, resize, zoom, first-frame placement, and cleanup before choosing a strategy.

## Public demo site and GitHub Pages

Build a small static examples site with plain HTML, JavaScript, and CSS. Examples
filter JSON data locally or pass filter state to consumer-owned API code; no table
framework is needed. The playground requires no custom backend, login, or service
credentials. Per the live-data follow-up, results now require public API availability;
controls and source panels remain usable on errors, with explicit retries.

- Landing page with a short product explanation, prominent working playground,
  getting-started snippet, and links to repository/documentation once available.
- Use only The Report of the Week for data examples, with API-compatible category,
  inclusive rating bounds, and release-date filters. Any-of categories fan out to
  supported single-category requests and merge unique results. Recheck AND/null rules.
  The other library field types remain supported in generic interaction fixtures.
- Show actual updateResults, query parameters, and fetch functions inline by default;
  do not conceal network logic in full-source tabs. Keep table internals/state tools
  optional. Remove verbose live request URLs and plumbing paragraphs from widgets.
- Fetch data only from the API. CORS is now enabled upstream; remove the earlier
  live-repository fallback and its cache. Network/HTTP/invalid-response failures show
  errors and Retry, preserving filters, with no alternate source or public proxy.
  Cancellation, retry, normalization, and rendering are app code, not library features.
- Live JSON output with copy and editable restore controls. Invalid JSON/state must
  show an understandable error and preserve the current filters.
- Progressive examples: supported review fields with basic setup first, then preset buttons, then a
  preset dropdown with Clear. Presets use plain conditions with `setFilters`; IDs
  and serialized state are not part of consumer setup. JSON tools stay collapsed.
- Additional examples for light/dark/branded styling, constrained widths and long
  labels, multiple independent instances, and scrollable/modal containers. These
  serve as both consumer examples and manual regression scenarios.
- Put a copyable configuration/code sample next to **every** live example: side by
  side on wide screens and stacked on narrow screens. Show the actual field schema,
  `new Siftbar(...)` options, and `onChange` hookup for local JSON or API results, plus
  relevant HTML/CSS. Generate focused setup/markup excerpts from marked live source;
  full demo rendering, evaluator, simulation, and persistence code stays optional.
  Readers should not need to visit another page to understand
  how that example is configured.
- Generate displayed samples from the example source where practical to prevent
  drift. Label any illustrative endpoint or omitted setup explicitly; samples must
  be usable outside the demo shell and never evaluated from user-edited text.
- Include short keyboard instructions and the library version being demonstrated.

Reuse the runnable examples rather than create a separate implementation of the
component for the site. Load the actual built library and stylesheet artifacts,
with live public data requests and application-owned adapters/evaluation. The library
constructs filters; consumer example code applies them locally or sends them to an
API. Keep site styles separate from library styles so the demos remain representative
of real integration.

Provide documented commands to build and serve the site locally. Generate a
self-contained `site-dist/` directory with relative asset/link paths that work both
at a domain root and at a GitHub project path such as `/siftbar/`; avoid SPA routing
or server rewrite assumptions. Include a `.nojekyll` file in the deployment output.

Prepare a GitHub Actions Pages workflow that builds the library/site, runs the
relevant checks, and uploads/deploys the static output using GitHub's Pages actions.
Document repository Pages settings and the eventual demo URL in the README. Enable
publishing once a remote repository exists and its owner approves/configures Pages;
this plan does not authorize creating a remote repository or publishing now.

Acceptance: visitors can try all core flows against JSON data without installation,
see configuration code beside each example, and understand the local/API boundary.
The exact same site runs locally for manual testing, and Playwright exercises the
generated site under a project-path prefix to catch missing assets and broken links.
Test local result updates, supported API query URLs, precise residual filtering,
fixed enum choices, null/zero handling, loading/errors/retry, API-only failure behavior, and
out-of-order responses using deterministic provider-shaped HTTP fixtures. Separately
record real endpoint and unmocked-browser checks; do not confuse fixture passes with
upstream availability. Report hosted verification separately from local checks; do not claim
deployment before it occurs.

## Public and core contracts

Keep the proposed `new Siftbar(element, options)` mounting convention and
`setFilters`, `getState`, `setState`, `clear`, `focus`, and `destroy` methods.
`setFilters` accepts ID-free conditions, replaces atomically, and emits by default;
`getState`/`setState` remain the advanced persistence/restoration boundary. DOM access happens
at mount time, not package evaluation. Validate before modifying the host.

Define in phase 1:

- Discriminated field schema, labels, aliases/groups, nullable setting, allowed
  operators, default operator, configurable operator labels, display formatting,
  number constraints, and static enum options.
- Operator matrix from the brief: text `eq`, `neq`, `contains`, `not_contains`,
  `starts_with`, `ends_with`; number `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`;
  date `on`, `before`, `after`, `between`; boolean `eq`; enum `eq`, `neq`, `any_of`,
  `none_of`; nullable fields additionally `is_empty`, `is_not_empty` with `null`.
- Strict JSON value shapes, inclusive ordered ranges, exclusive date before/after,
  actual calendar-date validation, and finite numbers with no silent rounding.
- Numeric step validation with a documented base (configured min, otherwise zero)
  and a strategy that handles ordinary decimal steps without arbitrary rounding.
- Version-1 AND state, nonempty string IDs, unique IDs, unknown-field/operator
  rejection, and an explicit policy for unexpected object properties. Never silently
  normalize restored state in a way that breaks exact valid-state round trips.
- Fresh IDs from a monotonic allocator that checks restored/current IDs; UI DOM IDs
  are independently instance-scoped. Editing and restoration preserve filter IDs.
- Detached snapshots; configuration/state/option arrays are never mutated.
- Structured errors with codes and property paths, including multiple restore
  issues where practical. Validate everything before assigning state.
- Change reasons `add`, `edit`, `remove`, `clear`, `set`. Callback and bubbling
  `siftbar:change` CustomEvent carry equivalent snapshots/detail. Initialization
  and `setState` without `emit: true` are silent. Define no-op behavior and delivery
  order, and isolate delivered snapshots from internal state.
- Successful clear/set cancels an open draft; invalid set leaves saved state and
  the open draft intact. Destroy is idempotent and removes only owned resources.

## Rails wrapper gem compatibility

A separate Rails gem could package assets, render helper markup/configuration, and
optionally provide a thin Stimulus adapter. All filtering UI and validation remain
in this library. The gem is outside this repository's scope, not a later phase of
this project. Work here is limited to compatible JavaScript/CSS artifacts, public
contracts, integration documentation, and JavaScript/browser fixtures.

### Assets and configuration

- Release a self-contained browser ESM artifact suitable for Rails importmap and
  a standalone script bundle for asset-pipeline/script-tag usage, plus separately
  addressable default/base CSS. Bundle any runtime dependencies into these browser
  artifacts; consumers must not need Node, a CDN, bare dependency imports, or a
  JavaScript bundler. Keep ordinary package ESM usable with jsbundling as well.
- Use stable documented artifact paths and include a version/license record so the
  gem can vendor a specific release. Assets must tolerate fingerprinted URLs and
  subpath hosting; do not fetch sibling files using hardcoded package paths.
- Support a fully JSON-serializable configuration subset covering every built-in
  field/editor: schemas, labels, aliases/groups, options, constraints, operator
  selection/labels, themes, and saved state. JavaScript callbacks/formatters remain
  optional enhancements, not prerequisites for ERB-generated configuration.
- Keep mounting explicit. A helper can render a host element with safely escaped
  JSON in data attributes and the adapter can parse it before constructing Siftbar.
  Avoid mandatory inline scripts/handlers, `eval`, or automatic global DOM scans.
  Document Rails escaping for HTML attributes; never suggest raw JSON as HTML-safe.
- Document CSP requirements, including any runtime positioning style requirements.
  Do not claim compatibility with all strict style policies without testing them.

### Forms and events

- Work inside existing Rails forms. Internal action buttons use `type="button"`;
  draft editor controls do not accidentally contribute named form parameters or
  submit the enclosing form when Enter is used to commit a filter.
- Leave the host's attributes and consumer-owned siblings/hidden inputs intact.
  Own a clearly bounded UI subtree and remove only owned markup on destroy.
- A helper/adapter may maintain a named hidden input containing the versioned filter
  JSON for ordinary form submission. Core Siftbar does not assume a Rails parameter
  name, route, CSRF token source, or request transport.
- Bubbling `siftbar:change` events allow adapters to sync the hidden input and trigger
  consumer actions without requiring an `onChange` function in serialized options.
  On mount and silent `setState`, the adapter explicitly syncs from `getState()`;
  silent restoration must not cause an unexpected request or form submission.
- Rails backend code independently validates/allowlists fields, operators, and
  values and parameterizes queries. A gem helper does not make received JSON safe
  for SQL or replace authorization. Requests and Rails CSRF handling belong to the
  consumer or optional adapter, never the core library.

### Turbo and Stimulus lifecycle

- A thin controller mounts in `connect()` and destroys in `disconnect()`, guards
  against duplicate mounting, and handles reconnecting the same element.
- Before `turbo:before-cache`, persist committed state to consumer-owned markup
  (for example the hidden input), cancel drafts, and destroy owned UI so cached
  snapshots contain no stale chips/popups or initialization markers. Remount and
  silently restore that state on return. Account for a canceled navigation where
  the current page must become usable again after cache cleanup.
- Support Turbo Frame replacement, repeated visits, cached back/forward restoration,
  multiple controls, and use inside forms/modal containers without leaked listeners,
  observers, popups, or cross-instance state. Adapters own their Turbo listeners.
- Do not require Stimulus or Turbo for ordinary mounting; keep this integration
  optional and demonstrate the same public lifecycle methods plain JS uses.

Provide documentation showing ERB configuration patterns and a small JavaScript
Stimulus integration example alongside the plain-JS docs; these are integration
recipes, not a shipped gem, Ruby helper implementation, or Rails application. Test
escaped configuration, hidden-input synchronization, form behavior,
mount/destroy/remount, and state preservation in JavaScript/browser fixtures.
Use real Turbo navigation tests where feasible; distinguish them from simulated
lifecycle checks. Document which asset-loading paths have actually been exercised.
The external gem's maintainers own its implementation, packaging, Rails tests, and
Rails-version support; none of those are deliverables or release gates here.

## Architecture

- `src/core/`: schema, operator definitions, values, validation, state, formatting
  helpers that do not require the DOM.
- `src/ui/`: instance controller, interaction reducer/state machine, picker, editor,
  chips, focus/announcements, and positioning adapter.
- `src/styles/`: structural base and neutral theme.
- `tests/unit/`: core and non-DOM package import tests.
- `tests/browser/`: built-artifact interaction, accessibility, layout, lifecycle tests.
- `examples/vanilla/`: progressive review/preset views, optional state tools, themes,
  app-owned evaluator/renderer, and displayed configuration source.
- `examples/integration/`: external Stimulus lifecycle and custom-backend fetch recipes.
- `examples/report-of-week/`: review fields, fixed category enum, API query translation,
  and direct API fetching with errors/retry, without alternate data sources.
- `site/`: public demo landing page and example navigation, reusing runnable examples.
- `scripts/`: library/site artifact assembly and local serving where needed.
- `site-dist/`: generated, self-contained Pages output; not hand-edited source.
- `.github/workflows/pages.yml`: build/check/deploy workflow, activated when hosting
  is approved and configured.

Represent closed, field picking, and combined-row editing explicitly,
with separate create/edit modes and a stable edit ID. Rendering must not itself
commit saved state. Use safe DOM text APIs for every label/value; never evaluate
strings or accept raw HTML as a default formatting output.

Isolate positioning behind an internal adapter. Evaluate native popovers and
`@floating-ui/dom` against the browser/modal/theming requirements. A small bundled
positioning dependency is acceptable if it meaningfully reduces risk. Record its
license and bundle impact; do not adopt a general UI framework.

## Implementation phases and acceptance gates

### Phase 1 — Contracts, scaffolding, and targeted spikes

- Establish schema/operator/state/error types and unit tests.
- Set up TypeScript, build, Vitest, Playwright, lint/typecheck, and artifact layout.
- Establish shared example/site assembly and local serving commands so the early
  vertical slice can become the public playground without a rewrite.
- Spike popup positioning/theming/modal behavior and choose the dependency strategy.
- Specify event semantics, step constraints, mounting ownership, and lifecycle.
- Establish self-contained browser artifacts and the JSON-only configuration subset
  needed by ERB helpers; include host/form ownership in the lifecycle contract.

Gate: core validates all five types, rejects invalid restores atomically, preserves
valid JSON snapshots, and imports without a DOM. Popup strategy has real-browser
proof for the hard hosting cases rather than a purely theoretical design.

### Phase 2 — Complete text vertical slice

- Build field search, operator selection, value input, auto-save, chip rendering,
  edit/Escape cancellation, removal, clear, restore, and live JSON.
- Include accessible semantics, keyboard selection, Escape, focus restoration,
  native editing keys, and IME protection from the start.
- Begin testing the browser distribution immediately, using the shared demo page
  that will also be served locally and published to GitHub Pages.

Gate: mouse and keyboard can independently complete the entire text lifecycle;
invalid edits never alter saved filters, and repeated fields append correctly.

### Phase 3 — Remaining types

- Add number/date scalar and range editors with clear validation errors.
- Add boolean choices, searchable enum single/multi-selection, nullable operators.
- Test zero, false, empty text, no-value choices, constraints, and malicious strings.

Gate: every type creates, edits, cancels, serializes, and restores correctly.

### Phase 4 — Interaction, accessibility, and lifecycle hardening

- Complete chip keyboard behavior and announcement policy.
- Verify Tab, nested Escape, pointer/touch dismissal, visible focus, and reduced motion.
- Test multiple instances, repeated mounting/destruction, callback/event payloads,
  defensive copying, pending positioning work, observers/listeners, and cleanup.
- Test narrow layouts, long labels, scrolling, modals, viewport collisions, and zoom.
- Add Rails-shaped form/configuration fixtures and lifecycle tests for hidden-input
  sync, Turbo-style replacement/cache restoration, and duplicate-mount prevention.
  Exercise real Turbo when available and label simulated checks explicitly.
- Run automated accessibility checks; record manual keyboard/screen-reader coverage.

Gate: no cross-instance interference, unintended draft commits, focus traps, or
inaccessible offscreen editor controls in tested layouts.

### Phase 5 — Theming, examples, packaging, and documentation

- Finish neutral stylesheet, base export, variables/hooks, and theme examples.
- Build progressive Report of the Week demos with category/rating/date queries,
  presets, restore/clear, rows/counts, and optional state tools. Show HTTP handlers
  inline; no repository fallback, unrelated API, or bundled records.
- Keep the demo evaluator separate; document text case sensitivity and the demo's
  chosen definition of empty, with tests for boundary behavior.
- Add standalone script and ESM usage, server-consumer example, ERB configuration
  and thin Stimulus examples, importmap/asset-pipeline guidance, Turbo lifecycle
  guidance, security boundary, field/operator tables, event/error docs, and licenses.
- Document artifact vendoring/versioning for the future gem, safe JSON escaping,
  hidden-input form integration, and which Rails-related paths are verified.
- Verify package exports, declaration consumption, CSS paths, and packaged files.
- Finish the public examples site, JSON copy/restore controls, presets, test scenarios,
  version display, and a source-backed, copyable configuration sample beside every
  example. Generate self-contained Pages artifacts.
- Add the Pages workflow and local/hosting instructions; link the hosted demo in the
  README once its URL is known and deployment is approved.

Gate: a plain HTML consumer can use the shipped build without installing a framework
or compiling application code, and can restyle it using documented hooks. The public
playground runs locally and builds into deployable GitHub Pages output.

### Phase 6 — Release-candidate verification

- Run typecheck, lint, unit tests, build, browser tests, and package-artifact checks.
- Exercise built output in Chromium, Firefox, and WebKit where available.
- Run browser smoke tests against the generated demo site at a GitHub-style project
  path, including assets, navigation, JSON restore, and interactive examples. Verify
  the hosted page separately if deployment has been approved and completed.
- Confirm framework-free bundle contents, dependency licenses, and bundle size.
- Verify browser ESM/standalone artifacts need no external dependency resolution,
  and record Rails-wrapper compatibility fixture results without claiming an unbuilt
  gem or untested Rails versions are supported.
- Record actual commands, versions, outcomes, manual checks, and untested limitations.

Gate: satisfy the brief's definition of done. No npm publication or remote repository
creation without explicit approval.

## Next step

Try the implemented site with `npm run dev`. Complete the remaining browser and
human checks recorded in verification.md before treating this as a release-certified
build. Hosting/publication remains a separate approval step. An external Rails gem
is not part of this repository's implementation or remaining work.
