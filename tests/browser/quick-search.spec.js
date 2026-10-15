import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const host = page => page.locator('#one');
const search = page => host(page).locator('.siftbar__search');
const state = page => page.evaluate(() => window.fixture.one.getState());

test.beforeEach(async ({ page }) => {
  await page.goto('fixtures/');
  await page.waitForFunction(() => Boolean(window.fixture));
  await page.evaluate(() => {
    const f = window.fixture;
    f.one.destroy();
    f.one = new f.Siftbar(document.querySelector('#one'), {
      fields: f.fields, quickSearchFields: ['name'],
      onChange: (state, detail) => f.callbacks.push({ state, ...detail }),
    });
  });
});

test('pasted text commits on Enter without field UI, chips, or an enclosing form submission', async ({ page }) => {
  await search(page).click();
  await search(page).fill('  019d8d94-fda0-7dba-a00c-a869ecf6c7a8  ');
  await expect(host(page).locator('.siftbar__popup')).toBeHidden();
  expect((await state(page)).search).toBeUndefined();
  await search(page).press('Enter');
  expect(await state(page)).toEqual({ version: 1, combinator: 'and', filters: [], search: '019d8d94-fda0-7dba-a00c-a869ecf6c7a8' });
  await expect(search(page)).toHaveValue('019d8d94-fda0-7dba-a00c-a869ecf6c7a8');
  await expect(host(page).locator('.siftbar__chip')).toHaveCount(0);
  expect(await page.evaluate(() => window.fixture.events.map(event => event.reason))).toEqual(['search']);
  expect(await page.evaluate(() => window.fixture.callbacks[0].state.search)).toBe((await state(page)).search);
  await search(page).press('Enter');
  expect(await page.evaluate(() => window.fixture.events.length)).toBe(1);
  expect(await page.evaluate(() => window.fixture.submissions())).toBe(0);
});

test('chips use a separate picker and never erase committed search text', async ({ page }) => {
  await search(page).fill('andy@test.com'); await search(page).press('Enter');
  await host(page).locator('button.siftbar__add').click();
  await host(page).locator('.siftbar__picker-input').fill('Name');
  await host(page).getByRole('option', { name: 'Name text', exact: true }).click();
  await host(page).locator('.siftbar__value-input').fill('Andy');
  await host(page).locator('.siftbar__value-input').press('Enter');
  expect((await state(page)).search).toBe('andy@test.com');
  expect((await state(page)).filters[0].value).toBe('Andy');
  await expect(search(page)).toHaveValue('andy@test.com');
  await host(page).locator('.siftbar__chip-remove').click();
  expect((await state(page)).search).toBe('andy@test.com');
  await expect(host(page).locator('.siftbar__clear')).toBeVisible();
});

test('Escape restores committed text; blur and IME Enter do not commit', async ({ page }) => {
  await page.evaluate(() => window.fixture.one.setSearch('saved', { emit: false }));
  await search(page).fill('draft');
  await search(page).press('Escape');
  await expect(search(page)).toHaveValue('saved');
  await search(page).fill('日本語');
  await search(page).dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  expect((await state(page)).search).toBe('saved');
  await page.locator('#outside').click();
  expect((await state(page)).search).toBe('saved');
  expect(await page.evaluate(() => window.fixture.events.length)).toBe(0);
});

test('restoration is silent, presets retain search, empty Enter clears only search, and Clear resets both', async ({ page }) => {
  await page.evaluate(() => {
    const bar = window.fixture.one;
    bar.setState({ version: 1, combinator: 'and', filters: [], search: 'saved' });
    bar.setFilters([{ field: 'name', operator: 'contains', value: 'Andy' }]);
  });
  await expect(search(page)).toHaveValue('saved');
  await search(page).fill(''); await search(page).press('Enter');
  expect((await state(page)).search).toBeUndefined();
  expect((await state(page)).filters).toHaveLength(1);
  await page.evaluate(() => window.fixture.one.setSearch('again'));
  await host(page).locator('.siftbar__clear').click();
  expect(await state(page)).toEqual({ version: 1, combinator: 'and', filters: [] });
  await expect(search(page)).toHaveValue('');
  await expect(host(page).locator('.siftbar__clear')).toBeHidden();
});

test('committed search survives destroy and remount without extra events', async ({ page }) => {
  await search(page).fill('andy@test.com'); await search(page).press('Enter');
  await page.evaluate(() => {
    const f = window.fixture;
    const saved = f.one.getState();
    f.one.destroy();
    f.one = new f.Siftbar(document.querySelector('#one'), { fields: f.fields, quickSearchFields: ['name'] });
    f.one.setState(saved);
  });
  await expect(search(page)).toHaveValue('andy@test.com');
  await expect(host(page).locator('.siftbar')).toHaveCount(1);
  expect(await page.evaluate(() => window.fixture.events.map(event => event.reason))).toEqual(['search']);
});

test('invalid config and search restoration leave existing markup and state intact', async ({ page }) => {
  const result = await page.evaluate(() => {
    const f = window.fixture;
    const target = document.createElement('div'); target.textContent = 'untouched'; document.body.append(target);
    let path;
    try { new f.Siftbar(target, { fields: f.fields, quickSearchFields: ['ram'] }); }
    catch (error) { path = error.issues[0].path; }
    f.one.setSearch('saved', { emit: false });
    try { f.one.setState({ version: 1, combinator: 'and', filters: [], search: 1 }); }
    catch { /* State must remain intact. */ }
    return { path, markup: target.innerHTML, state: f.one.getState() };
  });
  expect(result.path).toBe('options.quickSearchFields[0]');
  expect(result.markup).toBe('untouched');
  expect(result.state.search).toBe('saved');
});

test('quick search and keyboard filter picker remain localized, accessible, and contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const f = window.fixture; f.one.destroy();
    f.one = new f.Siftbar(document.querySelector('#one'), { fields: f.fields, quickSearchFields: ['name'],
      messages: { addFilter: 'Añadir', quickSearchLabel: 'Buscar {fields}', quickSearchPlaceholder: 'Buscar…', searchApplied: 'Búsqueda aplicada.' } });
    f.one.focus();
  });
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveAccessibleName('Buscar Name');
  await expect(search(page)).toHaveAttribute('placeholder', 'Buscar…');
  await search(page).fill('<b>{fields}</b>'); await search(page).press('Enter');
  await expect(host(page).locator('[aria-live]')).toHaveText('Búsqueda aplicada.');
  await expect(host(page).locator('b')).toHaveCount(0);
  await expect(host(page).locator('button.siftbar__add')).toHaveText('Añadir');
  expect((await new AxeBuilder({ page }).include('#one').analyze()).violations).toEqual([]);
  await host(page).locator('button.siftbar__add').focus();
  await page.keyboard.press('Enter');
  await expect(host(page).locator('.siftbar__picker-input')).toBeFocused();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(host(page).locator('.siftbar__popup')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(host(page).locator('button.siftbar__add')).toBeFocused();
  await expect(search(page)).toHaveValue('<b>{fields}</b>');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
