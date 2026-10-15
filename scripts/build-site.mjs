import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
await rm('site-dist', { recursive: true, force: true });
await mkdir('site-dist', { recursive: true });
await cp('site', 'site-dist', { recursive: true });
await cp('examples', 'site-dist/examples', { recursive: true });
await cp('dist', 'site-dist/dist', { recursive: true, filter: path => !path.includes('/types') });
await writeFile('site-dist/.nojekyll', '');
await cp('LICENSE', 'site-dist/license.txt');

function setupRegions(source, path, tag = 'setup') {
  const sections = [];
  let lines = null;
  for (const line of source.split(/\r?\n/)) {
    if ([`// @${tag}:start`, `<!-- @${tag}:start -->`].includes(line.trim())) {
      if (lines) throw new Error(`Nested setup marker in ${path}`);
      lines = [];
    } else if ([`// @${tag}:end`, `<!-- @${tag}:end -->`].includes(line.trim())) {
      if (!lines) throw new Error(`Unmatched setup marker in ${path}`);
      const indentation = Math.min(...lines.filter(line => line.trim()).map(line => line.match(/^\s*/)[0].length));
      sections.push(lines.map(line => line.slice(indentation)).join('\n').trim());
      lines = null;
    } else if (lines) lines.push(line);
  }
  if (lines || !sections.length || sections.some(section => !section)) throw new Error(`Missing or empty setup region in ${path}`);
  return sections.join('\n\n');
}
const region = (source, path, tag) => setupRegions(source, path, tag).replace(/^export /gm, '');
const schemaPath = 'examples/report-of-week/schema.js';
const fields = region(await readFile(schemaPath, 'utf8'), schemaPath, 'setup');
const presetPath = 'examples/vanilla/presets.js';
const presets = region(await readFile(presetPath, 'utf8'), presetPath, 'presets');
const dataPath = 'examples/report-of-week/data.js';
const data = await readFile(dataPath, 'utf8');
const viewPath = 'examples/report-of-week/results.js';
const view = await readFile(viewPath, 'utf8');
const markup = await readFile('site/index.html', 'utf8');
await mkdir('site-dist/snippets', { recursive: true });
for (const [name, path, handler] of [
  ['basic', 'examples/vanilla/basic.js', true],
  ['buttons', 'examples/vanilla/preset-buttons.js', true],
  ['local', 'examples/vanilla/local.js', true],
  ['reports', 'examples/report-of-week/reports.js', true],
  ['themes', 'examples/vanilla/themes.js', false],
  ['modal', 'examples/vanilla/modal.js', false],
]) {
  const source = await readFile(path, 'utf8');
  const libraryImport = source.match(/^import \{ Siftbar \} from '[^']+';$/m)?.[0];
  if (!libraryImport) throw new Error(`Missing Siftbar import in ${path}`);
  const snippet = [libraryImport.replace(/from '[^']+'/, "from '../dist/siftbar.js'"), fields,
    ...(name === 'local' ? [presets] : []), setupRegions(source, path)].join('\n\n');
  await writeFile(`site-dist/snippets/${name}.js`, `${snippet}\n`);
  await writeFile(`site-dist/snippets/${name}.html`, `${setupRegions(markup, 'site/index.html', `markup-${name}`)}\n`);
  if (handler) {
    const code = [
      '// Application-owned helpers, not Siftbar APIs.',
      "import { normalizeReport } from '../examples/report-of-week/data.js';",
      "import { isCalendarDate } from '../dist/siftbar.js';",
      "import { filterRecords } from '../examples/vanilla/evaluate.js';",
      "import { renderRows } from '../examples/vanilla/results.js';",
      region(data, dataPath, 'query'), region(data, dataPath, 'http'),
      region(view, viewPath, 'handler'), region(source, path, 'binding'), 'export { updateResults };',
    ].join('\n\n');
    await writeFile(`site-dist/snippets/${name}.results.js`, `${code}\n`);
  }
}
const readme = await readFile('README.md', 'utf8');
const escaped = readme.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
await writeFile('site-dist/guide.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Siftbar API & integration guide</title><link rel="stylesheet" href="./site.css"></head><body><main><p><a href="./">← Back to examples</a></p><h1>API & integration guide</h1><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escaped}</pre></main></body></html>`);
console.log('Built static demo in site-dist/ (root- and project-path safe).');
