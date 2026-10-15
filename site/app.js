import { mountBasicExample } from './examples/vanilla/basic.js';
import { mountPresetButtonsExample } from './examples/vanilla/preset-buttons.js';
import { mountLocalExample } from './examples/vanilla/local.js';
import { mountReportsExample } from './examples/report-of-week/reports.js';
import { mountThemeExamples } from './examples/vanilla/themes.js';
import { mountModalExample } from './examples/vanilla/modal.js';

async function mountSources(card) {
  const basic = [{ path: card.dataset.setup, label: 'Setup', basic: true }];
  if (card.dataset.markup) basic.push({ path: card.dataset.markup, label: 'HTML', basic: true });
  if (card.dataset.styles) basic.push({ path: card.dataset.styles, label: 'CSS', basic: true });
  const sources = [...basic, ...card.dataset.sources.split(',').map(path => ({ path, label: path.split('/').at(-1), basic: false }))];
  const code = card.querySelector('code');
  code.classList.add('setup-code');
  const note = card.querySelector('.code-note');
  const setupNote = note.textContent;
  const details = card.querySelector('.source-details');
  let currentSource = '';
  let selection = 0;
  let showSetup;
  for (const [index, source] of sources.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = source.label;
    button.setAttribute('aria-pressed', 'false');
    card.querySelector(source.basic ? '.setup-tabs' : '.source-tabs').append(button);
    const show = async () => {
      const id = ++selection;
      const response = await fetch(new URL(source.path, import.meta.url));
      if (!response.ok) throw new Error(`Could not load sample ${source.path}`);
      const text = await response.text();
      if (id !== selection) return;
      currentSource = text;
      code.textContent = text; // Source is text, never HTML or executable user input.
      card.querySelector('pre').dataset.view = source.basic ? 'setup' : 'full';
      note.textContent = source.basic ? setupNote : 'Full demo implementation for reference—not required Siftbar setup.';
      card.querySelectorAll('.setup-tabs button, .source-tabs button').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
      card.querySelector('.copy-code').textContent = 'Copy code';
    };
    button.addEventListener('click', () => { void show().catch(reportError); });
    if (index === 0) { showSetup = show; await show(); }
  }
  if (card.dataset.handler) {
    const response = await fetch(new URL(card.dataset.handler, import.meta.url));
    if (!response.ok) throw new Error(`Could not load sample ${card.dataset.handler}`);
    const text = await response.text();
    const section = document.createElement('section');
    section.className = 'handler-source';
    const heading = document.createElement('div');
    heading.className = 'code-top';
    const title = document.createElement('strong');
    title.textContent = 'updateResults';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'copy-handler';
    copy.textContent = 'Copy handler';
    heading.append(title, copy);
    const description = document.createElement('p');
    description.className = 'code-note';
    description.textContent = ''; 
    const region = document.createElement('pre');
    region.className = 'handler-code';
    region.tabIndex = 0;
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', `${card.getAttribute('aria-label')} results handler`);
    const sample = document.createElement('code');
    sample.textContent = text;
    region.append(sample);
    section.append(heading, description, region);
    details.before(section);
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; }
      catch { region.focus(); reportError(new Error('Clipboard unavailable. Select and copy the handler.')); }
    });
  }
  details.addEventListener('toggle', () => {
    if (!details.open) void showSetup().catch(reportError);
  });
  card.querySelector('.copy-code').addEventListener('click', async event => {
    try { await navigator.clipboard.writeText(currentSource); event.target.textContent = 'Copied'; }
    catch { card.querySelector('pre').focus(); reportError(new Error('Clipboard unavailable. Select and copy the sample.')); }
  });
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
