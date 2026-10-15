// Integration recipe, NOT executed by the static demo.
// /reviews/filter is an illustrative endpoint supplied by your application.
import { Siftbar } from '../../dist/siftbar.js';
import { fields } from '../report-of-week/schema.js';

export function mountServerFilters(host, renderResults, reportStatus) {
  let pending;
  let requestId = 0;
  const siftbar = new Siftbar(host, { fields, label: 'Filter reviews', onChange: load });
  async function load(state) {
    pending?.abort();
    pending = new AbortController();
    const id = ++requestId;
    reportStatus('Loading…');
    try {
      const response = await fetch('/reviews/filter', {
        method: 'POST', signal: pending.signal,
        headers: { 'Content-Type': 'application/json' },
        // Add your application's CSRF header here if required.
        body: JSON.stringify(state),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const result = await response.json();
      if (id !== requestId) return;
      renderResults(result);
      reportStatus('Loaded.');
    } catch (error) {
      if (id !== requestId || error.name === 'AbortError') return;
      reportStatus(error.message);
    }
  }
  return { siftbar, destroy() { ++requestId; pending?.abort(); siftbar.destroy(); } };
}
