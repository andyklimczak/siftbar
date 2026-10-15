import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
const temporary = await mkdtemp(join(tmpdir(), 'siftbar-package-'));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { encoding: 'utf8' }))[0];
  const files = packed.files.map(file => file.path);
  for (const required of ['dist/siftbar.js', 'dist/siftbar.browser.js', 'dist/styles.css', 'dist/base.css', 'dist/types/index.d.ts', 'dist/LICENSE-floating-ui-dom', 'docs/messages.md', 'LICENSE']) assert(files.includes(required), `Missing ${required}`);
  assert(files.every(file => file.startsWith('dist/') || ['README.md', 'docs/messages.md', 'LICENSE', 'package.json'].includes(file)), 'Development-only files entered the package.');
  const install = join(temporary, 'node_modules', 'siftbar');
  await mkdir(install, { recursive: true });
  execFileSync('tar', ['-xzf', join(temporary, packed.filename), '--strip-components=1', '-C', install]);
  const library = await import(pathToFileURL(join(install, 'dist/siftbar.js')).href);
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
  console.log(`Verified real npm pack artifact (${files.length} files), Node import without DOM, and consumer declarations.`);
} finally { await rm(temporary, { recursive: true, force: true }); }
