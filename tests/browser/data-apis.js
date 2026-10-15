// Provider-shaped HTTP fixtures; production demos fetch live review URLs.
import { readFile } from 'node:fs/promises';
const reports = JSON.parse(await readFile(new URL('./fixtures/reviews.json', import.meta.url), 'utf8')).reports;
const headers = { 'access-control-allow-origin': '*' };
export async function mockDataApis(page, settings = {}) {
  const controls = { reports: 'success', reportDelay: 0, ...settings, reportRequests: [], repositoryRequests: [] };
  await page.route('https://thereportoftheweekapi.com/**', async route => {
    const url = new URL(route.request().url());
    controls.reportRequests.push(url.href);
    const mode = controls.reports;
    const delay = typeof controls.reportDelay === 'function' ? controls.reportDelay(url) : controls.reportDelay;
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (mode === 'blocked') return route.abort('failed');
    if (mode === 'error') return route.fulfill({ status: 503, headers, json: {} });
    if (mode === 'malformed') return route.fulfill({ headers, json: {} });
    let matches = reports;
    if (url.searchParams.has('category')) matches = matches.filter(report => report.category === url.searchParams.get('category'));
    for (const [param, key, lower] of [['min_rating', 'rating', true], ['max_rating', 'rating', false], ['min_date', 'dateReleased', true], ['max_date', 'dateReleased', false]]) {
      const raw = url.searchParams.get(param);
      const bound = key === 'rating' ? Number(raw) : raw;
      if (raw !== null && bound) matches = matches.filter(report => lower ? report[key] >= bound : report[key] <= bound);
    }
    await route.fulfill({ headers, json: { reports: matches } });
  });
  await page.route('https://raw.githubusercontent.com/andyklimczak/TheReportOfTheWeek-API/**', async route => {
    controls.repositoryRequests.push(route.request().url());
    await route.abort('blockedbyclient'); // Guard against reintroducing a repository fallback.
  });
  return controls;
}
