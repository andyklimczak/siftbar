import { Siftbar } from '../../dist/siftbar.js';
import { fields } from '../report-of-week/schema.js';
import { presets } from './presets.js';
import { createResultView } from '../report-of-week/results.js';

export async function mountLocalExample() {
  // @binding:start
  const updateResults = createResultView('local');
  // @binding:end
  const stateInput = document.querySelector('#local-state');
  const error = document.querySelector('#local-error');
  // @setup:start
  const siftbar = new Siftbar(document.querySelector('#local-filters'), {
    fields,
    onChange: updateResults,
  });
  // @setup:end
  function updateDemoState(state) {
    stateInput.value = JSON.stringify(state, null, 2);
    error.textContent = '';
    const conditions = state.filters.map(({ field, operator, value }) => ({ field, operator, value }));
    const preset = Object.entries(presets).find(([, filters]) => JSON.stringify(filters) === JSON.stringify(conditions));
    document.querySelector('#local-preset').value = preset?.[0] ?? 'custom';
  }
  document.querySelector('#local-filters').addEventListener('siftbar:change', event => updateDemoState(event.detail.state));
  document.querySelector('#local-restore').addEventListener('click', () => {
    try { siftbar.setState(JSON.parse(stateInput.value), { emit: true }); }
    catch (failure) { error.textContent = failure.message; }
  });
  // @setup:start
  document.querySelector('#local-preset').addEventListener('change', event => {
    siftbar.setFilters(presets[event.target.value]);
  });
  document.querySelector('#local-reset').addEventListener('click', () => {
    siftbar.clear();
    document.querySelector('#local-preset').value = 'empty';
  });
  // @setup:end
  document.querySelector('#local-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(stateInput.value); }
    catch { error.textContent = 'Clipboard unavailable. Select and copy the JSON below.'; }
  });
  updateDemoState(siftbar.getState());
  return { siftbar, updateResults };
}
