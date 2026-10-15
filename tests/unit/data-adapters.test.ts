import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeReport, planReportRequest, planReportRequests, fetchReports } from '../../examples/report-of-week/data.js';
import { fields } from '../../examples/report-of-week/schema.js';
import { validateSchema, validateState } from '../../src/core/validation.js';
import { filterRecords } from '../../examples/vanilla/evaluate.js';
const report = { id: 'review-1', product: 'Drink', manufacturer: 'Brand', category: 'Energy Crisis', dateReleased: '2020-02-06', rating: 9 };
afterEach(() => { vi.restoreAllMocks(); });

describe('application-owned review adapter', () => {
  it('defines category as a fixed enum and rejects arbitrary/case-changed values', () => {
    const schema = validateSchema(fields);
    const state = value => ({ version: 1, combinator: 'and', filters: [{ id: 'one', field: 'category', operator: 'eq', value }] });
    expect(validateState(state('Energy Crisis'), schema).filters[0].value).toBe('Energy Crisis');
    expect(() => validateState(state('Anything I type'), schema)).toThrow();
    expect(() => validateState(state('energy crisis'), schema)).toThrow();
  });
  it('combines tight inclusive rating/date bounds with exact category values', () => {
    const url = new URL(planReportRequest([
      { field: 'category', operator: 'eq', value: 'Energy Crisis' },
      { field: 'rating', operator: 'gte', value: 7 },
      { field: 'rating', operator: 'gte', value: 8 },
      { field: 'rating', operator: 'between', value: [6, 9.5] },
      { field: 'dateReleased', operator: 'between', value: ['2021-01-01', '2024-12-31'] },
    ]).url);
    expect(Object.fromEntries(url.searchParams)).toEqual({ category: 'Energy Crisis', min_rating: '8', max_rating: '9.5', min_date: '2021-01-01', max_date: '2024-12-31' });
  });
  it('maps any-of categories to supported single-category requests with shared bounds', () => {
    const plans = planReportRequests([
      { field: 'category', operator: 'any_of', value: ['Running On Empty', 'Energy Crisis'] },
      { field: 'rating', operator: 'gte', value: 8 },
    ]);
    expect(plans.map(plan => Object.fromEntries(new URL(plan.url).searchParams))).toEqual([
      { category: 'Running On Empty', min_rating: '8' }, { category: 'Energy Crisis', min_rating: '8' },
    ]);
  });
  it('preserves zero bounds for exact local rechecks', () => {
    expect(new URL(planReportRequest([{ field: 'rating', operator: 'eq', value: 0 }]).url).searchParams.get('max_rating')).toBe('0');
  });
  it('preserves null/unrated values and excludes them from numeric comparisons', () => {
    expect(normalizeReport({ ...report, rating: null, category: undefined })).toMatchObject({ rating: null, category: null });
    expect(normalizeReport({ ...report, rating: undefined, dateReleased: 'bad' })).toMatchObject({ rating: null, dateReleased: null });
    const rows = [{ rating: null }, { rating: 0 }, { rating: '0' }];
    expect(filterRecords(rows, { filters: [{ field: 'rating', operator: 'gte', value: 0 }] })).toEqual([{ rating: 0 }]);
    expect(filterRecords(rows, { filters: [{ field: 'rating', operator: 'between', value: [0, 10] }] })).toEqual([{ rating: 0 }]);
  });
  it('rechecks repeated category conditions as AND after request fanout', () => {
    const rows = [{ category: 'Running On Empty' }, { category: 'Energy Crisis' }];
    expect(filterRecords(rows, { filters: [
      { field: 'category', operator: 'any_of', value: ['Running On Empty', 'Energy Crisis'] },
      { field: 'category', operator: 'eq', value: 'Energy Crisis' },
    ] })).toEqual([rows[1]]);
  });
  it('fetches and normalizes reports directly from the requested API URL', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ reports: [report] })));
    const url = planReportRequest([]).url;
    expect(await fetchReports(url)).toEqual([report]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(url);
  });
  it.each(['network', 'http', 'payload'])('propagates %s errors without requesting another source', async kind => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    if (kind === 'network') fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    else fetch.mockResolvedValueOnce(new Response('{}', { status: kind === 'http' ? 503 : 200 }));
    await expect(fetchReports(planReportRequest([]).url)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('propagates intentional cancellation without further requests', async () => {
    const controller = new AbortController(); controller.abort();
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(controller.signal.reason);
    await expect(fetchReports(planReportRequest([]).url, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('accepts only API-compatible field operators in data examples', () => {
    const schema = validateSchema(fields);
    expect(schema.map(field => field.key)).toEqual(['category', 'rating', 'dateReleased']);
    expect(schema[0].operators).toEqual(['eq', 'any_of']);
    expect(schema[1].operators).toEqual(['gte', 'lte', 'between']);
    expect(schema[2].operators).toEqual(['on', 'between']);
  });
});
