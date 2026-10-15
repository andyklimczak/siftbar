import { planReportRequests, fetchReports } from './data.js';
import { filterRecords } from '../vanilla/evaluate.js';
import { renderRows } from '../vanilla/results.js';

// @handler:start
export function createResultView(prefix) {
  const count = document.querySelector(`#${prefix}-count`);
  const status = document.querySelector(`#${prefix}-status`);
  const rows = document.querySelector(`#${prefix}-rows`);
  const retry = document.querySelector(`#${prefix}-retry`);
  let pending;
  let requestId = 0;
  let currentFilters = [];
  async function updateResults({ filters }) {
    currentFilters = filters;
    pending?.abort();
    pending = new AbortController();
    const id = ++requestId;
    count.textContent = '…';
    status.textContent = 'Loading reviews…';
    retry.hidden = true;
    rows.replaceChildren();
    try {
      // An "is any of" category makes one supported API request per value.
      const plans = planReportRequests(filters);
      const responses = await Promise.all(plans.map(plan => fetchReports(plan.url, { signal: pending.signal })));
      if (id !== requestId) return;
      const unique = [...new Map(responses.flat().map(report => [report.id, report])).values()];
      // Exact AND checks also avoid treating unrated records as zero.
      const matches = filterRecords(unique, { filters }).sort((a, b) => (b.dateReleased ?? '').localeCompare(a.dateReleased ?? ''));
      renderRows(rows, matches, ['product', 'manufacturer', 'category', 'rating', 'dateReleased']);
      count.textContent = `${matches.length} ${matches.length === 1 ? 'review' : 'reviews'}`;
      status.textContent = '';
    } catch (error) {
      if (id !== requestId || error.name === 'AbortError') return;
      count.textContent = 'Unavailable';
      status.textContent = error.message;
      retry.hidden = false;
    }
  }
  retry.addEventListener('click', () => { void updateResults({ filters: currentFilters }); });
  updateResults.reload = () => updateResults({ filters: currentFilters });
  updateResults.cancel = () => { ++requestId; pending?.abort(); };
  void updateResults({ filters: [] });
  return updateResults;
}
// @handler:end
