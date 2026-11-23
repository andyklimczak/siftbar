import { mountBasicExample } from './examples/vanilla/basic.js';
import { mountPresetButtonsExample } from './examples/vanilla/preset-buttons.js';
import { mountLocalExample } from './examples/vanilla/local.js';
import { mountReportsExample } from './examples/report-of-week/reports.js';
import { mountThemeExamples } from './examples/vanilla/themes.js';
import { mountModalExample } from './examples/vanilla/modal.js';

const reviewFieldsPath = 'examples/report-of-week/schema.js';

async function mountSources(card) {
  const { setup, markup, styles, handler, sources } = card.dataset;
  const samples = [
    { path: setup, label: 'Setup', view: 'setup', note: handler ? 'Pass your own updateResults callback. See Results logic for this demo’s implementation.' : '' },
    { path: reviewFieldsPath, label: 'Fields', view: 'fields', note: 'The field definitions shared by the review examples.' },
  ];
  if (markup) samples.push({ path: markup, label: 'HTML', view: 'html' });
  if (styles) samples.push({ path: styles, label: 'CSS', view: 'css' });
  if (handler) samples.push({ path: handler, label: 'Results logic', view: 'results', note: 'Application code that fetches and renders reviews. Replace it with your own results handler.' });
  const fullSources = sources.split(',').filter(path => path !== reviewFieldsPath).map(path => ({
    path, label: path.split('/').at(-1), view: 'full', note: 'Full demo implementation for reference—not required Siftbar setup.',
  }));
  const pre = card.querySelector('pre');
  const code = pre.querySelector('code');
  const note = card.querySelector('.code-note');
  const title = card.querySelector('.code-top strong');
  const copy = card.querySelector('.copy-code');
  const details = card.querySelector('.source-details');
  let currentSource = '';
  let requestedView;
  let selection = 0;
  const [showSetup] = [...samples, ...fullSources].map(source => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = source.label;
    button.setAttribute('aria-pressed', 'false');
    card.querySelector(source.view === 'full' ? '.source-tabs' : '.setup-tabs').append(button);
    const show = async () => {
      const id = ++selection;
      requestedView = source.view;
      const response = await fetch(new URL(source.path, import.meta.url));
      if (!response.ok) throw new Error(`Could not load sample ${source.path}`);
      const text = await response.text();
      if (id !== selection) return;
      currentSource = text;
      code.textContent = text; // Source is text, never HTML or executable user input.
      pre.dataset.view = source.view;
      pre.scrollTop = 0;
      pre.scrollLeft = 0;
      title.textContent = source.label;
      note.textContent = source.note ?? '';
      card.querySelectorAll('.setup-tabs button, .source-tabs button').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
      copy.textContent = 'Copy code';
    };
    button.addEventListener('click', () => { void show().catch(reportError); });
    return show;
  });
  details.addEventListener('toggle', () => {
    if (!details.open && requestedView === 'full') void showSetup().catch(reportError);
  });
  copy.addEventListener('click', async () => {
    const source = currentSource;
    try {
      await navigator.clipboard.writeText(source);
      if (source === currentSource) copy.textContent = 'Copied';
    } catch {
      pre.focus();
      reportError(new Error('Clipboard unavailable. Select and copy the sample.'));
    }
  });
  await showSetup();
}
function reportError(error) { document.querySelector('#site-error').textContent = error.message; }
async function main() {
  const initialHash = window.location.hash;
  document.querySelectorAll('pre').forEach(region => {
    region.tabIndex = 0;
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', region.closest('aside')?.getAttribute('aria-label') ?? region.closest('article')?.querySelector('h3')?.textContent ?? (region.id === 'api-output' ? 'API response JSON' : 'Getting started code'));
  });
  const version = await fetch('./dist/version.json').then(response => response.json());
  document.querySelector('#version').textContent = `v${version.version}`;
  const basic = await mountBasicExample();
  const buttons = await mountPresetButtonsExample();
  const local = await mountLocalExample();
  const reports = mountReportsExample();
  const themes = mountThemeExamples();
  const modal = mountModalExample();
  // Convenience handles for manual testing. This is demo code, not library globals.
  window.siftbarDemos = { basic: basic.siftbar, buttons: buttons.siftbar, local: local.siftbar, reports: reports.siftbar, themes, modal };
  await Promise.all(Array.from(document.querySelectorAll('[data-sources]'), mountSources));
  // Source panels change section heights after the browser's initial fragment jump.
  if (initialHash && window.location.hash === initialHash) {
    const target = document.getElementById(initialHash.slice(1));
    if (target?.classList.contains('example-section')) target.scrollIntoView();
  }
  // Keep mounted state when the browser caches this document for back/forward.
  // Cancel requests on pagehide; the browser owns document teardown otherwise.
  const results = [basic, buttons, local, reports].map(example => example.updateResults);
  window.addEventListener('pagehide', () => results.forEach(handler => handler.cancel()));
  window.addEventListener('pageshow', event => { if (event.persisted) results.forEach(handler => { void handler.reload(); }); });
}
void main().catch(reportError);
