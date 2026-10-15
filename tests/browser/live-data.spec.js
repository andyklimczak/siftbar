import { test, expect } from '@playwright/test';
import { mockDataApis } from './data-apis.js';
async function ready(page) {
  await page.goto('./');
  await page.waitForFunction(() => Boolean(window.siftbarDemos));
  await expect(page.locator('#reports-count')).toHaveText('8 reviews');
}

test('all data examples use review requests, not unrelated services', async ({ page }) => {
  const controls = await mockDataApis(page);
  await ready(page);
  expect(controls.reportRequests).toHaveLength(4);
  await expect(page.locator('#basic-count')).toHaveText('8 reviews');
  await expect(page.locator('#reports-status')).toBeEmpty();
  expect(await page.evaluate(() => window.siftbarDemos.basic.getState().filters)).toEqual([]);
});

test('category, inclusive rating bounds and dates are sent to the review API', async ({ page }) => {
  const controls = await mockDataApis(page);
  await ready(page);
  await page.evaluate(() => window.siftbarDemos.reports.setFilters([
    { field: 'category', operator: 'eq', value: 'Energy Crisis' },
    { field: 'rating', operator: 'gte', value: 8 },
    { field: 'dateReleased', operator: 'between', value: ['2020-01-01', '2020-12-31'] },
  ]));
  await expect(page.locator('#reports-count')).toHaveText('1 review');
  const query = new URL(controls.reportRequests.at(-1)).searchParams;
  expect(Object.fromEntries(query)).toEqual({ category: 'Energy Crisis', min_rating: '8', min_date: '2020-01-01', max_date: '2020-12-31' });
  await page.evaluate(() => window.siftbarDemos.reports.setFilters([{ field: 'rating', operator: 'gte', value: 0 }]));
  await expect(page.locator('#reports-count')).toHaveText('6 reviews'); // Unrated records aren't zero.
});

test('valid empty responses display zero reviews, not errors', async ({ page }) => {
  await mockDataApis(page);
  await ready(page);
  await page.evaluate(() => window.siftbarDemos.reports.setFilters([{ field: 'category', operator: 'eq', value: 'Music Review' }]));
  await expect(page.locator('#reports-count')).toHaveText('0 reviews');
  await expect(page.locator('#reports-status')).toBeEmpty();
  await expect(page.locator('#reports-retry')).toBeHidden();
});

test('late responses cannot replace newer review conditions', async ({ page }) => {
  const controls = await mockDataApis(page, { reportDelay: url => url.searchParams.get('category') === 'Energy Crisis' ? 200 : 0 });
  await ready(page);
  await page.evaluate(() => window.siftbarDemos.reports.setFilters([{ field: 'category', operator: 'eq', value: 'Energy Crisis' }]));
  await expect.poll(() => controls.reportRequests.some(url => new URL(url).searchParams.get('category') === 'Energy Crisis')).toBe(true);
  await page.evaluate(() => window.siftbarDemos.reports.setFilters([{ field: 'category', operator: 'eq', value: 'Drink Review' }]));
  await expect(page.locator('#reports-count')).toHaveText('1 review');
  await page.waitForTimeout(250);
  await expect(page.locator('#reports-count')).toHaveText('1 review');
  await expect(page.locator('#reports-rows tr')).toContainText('Drink Review');
});

test('any-of categories use supported API calls, with selected removable Value chips', async ({ page }) => {
  const controls = await mockDataApis(page);
  await ready(page);
  const host = page.locator('#reports-filters');
  await host.getByRole('combobox').click();
  await host.getByRole('option', { name: 'Category enum', exact: true }).click();
  await host.getByRole('combobox', { name: 'Operator', exact: true }).selectOption('any_of');
  await host.getByRole('listbox').getByRole('option', { name: 'Running On Empty', exact: true }).click();
  await host.getByRole('listbox').getByRole('option', { name: 'Energy Crisis', exact: true }).click();
  await expect(host.locator('.siftbar__enum-control .siftbar__enum-chip')).toHaveCount(2);
  await page.locator('#reports-title').click();
  await expect(page.locator('#reports-count')).toHaveText('5 reviews');
  const categories = controls.reportRequests.slice(-2).map(url => new URL(url).searchParams.get('category'));
  expect(categories).toEqual(['Running On Empty', 'Energy Crisis']);
  await host.getByRole('button', { name: /^Edit Category/ }).click();
  await host.getByRole('button', { name: 'Remove Running On Empty from selected values', exact: true }).click();
  await page.locator('#reports-title').click();
  await expect(page.locator('#reports-count')).toHaveText('2 reviews');
});

for (const mode of ['blocked', 'error', 'malformed']) {
  test(`API ${mode} failure shows an error without fetching repository data`, async ({ page }) => {
    const controls = await mockDataApis(page, { reports: mode });
    await page.goto('./');
    await page.waitForFunction(() => Boolean(window.siftbarDemos));
    for (const prefix of ['basic', 'buttons', 'local', 'reports']) {
      await expect(page.locator(`#${prefix}-count`)).toHaveText('Unavailable');
      await expect(page.locator(`#${prefix}-status`)).not.toBeEmpty();
      await expect(page.locator(`#${prefix}-retry`)).toBeVisible();
    }
    expect(controls.repositoryRequests).toHaveLength(0);
  });
}

test('API failure keeps controls and inline code usable; retry uses latest filters', async ({ page }) => {
  const controls = await mockDataApis(page, { reports: 'blocked' });
  await page.goto('./');
  await page.waitForFunction(() => Boolean(window.siftbarDemos));
  await expect(page.locator('#reports-count')).toHaveText('Unavailable');
  await expect(page.locator('#reports-retry')).toBeVisible();
  await expect(page.locator('#reports .handler-code')).toContainText('await fetch(');
  await page.evaluate(() => window.siftbarDemos.reports.setFilters([{ field: 'category', operator: 'eq', value: 'Energy Crisis' }]));
  await expect(page.locator('#reports-retry')).toBeVisible();
  controls.reports = 'success';
  await page.locator('#reports-retry').click();
  await expect(page.locator('#reports-count')).toHaveText('2 reviews');
  await expect(page.locator('#reports-filters [data-edit-id]')).toHaveCount(1);
  expect(controls.repositoryRequests).toHaveLength(0);
});

test('data examples only offer fields/operators that map to supported API queries', async ({ page }) => {
  await mockDataApis(page);
  await ready(page);
  const host = page.locator('#basic-filters');
  await host.getByRole('combobox').click();
  await expect(host.getByRole('listbox').getByRole('option')).toHaveCount(3);
  await host.getByRole('option', { name: 'Released date', exact: true }).click();
  expect(await host.getByRole('combobox', { name: 'Operator', exact: true }).locator('option').evaluateAll(options => options.map(option => option.value))).toEqual(['on', 'between']);
});
