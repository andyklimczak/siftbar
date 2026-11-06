import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const host = page => page.locator('#one');
const search = page => host(page).locator('.siftbar__search');
const state = page => page.evaluate(() => window.fixture.one.getState());
const reasons = page => page.evaluate(() => window.fixture.events.map(event => event.reason));

test.beforeEach(async ({ page }) => {
  await page.goto('fixtures/');
  await page.waitForFunction(() => Boolean(window.fixture));
  await page.evaluate(() => {
    const f = window.fixture;
    f.one.destroy();
    // Search defaults to the schema's text fields, without an explicit filter.
    f.one = new f.Siftbar(document.querySelector('#one'), {
      fields: f.fields,
      onChange: (state, detail) => f.callbacks.push({ state, ...detail }),
    });
  });
});

test('typing and pasting stay plain drafts until Enter, without chips or field-name filtering', async ({ page }) => {
  await search(page).click();
  await expect(host(page).getByRole('option')).toHaveCount(5);
  await search(page).pressSequentially('Andy keeps typing a whole search', { delay: 40 });
  await page.waitForTimeout(600); // Longer than the app's former submit debounce.
  await expect(search(page)).toHaveValue('Andy keeps typing a whole search');
  expect((await state(page)).search).toBeUndefined();
  expect(await reasons(page)).toEqual([]);
  await expect(host(page).getByRole('option')).toHaveCount(5);
  await expect(host(page).getByRole('option', { name: 'RAM number', exact: true })).toBeVisible();
  await expect(search(page)).not.toHaveAttribute('aria-activedescendant');
  await search(page).fill('  019d8d94-fda0-7dba-a00c-a869ecf6c7a8  ');
  expect((await state(page)).search).toBeUndefined();
  await expect(host(page).locator('.siftbar__chip')).toHaveCount(0);
  await expect(host(page).locator('button.siftbar__add')).toHaveCount(0);
  await expect(host(page).locator('.siftbar__picker-input')).toHaveCount(0);
  await search(page).press('Enter');
  await expect(search(page)).toHaveValue('019d8d94-fda0-7dba-a00c-a869ecf6c7a8');
  await expect(host(page).locator('.siftbar__popup')).toBeHidden();
  expect(await state(page)).toEqual({ version: 1, combinator: 'and', filters: [], search: '019d8d94-fda0-7dba-a00c-a869ecf6c7a8' });
  expect(await page.evaluate(() => window.fixture.callbacks.at(-1).state.search)).toBe((await state(page)).search);
  await search(page).press('Enter');
  await page.locator('#outside').click();
  expect(await reasons(page)).toEqual(['search']); // Enter, repeat Enter, then blur: once.
  expect(await page.evaluate(() => window.fixture.submissions())).toBe(0);
});

test('the same input opens explicit filters without a separate Add filter button', async ({ page }) => {
  await search(page).fill('andy@test.com');
  await host(page).getByRole('option', { name: 'Name text', exact: true }).click();
  await expect(host(page).locator('.siftbar__value-input')).toBeFocused();
  expect(await reasons(page)).toEqual([]); // Opening an editor mustn't navigate away.
  await host(page).locator('.siftbar__value-input').fill('Andy');
  await host(page).locator('.siftbar__value-input').press('Enter');
  expect((await state(page)).search).toBe('andy@test.com');
  expect((await state(page)).filters[0].value).toBe('Andy');
  expect(await reasons(page)).toEqual(['add']); // Search and chip commit together.
  await expect(search(page)).toHaveValue('andy@test.com');
  await search(page).click();
  await expect(host(page).getByRole('option')).toHaveCount(5);
  await page.keyboard.press('Escape');
  await host(page).locator('.siftbar__chip-edit').click();
  await host(page).locator('.siftbar__value-input').fill('Updated');
  await host(page).locator('.siftbar__value-input').press('Enter');
  expect((await state(page)).search).toBe('andy@test.com');
  await host(page).locator('.siftbar__chip-remove').click();
  expect((await state(page)).search).toBe('andy@test.com');
  await expect(host(page).locator('.siftbar__clear')).toBeVisible();
});

test('clicking or tabbing away commits once without stealing destination focus; Escape cancels text edits', async ({ page }) => {
  await search(page).fill('saved');
  expect((await state(page)).search).toBeUndefined();
  await page.locator('#outside').click();
  await expect.poll(async () => (await state(page)).search).toBe('saved');
  await expect(page.locator('#outside')).toBeFocused();
  expect(await reasons(page)).toEqual(['search']);
  await search(page).fill('cancel me');
  await search(page).press('Escape');
  await expect(host(page).locator('.siftbar__popup')).toBeHidden();
  await expect(search(page)).toHaveValue('saved');
  await search(page).fill('tabbed');
  await search(page).press('Tab');
  await page.keyboard.press('Tab'); // Clear then the enclosing form's submit button.
  await expect.poll(async () => (await state(page)).search).toBe('tabbed');
  await expect(page.getByRole('button', { name: 'Submit form', exact: true })).toBeFocused();
  expect(await reasons(page)).toEqual(['search', 'search']);
});

