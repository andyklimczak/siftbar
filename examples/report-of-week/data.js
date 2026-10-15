// Application-owned adapter; these requests and result checks are not Siftbar APIs.
import { isCalendarDate } from '../../dist/siftbar.js';
// @query:start
export const REPORTS_ENDPOINT = 'https://thereportoftheweekapi.com/api/v1/reports/';
const SERVER_CATEGORIES = ['Energy Crisis', 'Running On Empty', 'Other', 'Drink Review', 'Music Review', 'Travel Review'];
// @query:end

export function normalizeReport(report) {
  if (!report || typeof report.id !== 'string' || typeof report.product !== 'string'
    || typeof report.manufacturer !== 'string' || (report.rating != null && !Number.isFinite(report.rating))) {
    throw new Error('The review source returned an unexpected report.');
  }
  return {
    id: report.id, product: report.product, manufacturer: report.manufacturer,
    category: typeof report.category === 'string' ? report.category : null,
    rating: report.rating ?? null,
    dateReleased: isCalendarDate(report.dateReleased) ? report.dateReleased : null,
  };
}

// @query:start
export function planReportRequest(filters = []) {
  const url = new URL(REPORTS_ENDPOINT);
  let minRating, maxRating, minDate, maxDate;
  const lowerRating = value => { if (Number.isFinite(value)) minRating = minRating === undefined ? value : Math.max(minRating, value); };
  const upperRating = value => { if (Number.isFinite(value)) maxRating = maxRating === undefined ? value : Math.min(maxRating, value); };
  const lowerDate = value => { if (isCalendarDate(value)) minDate = minDate === undefined || value > minDate ? value : minDate; };
  const upperDate = value => { if (isCalendarDate(value)) maxDate = maxDate === undefined || value < maxDate ? value : maxDate; };
  for (const { field, operator, value } of filters) {
    if (field === 'category' && operator === 'eq' && SERVER_CATEGORIES.includes(value) && !url.searchParams.has('category')) url.searchParams.set('category', value);
    if (field === 'rating') {
      if (['eq', 'gte', 'gt'].includes(operator)) lowerRating(value);
      if (['eq', 'lte', 'lt'].includes(operator)) upperRating(value);
      if (operator === 'between' && Array.isArray(value)) { lowerRating(value[0]); upperRating(value[1]); }
    }
    if (field === 'dateReleased') {
      if (['on', 'after'].includes(operator)) lowerDate(value);
      if (['on', 'before'].includes(operator)) upperDate(value);
      if (operator === 'between' && Array.isArray(value)) { lowerDate(value[0]); upperDate(value[1]); }
    }
  }
  for (const [key, value] of [['min_rating', minRating], ['max_rating', maxRating], ['min_date', minDate], ['max_date', maxDate]]) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return { url: url.href };
}

export function planReportRequests(filters = []) {
  const any = filters.find(filter => filter.field === 'category' && filter.operator === 'any_of');
  if (!any) return [planReportRequest(filters)];
  const plans = any.value.map(value => planReportRequest([
    { field: 'category', operator: 'eq', value }, ...filters,
  ]));
  return [...new Map(plans.map(plan => [plan.url, plan])).values()];
}
// @query:end

// @http:start
export async function fetchReports(url, { signal } = {}) {
  const timed = AbortSignal.timeout(15000);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timed]) : timed });
  if (!response.ok) throw new Error(`Review request failed (${response.status}).`);
  const payload = await response.json();
  if (!Array.isArray(payload.reports)) throw new Error('The review source returned an unexpected response.');
  return payload.reports.map(normalizeReport).sort((a, b) => (b.dateReleased ?? '').localeCompare(a.dateReleased ?? ''));
}

// @http:end
