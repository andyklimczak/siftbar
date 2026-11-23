# Development and examples

Requires Node 22.19+ (or a supported newer release). Package verification also
uses `tar`. Consuming pages need only a modern browser, not Node.

```sh
npm ci
npm run dev
# http://127.0.0.1:4173/siftbar/
```

## Commands

```sh
npm run typecheck
npm run lint
npm run build                  # ESM, browser script, CSS, types, licenses
npm test                       # Build, then core tests
npm run check:package          # Build, pack/extract, verify imports and types
npx playwright install chromium firefox webkit
npm run test:browser            # Build site and test all three browser engines
npm run check                  # All of the above checks
npm run build:site
npm run preview                # Serve the generated static site
npm pack                       # Build and package; does NOT publish
```

If a browser is unavailable locally, select explicitly and report the omission:

```sh
BROWSERS=chromium,firefox npm run test:browser
```

Keep `package-lock.json` committed. Build artifacts, dependencies, test output,
local environment files, logs, and editor files are ignored.

## Example data

The examples progress from basic setup to preset buttons, a preset dropdown and
Clear, the Report of the Week API, themes, and a native modal. **Setup** shows
how each example mounts Siftbar, **Fields** shows the shared review schema, and
**Results logic** shows the app's `updateResults` and HTTP code for data-backed
examples. The copy button copies the selected view. Other field types remain
supported and covered by interaction fixtures.

Data examples request `https://thereportoftheweekapi.com/api/v1/reports/` using
`category`, `min_rating`, `max_rating`, `min_date`, and `max_date`. An enum “is any
of” selection makes one supported category request per value, then merges and
deduplicates results. Exact local AND checks preserve repeated-condition and
null/zero semantics. Quick search matches product OR manufacturer within those
results; the API has no free-text search parameter.

Results come directly from that public API using cross-origin browser requests.
There is no custom backend, proxy, repository data fallback, or alternate-source
cache. Network, HTTP, and invalid-response errors show an error and Retry while
preserving filters. An outage does not prevent using the controls or reading
setup code. Automated tests intercept API requests with provider-shaped fixtures.

Allow the relevant host in your application's `connect-src` CSP if reusing these
example adapters. Siftbar itself does not fetch data or need network access.
The example evaluator and results renderers are application code, not library
exports or required configuration.

## GitHub Pages

`npm run build:site` generates `site-dist/`, including `.nojekyll`, `license.txt`,
examples, snippets, library assets, and an HTML guide rendered from
[`guide.md`](guide.md). Relative URLs work at a domain root or a repository path such as
`/siftbar/`. No router rewrites or committed build output are needed.

1. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
2. Push to **master**, or use **Actions → Deploy examples to GitHub Pages → Run workflow**.
3. Approve the `github-pages` environment if repository rules require it.
4. Open the deployment URL, normally `https://andyklimczak.github.io/siftbar/`.

The workflow installs Node 22 and all three Playwright browsers/system
dependencies, runs the complete checks, and deploys only after success. Failed
checks retain browser diagnostics for seven days. Deployment permissions are
scoped to the deploy job; standard Pages deployment needs no extra secrets or
personal access token. Pushes to other branches do not automatically deploy.

Local preview: `npm run build:site && npm run preview`. Local checks do not prove
the latest hosted deployment has finished. Pages deployment is separate from
[npm publishing](releasing.md).
