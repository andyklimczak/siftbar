import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
const temporary = await mkdtemp(join(tmpdir(), 'siftbar-package-'));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { encoding: 'utf8' }))[0];
  const files = packed.files.map(file => file.path);
  const publicDocs = ['README.md', 'docs/assets/siftbar-preview.png', 'docs/guide.md', 'docs/messages.md', 'LICENSE'];
  const artifacts = [
    'dist/siftbar.js', 'dist/siftbar.browser.js', 'dist/styles.css', 'dist/base.css',
    'dist/types/index.d.ts', 'dist/LICENSE', 'dist/LICENSE-floating-ui-dom',
    'dist/LICENSE-floating-ui-core', 'dist/LICENSE-floating-ui-utils',
  ];
  for (const required of [...publicDocs, ...artifacts]) assert(files.includes(required), `Missing ${required}`);
  assert(files.every(file => file.startsWith('dist/') || publicDocs.includes(file) || file === 'package.json'), 'Development-only files entered the package.');
  const install = join(temporary, 'node_modules', 'siftbar');
  await mkdir(install, { recursive: true });
  execFileSync('tar', ['-xzf', join(temporary, packed.filename), '--strip-components=1', '-C', install]);
  const metadata = JSON.parse(await readFile(join(install, 'package.json'), 'utf8'));
  for (const entry of [metadata.main, metadata.types, metadata.unpkg, metadata.jsdelivr, metadata.exports['.'].types, metadata.exports['.'].import, metadata.exports['./browser'], metadata.exports['./styles.css'], metadata.exports['./base.css']]) {
    assert.equal(typeof entry, 'string', 'Missing package entry point.');
    assert(files.includes(entry.replace(/^\.\//, '')), `Entry point not shipped: ${entry}`);
  }
  assert.equal(metadata.unpkg, './dist/siftbar.browser.js');
  assert.equal(metadata.jsdelivr, metadata.unpkg);
  assert.equal(Object.keys(metadata.dependencies ?? {}).length, 0, 'Self-contained builds should not require runtime package installs.');
  const consumerModule = join(temporary, 'consumer.mjs');
  await writeFile(consumerModule, `export * from 'siftbar';
export const resolveSiftbar = path => import.meta.resolve(path);
`);
  const library = await import(pathToFileURL(consumerModule).href);
  for (const [subpath, artifact] of [['browser', 'siftbar.browser.js'], ['styles.css', 'styles.css'], ['base.css', 'base.css']]) {
    assert.equal(library.resolveSiftbar(`siftbar/${subpath}`), pathToFileURL(join(install, 'dist', artifact)).href);
  }
  assert.equal(typeof library.Siftbar, 'function');
  assert.equal(library.DEFAULT_MESSAGES.clear, 'Clear');
  assert.equal(library.DEFAULT_MESSAGES.validation.minimum, 'Minimum is {min}.');
  assert.equal(typeof globalThis.document, 'undefined');
  const consumer = join(temporary, 'consumer.mts');
  await writeFile(consumer, `import { Siftbar, DEFAULT_MESSAGES, type FilterCondition, type FilterState, type Field, type SiftbarMessages, type SiftbarMessageOverrides } from 'siftbar';
const fields: Field[] = [{ key: 'n', label: 'Number', type: 'number', integer: true }, { key: 'email', label: 'Email', type: 'text' }];
const defaults: Readonly<SiftbarMessages> = DEFAULT_MESSAGES;
const messages: SiftbarMessageOverrides = { clear: 'Limpiar', operators: { eq: 'es' }, validation: { minimum: 'Mínimo: {min}' } };
const instance = new Siftbar(document.createElement('div'), { fields, messages, quickSearchFields: ['email'] });
instance.setSearch('andy@test.com');
instance.setSearch('', { emit: false });
// @ts-expect-error quick search accepts text, not typed condition values
instance.setSearch(123);
// @ts-expect-error unknown message key must be rejected by declarations
const badMessage: SiftbarMessageOverrides = { unknown: 'x' };
// @ts-expect-error messages must be plain strings, not callbacks
const badTemplate: SiftbarMessageOverrides = { filterAdded: () => 'x' };
// @ts-expect-error nested operator IDs remain constrained
const badOperator: SiftbarMessageOverrides = { operators: { unknown: 'x' } };
void defaults; void badMessage; void badTemplate; void badOperator;
const state: FilterState = instance.getState();
instance.setState(state);
const preset: readonly FilterCondition[] = [{ field: 'n', operator: 'gte', value: 32 }];
instance.setFilters(preset);
instance.setFilters([], { emit: false });
// @ts-expect-error IDs do not belong in plain filter conditions
instance.setFilters([{ id: 'manual', field: 'n', operator: 'eq', value: 1 }]);
// @ts-expect-error unknown field type must be rejected by declarations
const bad: Field = { key: 'n', label: 'N', type: 'unknown' };
void bad;
`);
  execFileSync('node_modules/.bin/tsc', ['--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', consumer], { stdio: 'inherit' });
  for (const filename of ['siftbar.js', 'siftbar.browser.js']) {
    const code = await readFile(join(install, 'dist', filename));
    assert(!/^\s*import\s/m.test(code.toString()), 'Browser artifact requires external imports.');
    console.log(`${filename}: ${code.length} bytes / ${gzipSync(code).length} gzip bytes`);
  }
  const browser = {};
  runInNewContext(await readFile(join(install, 'dist/siftbar.browser.js'), 'utf8'), browser);
  assert.equal(typeof browser.Siftbar, 'function');
  assert.equal(browser.Siftbar, browser.SiftbarLibrary.Siftbar);
  assert.equal(typeof browser.SiftbarLibrary.SiftbarValidationError, 'function');
  console.log(`Verified real npm pack artifact (${files.length} files), package/CDN entry points, standalone globals, Node import without DOM, and consumer declarations.`);
} finally { await rm(temporary, { recursive: true, force: true }); }
