import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const host = page => page.locator('#one');
async function open(page, operator = 'any_of') {
  await host(page).getByRole('combobox').click();
  await host(page).getByRole('option', { name: 'Status enum', exact: true }).click();
  await host(page).getByRole('combobox', { name: 'Operator', exact: true }).selectOption(operator);
}
const leave = page => page.locator('#outside').click();
test.beforeEach(async ({ page }) => {
  await page.goto('fixtures/');
  await page.waitForFunction(() => Boolean(window.fixture));
});

test('enum dropdown aligns with Value only, not the Field/Operator columns', async ({ page }) => {
  await open(page, 'eq');
  const control = await host(page).locator('.siftbar__enum-control').boundingBox();
  const list = await host(page).getByRole('listbox', { name: 'Status values', exact: true }).boundingBox();
  const popup = await host(page).locator('.siftbar__popup').boundingBox();
  expect(list.x).toBeGreaterThanOrEqual(control.x);
  expect(list.x + list.width).toBeLessThanOrEqual(control.x + control.width + 1);
  expect(list.y).toBeGreaterThanOrEqual(control.y + control.height);
  expect(list.width).toBeLessThan(popup.width / 2);
  expect(await host(page).getByRole('listbox').evaluate(element => Boolean(element.closest('.siftbar__value-cell')))).toBe(true);
});

for (const operator of ['any_of', 'none_of']) {
  test(`${operator} displays selected values as removable chips inside Value without prematurely saving`, async ({ page }) => {
    await open(page, operator);
    await host(page).getByRole('option', { name: 'Active', exact: true }).click();
    await host(page).getByRole('option', { name: 'Archived', exact: true }).click();
    await expect(host(page).locator('.siftbar__enum-control .siftbar__enum-chip')).toHaveCount(2);
    await expect(host(page).locator('.siftbar__enum-chip-label')).toHaveText(['Active', 'Archived']);
    await host(page).getByRole('button', { name: 'Remove Archived from selected values', exact: true }).click();
    await expect(host(page).locator('.siftbar__enum-chip-label')).toHaveText(['Active']);
    await expect(host(page).getByRole('combobox', { name: 'Choose values', exact: true })).toBeFocused();
    await expect(host(page).getByRole('option', { name: 'Archived', exact: true })).toHaveAttribute('aria-selected', 'false');
    expect(await page.evaluate(() => window.fixture.callbacks.length)).toBe(0);
    await leave(page);
    expect(await page.evaluate(() => window.fixture.one.getState().filters[0])).toMatchObject({ operator, value: ['active'] });
    expect(await page.evaluate(() => window.fixture.callbacks.length)).toBe(1);
    expect(await page.evaluate(() => window.fixture.submissions())).toBe(0);
  });
}

test('keyboard token removal, Escape, and removing every value preserve the saved filter', async ({ page }) => {
  await page.evaluate(() => window.fixture.one.setFilters([{ field: 'status', operator: 'any_of', value: ['active', 'off'] }]));
  const saved = await page.evaluate(() => window.fixture.one.getState());
  await host(page).getByRole('button', { name: /^Edit Status/ }).click();
  const remove = host(page).getByRole('button', { name: 'Remove Active from selected values', exact: true });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(host(page).locator('.siftbar__enum-chip-label')).toHaveText(['Archived']);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.fixture.one.getState())).toEqual(saved);
  await host(page).getByRole('button', { name: /^Edit Status/ }).click();
  await host(page).getByRole('button', { name: 'Remove Active from selected values', exact: true }).click();
  await host(page).getByRole('button', { name: 'Remove Archived from selected values', exact: true }).click();
  await expect(host(page).locator('.siftbar__enum-chip')).toHaveCount(0);
  await leave(page);
  expect(await page.evaluate(() => window.fixture.one.getState())).toEqual(saved);
  expect(await page.evaluate(() => window.fixture.callbacks.length)).toBe(1);
});

test('searched enum chips stay removable and HTML-like labels remain plain text', async ({ page }) => {
  await open(page);
  await host(page).getByRole('option', { name: '<b>Untrusted</b>', exact: true }).click();
  const search = host(page).getByRole('combobox', { name: 'Choose values', exact: true });
  await search.fill('no options');
  await expect(host(page).locator('.siftbar__enum-dropdown .siftbar__empty')).toHaveText('No matches.');
  await expect(host(page).locator('.siftbar__enum-chip-label')).toHaveText('<b>Untrusted</b>');
  await expect(host(page).locator('b')).toHaveCount(0);
  await host(page).getByRole('button', { name: 'Remove <b>Untrusted</b> from selected values', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(host(page).locator('.siftbar__enum-chip')).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('mobile enum controls, chips, and dropdown fit the Value column', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await host(page).getByRole('option', { name: 'Active', exact: true }).click();
  await host(page).getByRole('option', { name: 'Archived', exact: true }).click();
  for (const selector of ['.siftbar__enum-control', '.siftbar__enum-dropdown', '.siftbar__enum-chip']) {
    for (const element of await host(page).locator(selector).all()) {
      const box = await element.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('enum token controls and nested dropdown pass automated accessibility checks', async ({ page }) => {
  await open(page);
  await host(page).getByRole('option', { name: 'Active', exact: true }).click();
  await host(page).getByRole('option', { name: 'Archived', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