test('IME completion stays a draft until a non-composing Enter or leaving the bar', async ({ page }) => {
  await search(page).click();
  // fill() uses native insertion, which can end composition itself in Firefox.
  // Simulate the browser's composing input sequence rather than ending it early.
  await search(page).evaluate(input => {
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = '日本語';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, data: '日本語' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', isComposing: true }));
  });
  expect((await state(page)).search).toBeUndefined();
  await search(page).dispatchEvent('compositionend');
  await search(page).dispatchEvent('input', { isComposing: false });
  expect((await state(page)).search).toBeUndefined();
  expect(await reasons(page)).toEqual([]);
  await search(page).press('Enter');
  expect((await state(page)).search).toBe('日本語');
  await page.locator('#outside').click();
  expect(await reasons(page)).toEqual(['search']);
  expect((await state(page)).filters).toEqual([]);
  expect(await page.evaluate(() => window.fixture.submissions())).toBe(0);
});

test('restoration is silent, presets retain search, empty Enter clears only search, and Clear resets both', async ({ page }) => {
  await page.evaluate(() => {
    const bar = window.fixture.one;
    bar.setState({ version: 1, combinator: 'and', filters: [], search: 'saved' });
    bar.setFilters([{ field: 'name', operator: 'contains', value: 'Andy' }], { emit: false });
  });
  await expect(search(page)).toHaveValue('saved');
  expect(await reasons(page)).toEqual([]);
  await search(page).fill('');
  expect((await state(page)).search).toBe('saved');
  await search(page).press('Enter');
  expect((await state(page)).search).toBeUndefined();
  expect((await state(page)).filters).toHaveLength(1);
  await page.evaluate(() => window.fixture.one.setSearch('again'));
  await host(page).locator('.siftbar__clear').click();
  expect(await state(page)).toEqual({ version: 1, combinator: 'and', filters: [] });
  await expect(search(page)).toHaveValue('');
  await expect(host(page).locator('.siftbar__clear')).toBeHidden();
});

test('committed search survives remount but unsubmitted draft text does not', async ({ page }) => {
  await search(page).fill('andy@test.com');
  await search(page).press('Enter');
  await search(page).fill('not yet submitted');
  await page.evaluate(() => {
    const f = window.fixture;
    const saved = f.one.getState();
    f.one.destroy();
    f.one = new f.Siftbar(document.querySelector('#one'), { fields: f.fields });
    f.one.setState(saved);
  });
  await expect(search(page)).toHaveValue('andy@test.com');
  await expect(host(page).locator('.siftbar')).toHaveCount(1);
  expect(await reasons(page)).toEqual(['search']);
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

test('keyboard browsing is deliberate and typing resets field navigation', async ({ page }) => {
  await search(page).fill('Name'); // Even an exact field label searches data.
  await search(page).press('Enter');
  expect((await state(page)).filters).toEqual([]);
  await search(page).press('ArrowDown');
  await expect(search(page)).toHaveAttribute('aria-activedescendant', /option-0$/);
  await search(page).press('Enter');
  await expect(host(page).locator('.siftbar__value-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(search(page)).toBeFocused();
  await search(page).press('ArrowUp');
  await expect(search(page)).toHaveAttribute('aria-activedescendant', /option-4$/);
  await search(page).fill('new query');
  await search(page).press('Enter');
  expect((await state(page)).search).toBe('new query');
  expect((await state(page)).filters).toEqual([]);
});

test('quick search and keyboard picker remain localized, accessible, and contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const f = window.fixture; f.one.destroy();
    f.one = new f.Siftbar(document.querySelector('#one'), { fields: f.fields, quickSearchFields: ['name'],
      messages: { quickSearchLabel: 'Buscar {fields}', quickSearchPlaceholder: 'Buscar…', searchApplied: 'Búsqueda aplicada.' } });
    f.one.focus();
  });
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveAccessibleName('Buscar Name');
  await expect(search(page)).toHaveAttribute('placeholder', 'Buscar…');
  await search(page).fill('<b>{fields}</b>');
  await search(page).press('Enter');
  await search(page).click();
  await expect(host(page).locator('[aria-live]')).toHaveText('Búsqueda aplicada.');
  await expect(host(page).locator('b')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('#one').analyze()).violations).toEqual([]);
  await search(page).press('ArrowDown'); await search(page).press('Enter');
  await expect(host(page).locator('.siftbar__value-input')).toBeFocused();
  expect((await new AxeBuilder({ page }).include('#one').analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveValue('<b>{fields}</b>');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a host may destroy the bar synchronously on a blur-search event', async ({ page }) => {
  await page.evaluate(() => document.querySelector('#one').addEventListener('siftbar:change', () => window.fixture.one.destroy(), { once: true }));
  await search(page).fill('retired');
  await page.locator('#outside').click();
  await expect(host(page).locator('.siftbar')).toHaveCount(0);
  expect(await reasons(page)).toEqual(['search']);
});
