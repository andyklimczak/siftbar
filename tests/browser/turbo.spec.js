import { test, expect } from '@playwright/test';

test('real Stimulus mounts escaped JSON and real Turbo restores committed state from its page cache', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('fixtures/turbo.html');
  const host = page.locator('#rails-shaped');
  await host.getByRole('combobox').click();
  await host.getByRole('option', { name: 'Name <script> text', exact: true }).click();
  await host.getByRole('combobox', { name: 'Operator', exact: true }).selectOption('contains');
  await host.getByLabel('Value', { exact: true }).fill('Andy');
  await page.getByRole('heading', { name: 'Turbo lifecycle', exact: true }).click();
  const saved = await host.locator('[data-siftbar-target="state"]').inputValue();
  expect(JSON.parse(saved).filters[0].value).toBe('Andy');
  await host.getByRole('button', { name: /^Edit/ }).click();
  await host.getByLabel('Value', { exact: true }).fill('unsaved');
  // Programmatic real-Turbo navigation leaves the draft open until before-cache.
  await page.evaluate(() => window.turboFixture.visit(new URL('./other.html', location.href).href));
  await expect(page.getByRole('heading', { name: 'Another page' })).toBeVisible();
  await page.goBack();
  await expect(host.getByRole('button', { name: /^Edit/ })).toBeVisible();
  expect(await host.locator('[data-siftbar-target="state"]').inputValue()).toBe(saved);
  await expect(host.locator('.siftbar')).toHaveCount(1);
  await expect(page.locator('.siftbar__popup:popover-open')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('real Turbo Frame replacement disconnects the old control and mounts one new instance', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('fixtures/turbo.html');
  await page.locator('#rails-shaped').getByRole('combobox').click();
  await page.locator('#replace-frame').press('Enter');
  await expect(page.getByRole('combobox', { name: 'Replacement filters: add a filter', exact: true })).toBeVisible();
  await expect(page.locator('.siftbar')).toHaveCount(1);
  await expect(page.locator('.siftbar__popup:popover-open')).toHaveCount(0);
  expect(errors).toEqual([]);
});
