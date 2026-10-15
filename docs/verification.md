# Verification — Siftbar 0.1.0

Local implementation only. No npm publication, remote repository creation, or
GitHub Pages deployment has been performed.

## Environment

- Node 22.19.0; npm 11.15.0; TypeScript 5.9.3; esbuild 0.28.2; Vitest 5.0.4.
- Playwright 1.64.0; axe integration 4.13.0.
- Chromium 156.0.8078.4 and Firefox 157.0 launch successfully.
- WebKit 27.2 is downloaded but cannot launch: missing `libicu74`, `libxml2`,
  `libflite1`, and unsupported-OS fallback. No system libraries were changed.
- Floating UI DOM 1.8.0 is the only direct runtime dependency, bundled into browser
  artifacts. Stimulus 3.2.2 and Turbo 8.0.23 are test/dev dependencies only.

## Checks

Command: `BROWSERS=chromium,firefox npm run check`

- TypeScript and ESLint pass.
- 80 unit tests pass.
- 120 browser tests pass (60 scenarios per engine), including axe scans.
- Real npm pack extraction, DOM-free Node import, and a separate TypeScript consumer
  verify the package exports, styles, licenses, declarations, and preset API.
- Previous npm audit reported zero vulnerabilities.

Tests load built artifacts. Coverage includes all five library types, repeated
fields, validation, atomic restoration, defensive copies, IDs, lifecycle teardown,
keyboard/IME guards, create/edit/remove/clear, events/callbacks, theme independence,
modal forms, range layout, and accessibility states. Auto-save checks cover outside
click/Tab, single emissions, destination focus, untouched versus intentional empty
strings, invalid drafts, Escape, and the Firefox chip-switching pointer/focus race.
Equality labels remain “equals” / “does not equal” without changing wire IDs.

Enum follow-up checks verify dropdown bounds within the Value column, selected chips
inside Value for any_of/none_of, individually labeled removal buttons, keyboard
removal, preserved focus, no early save/form submit, Escape, empty-selection discard,
search/no-match behavior, safe HTML-looking labels, mobile wrapping, and axe checks.

## Examples

All data examples now use The Report of the Week API. The earlier DummyJSON examples
and fixtures were removed; data fields/operators are constrained to supported API
category, inclusive rating bounds, and release-date queries. Any-of categories make
one supported request per value, merge/deduplicate, and recheck exact AND/null rules.
Other library field types remain supported by the generic interaction fixtures.

The site leads with basic → preset buttons → dropdown/Clear, then API, themes, and
modal examples. Data widgets contain counts and essential status, not request URLs
or long plumbing explanations. Six setup/HTML snippets execute with app-supplied
handlers. Four source-backed results snippets execute independently against real
fetch calls intercepted with provider-shaped HTTP fixtures. Handler/query/HTTP code
is visible inline, separately copyable, and stays visible across setup/full-source
tab changes. Rendering internals and state tools remain optional.

Provider fixtures contain eight representative reviews, not production bundled
records. They cover API parameters, supported operator lists, empty responses,
null/zero handling, request fanout, stale-response prevention, errors/retry using
current filters, section permalinks, and API-only failure behavior with no repository requests.
Fixture passes do not prove upstream availability.

Following the upstream CORS fix, real endpoint checks verified Access-Control-Allow-Origin: *.
Unmocked Chromium and Firefox loaded 1,149 initial reviews and 50 for Energy Crisis +
rating>=8 directly from the API, without repository requests or page errors. The
repository fallback, cache, and provenance wrappers were then removed; fetchReports
returns normalized API records directly. Network/HTTP/malformed-response regressions
verify errors propagate and Retry uses current filters without another data source.
Updated dark
desktop/mobile enum chip/dropdown and inline-handler screenshots were inspected;
360px layout had no document-level overflow. These are spot-checks, not permanent
visual baselines.

Actual Stimulus/Turbo fixtures cover escaped configuration, hidden-input sync,
committed-state cache restoration, and Turbo Frame replacement. These are JavaScript
fixtures, not Rails application/gem tests.

## Distribution and limits

Browser artifacts are self-contained, minified, with source maps, separate CSS,
declarations, version metadata, and MIT notices. Package checks print raw/gzip sizes.
Only library files, README, and licenses are packed, not examples/dev tooling.
Pages-ready assets build into site-dist/ with relative paths and .nojekyll. Public
review results require network access; the Pages workflow runs on pushes to master
and supports manual runs.
Local root/project-path tests verify built assets and .nojekyll.
The workflow uses Node 22 on Ubuntu 24.04, installs all browser dependencies,
retains failure diagnostics, and grants deployment permissions only to the deploy job.
.gitignore checks verify generated/local files are excluded while source, lockfile,
license, workflow, and environment templates remain versionable. The workflow has not
run on GitHub and hosted serving remains unverified.

Not claimed tested: WebKit/Safari on this host; human screen-reader/touch/IME/zoom/
forced-colors certification; all CSP/custom-skin combinations; older browsers;
private backend authorization; upstream CORS changes or future service availability;
actual Rails pipelines/Ruby/gem compatibility; heap profiling; hosted deployment
or npm publication. Runtime positioning uses inline style properties. The review
API currently permits cross-origin requests; future outages or CORS regressions are
reported as errors rather than hidden by alternate data sources.
