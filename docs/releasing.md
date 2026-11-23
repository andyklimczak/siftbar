# Publishing Siftbar

## Distribution plan

**[npm](https://www.npmjs.com/package/siftbar)** is the canonical release. That makes the same
package available through **jsDelivr** and **UNPKG**, without separate CDN uploads
or accounts. Keep GitHub Pages for the demo and documentation, not as the primary
versioned package host.

**cdnjs** is optional later: it has its own package submission/review and update
configuration. It is not required to give users a reliable CDN option at launch.

`siftbar@0.1.0` is already on npm. Use a fresh version for the next release;
committing changes to this repository does not update a published tarball.

## What ships

- `dist/siftbar.js`: self-contained ES module, also used by npm imports.
- `dist/siftbar.browser.js`: standalone script exposing `window.Siftbar` and
  `window.SiftbarLibrary`.
- `dist/styles.css`: base styles and default theme.
- `dist/base.css`: base styles only, for custom skins.
- TypeScript declarations, source maps, version metadata, and license notices.
- README, API guide, and message catalog.

Floating UI is a build-time dependency bundled into both JavaScript files. Its
licenses ship with the package. Consumers do not need a separate runtime install.
The `files` allowlist excludes development code, examples, and test output.
`prepack` builds the artifacts so a normal `npm pack` or `npm publish` cannot
accidentally package a stale local `dist/`.

## Release checklist

1. Use an npm account with publish access to `siftbar` and two-factor authentication.
2. Start with a clean working tree and install/test:

   ```sh
   npm ci
   npx playwright install --with-deps chromium firefox webkit
   npm run check
   ```

   The complete check includes browser tests and verification of a real packed
   artifact, including Node import without a DOM and TypeScript consumer imports.
   The packaging check also requires `tar`.
3. With a clean working tree, bump the version using `npm version patch`, `minor`,
   or `major` with `--no-git-tag-version`. Before 1.0, document breaking changes
   explicitly and generally bump minor for them. Keep the pinned README CDN URLs
   aligned with the version you are about to publish. Commit the version and docs
   changes together, and rerun checks before publishing.
4. Review exactly what npm will receive:

   ```sh
   npm pack --dry-run
   npm pack
   ```

   Inspect the file list and tarball. Do not publish secrets or development-only
   files. The generated `.tgz` is a local release artifact, not source to commit.
5. Authenticate and publish **only when ready to make the release public**:

   ```sh
   npm login
   npm whoami
   npm publish --access public
   ```

   Follow npm's current browser/2FA prompts. Do not disable 2FA or commit tokens.
   A published name/version cannot be reused; fix mistakes in a new version.
6. Confirm the registry and CDN artifacts (propagation/cache delays are possible):

   ```sh
   version=$(node -p "require('./package.json').version")
   npm view "siftbar@$version" version dist.tarball
   curl -fI "https://cdn.jsdelivr.net/npm/siftbar@$version/dist/siftbar.browser.js"
   curl -fI "https://cdn.jsdelivr.net/npm/siftbar@$version/dist/styles.css"
   curl -fI "https://unpkg.com/siftbar@$version/dist/siftbar.js"
   ```

   Test `npm install "siftbar@$version"` in a separate consumer project and open
   the README's CDN example in a browser. A successful Pages deploy does not
   verify the npm or CDN artifacts.
7. Tag the commit used to publish (`git tag "v$version"`), push the commit and tag,
   and create a GitHub Release with release notes. An attached npm tarball is optional.

For pre-release testing, use a version such as `0.2.0-beta.0` and
`npm publish --tag next` rather than replacing the stable `latest` dist-tag.

## CDN usage

Use exact versions and matching JS/CSS in documentation and production apps:

```text
https://cdn.jsdelivr.net/npm/siftbar@0.1.0/dist/siftbar.browser.js
https://cdn.jsdelivr.net/npm/siftbar@0.1.0/dist/styles.css
https://unpkg.com/siftbar@0.1.0/dist/siftbar.browser.js
https://unpkg.com/siftbar@0.1.0/dist/styles.css
```

The package's `jsdelivr` and `unpkg` fields select the standalone script for
package-root requests. Explicit file URLs are still clearer, and CSS must be
loaded separately. Native module consumers should request `dist/siftbar.js`.

For stronger control, consumers can self-host the artifacts or add Subresource
Integrity hashes for the exact CDN bytes they use. Do not invent hashes or reuse
them across releases.

## Later: automated releases

To automate the manual process, consider npm trusted publishing from a
separate GitHub Actions release workflow using OIDC, with
provenance and a protected release environment. Keep publishing separate from
Pages deployment: pushing a demo change should not publish a package. Configure
npm's trusted publisher against the exact repository and workflow before enabling
that automation; no long-lived npm token should be needed.
