import { test, expect } from '@playwright/test';
import { mockDataApis } from './data-apis.js';
test.beforeEach(async ({ page }) => { await mockDataApis(page); });

test('visible source-backed handlers execute real fetches and render selected review conditions', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => Boolean(window.siftbarDemos));
  for (const name of ['basic', 'buttons', 'local', 'reports']) {
    await page.evaluate(async name => {
      const { updateResults } = await import(`./snippets/${name}.results.js`);
      await updateResults({ filters: [{ field: 'category', operator: 'eq', value: 'Energy Crisis' }, { field: 'rating', operator: 'gte', value: 8 }] });
    }, name);
    await expect(page.locator(`#${name}-count`)).toHaveText('1 review');
  }
});

test('handler code stays inline and copyable independently of setup tabs', async ({ page }) => {
  await page.goto('./');
  const card = page.locator('#reports .code-card');
  await expect(card.locator('.handler-code')).toContainText("url.searchParams.set('category', value)");
  await expect(card.locator('.handler-code')).toContainText('await fetch(url,');
  await expect(card.locator('.handler-code')).not.toContainText('raw.githubusercontent.com');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedSource = text; } } });
  });
  await card.locator('.setup-tabs').getByRole('button', { name: 'HTML', exact: true }).click();
  await expect(card.locator('.setup-code')).toContainText('<div id="reports-filters">');
  await card.locator('.copy-handler').click();
  expect(await page.evaluate(() => window.copiedSource)).toBe(await card.locator('.handler-code code').textContent());
  await card.locator('.copy-code').click();
  expect(await page.evaluate(() => window.copiedSource)).toBe(await card.locator('.setup-code').textContent());
});
