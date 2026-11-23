import { test, expect } from '@playwright/test';
import { mockDataApis } from './data-apis.js';
test.beforeEach(async ({ page }) => { await mockDataApis(page); });

test('source-backed results snippets fetch and render selected review conditions', async ({ page }) => {
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

test('code picker separates setup, schema, markup and results and copies the active sample', async ({ page }) => {
  await page.goto('./');
  const card = page.locator('#playground .code-card');
  const tabs = card.locator('.setup-tabs');
  const code = card.locator('pre code');
  const results = tabs.getByRole('button', { name: 'Results logic', exact: true });
  const setup = tabs.getByRole('button', { name: 'Setup', exact: true });
  const copy = card.getByRole('button', { name: 'Copy code', exact: true });
  await expect(setup).toHaveAttribute('aria-pressed', 'true');
  await expect(code).toContainText('onChange: updateResults');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedSource = text; } } });
  });

  await tabs.getByRole('button', { name: 'Fields', exact: true }).click();
  await expect(code).toContainText("{ key: 'product', label: 'Product', type: 'text' }");
  await expect(code).toContainText("{ key: 'rating', label: 'Rating', type: 'number'");
  await tabs.getByRole('button', { name: 'HTML', exact: true }).click();
  await expect(code).toContainText('<div id="basic-filters">');

  await results.focus();
  await results.press('Enter');
  await expect(results).toHaveAttribute('aria-pressed', 'true');
  await expect(results).toBeFocused();
  await expect(code).toContainText("url.searchParams.set('category', value)");
  await expect(code).toContainText('await fetch(url,');
  await expect(code).not.toContainText('raw.githubusercontent.com');
  await expect(card.locator('pre')).toHaveCount(1);
  await copy.click();
  expect(await page.evaluate(() => window.copiedSource)).toBe(await code.textContent());

  await setup.click();
  await expect(results).toHaveAttribute('aria-pressed', 'false');
  await expect(code).not.toContainText('await fetch(');
  await copy.click();
  expect(await page.evaluate(() => window.copiedSource)).toBe(await code.textContent());
});
