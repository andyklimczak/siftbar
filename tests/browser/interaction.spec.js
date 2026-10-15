import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const first = page => page.locator('#one');
const snapshot = page => page.evaluate(() => window.fixture.one.getState());
async function choose(page, field, operator) {
  const host = first(page);
  await host.getByRole('combobox').first().click();
  await host.getByRole('option', { name: new RegExp(`^${field} `) }).click();
  await host.getByRole('combobox', { name: 'Operator', exact: true }).selectOption({ label: operator });
}
async function leave(page) {
  await page.getByRole('button', { name: 'Outside control', exact: true }).click();
  await expect(first(page).locator('.siftbar__popup')).toBeHidden();
}
async function textFilter(page, value = 'Andy', operator = 'contains') {
  await choose(page, 'Name', operator);
  await first(page).getByLabel('Value', { exact: true }).fill(value);
  await leave(page);
}
test.beforeEach(async ({ page }) => {
  await page.goto('fixtures/');
  await page.waitForFunction(() => Boolean(window.fixture));
});

test('field selection opens field, operator, and value together in one editable row', async ({ page }) => {
  const host = first(page);
  await host.getByRole('combobox').first().click();
  await host.getByRole('option', { name: 'Name text', exact: true }).click();
  const field = host.getByRole('combobox', { name: 'Field', exact: true });
  const operator = host.getByRole('combobox', { name: 'Operator', exact: true });
  const value = host.getByLabel('Value', { exact: true });
  await expect(field).toHaveValue('name');
  await expect(operator).toHaveValue('contains');
  await expect(value).toBeFocused();
  const boxes = await Promise.all([field.boundingBox(), operator.boundingBox(), value.boundingBox()]);
  expect(Math.max(...boxes.map(box => box.y)) - Math.min(...boxes.map(box => box.y))).toBeLessThan(2);
  expect(boxes[0].x).toBeLessThan(boxes[1].x);
  expect(boxes[1].x).toBeLessThan(boxes[2].x);
  expect((await snapshot(page)).filters).toEqual([]);
  await value.fill('draft');
  await operator.selectOption('starts_with');
  await expect(value).toHaveValue('draft');
  await field.selectOption('ram');
  await expect(value).toHaveAttribute('type', 'number');
  await expect(value).toHaveValue('');
  await operator.selectOption('between');
  await expect(host.getByLabel('From (inclusive)', { exact: true })).toBeVisible();
  await expect(host.getByLabel('To (inclusive)', { exact: true })).toBeVisible();
  await expect(field).toBeVisible();
  await expect(operator).toBeVisible();
});

test('leaving saves valid drafts once, preserves destination focus, and has no action buttons', async ({ page }) => {
  const host = first(page);
  await choose(page, 'Name', 'equals');
  await expect(host.locator('.siftbar__popup').getByRole('button')).toHaveCount(0);
  await host.getByLabel('Value', { exact: true }).fill('Andy');
  await host.getByRole('combobox', { name: 'Field', exact: true }).focus();
  await host.getByRole('combobox', { name: 'Operator', exact: true }).selectOption('starts_with');
  expect((await snapshot(page)).filters).toEqual([]);
  await leave(page);
  await expect(page.getByRole('button', { name: 'Outside control', exact: true })).toBeFocused();
  expect((await snapshot(page)).filters[0]).toMatchObject({ field: 'name', operator: 'starts_with', value: 'Andy' });
  await leave(page);
  expect(await page.evaluate(() => window.fixture.events.map(event => event.reason))).toEqual(['add']);
  await host.getByRole('button', { name: /^Edit Name/ }).click();
  await host.getByRole('combobox', { name: 'Field', exact: true }).selectOption('ram');
  await host.getByLabel('Value', { exact: true }).fill('1.5');
  await leave(page);
  expect((await snapshot(page)).filters[0]).toMatchObject({ field: 'name', value: 'Andy' });
  expect(await page.evaluate(() => window.fixture.events.length)).toBe(1);
});

test('Tab away saves a scalar draft without trapping or stealing focus', async ({ page }) => {
  await choose(page, 'Name', 'equals');
  await first(page).getByLabel('Value', { exact: true }).fill('tabbed');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Submit form', exact: true })).toBeFocused();
  await expect.poll(async () => (await snapshot(page)).filters[0]?.value).toBe('tabbed');
  await expect(page.getByRole('button', { name: 'Submit form', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.fixture.submissions())).toBe(0);
});

test('untouched empty text is discarded but an explicitly cleared value is preserved', async ({ page }) => {
  await choose(page, 'Name', 'equals');
  await leave(page);
  expect((await snapshot(page)).filters).toEqual([]);
  await choose(page, 'Name', 'equals');
  await first(page).getByLabel('Value', { exact: true }).fill('temporary');
  await first(page).getByLabel('Value', { exact: true }).fill('');
  await leave(page);
  expect((await snapshot(page)).filters[0].value).toBe('');
});

test('switching chips saves only the old draft and opens the clicked chip reliably', async ({ page }) => {
  const host = first(page);
  await textFilter(page, 'first');
  await textFilter(page, 'second');
  await host.getByRole('button', { name: 'Edit Name contains "first"', exact: true }).click();
  await host.getByLabel('Value', { exact: true }).fill('updated');
  await host.getByRole('button', { name: 'Edit Name contains "second"', exact: true }).click();
  await expect(host.getByLabel('Value', { exact: true })).toHaveValue('second');
  expect((await snapshot(page)).filters.map(filter => filter.value)).toEqual(['updated', 'second']);
  await page.keyboard.press('Escape');
  await expect(host.getByRole('button', { name: 'Edit Name contains "second"', exact: true })).toBeFocused();
});

test('text add, repeated field, edit/cancel, remove, clear, events, and form sync', async ({ page }) => {
  await textFilter(page, '  Andy  ');
  expect((await snapshot(page)).filters[0].value).toBe('  Andy  ');
  await textFilter(page, 'A', 'starts with');
  expect((await snapshot(page)).filters).toHaveLength(2);
  await first(page).getByRole('button', { name: /^Edit Name contains/ }).click();
  await first(page).getByLabel('Value', { exact: true }).fill('changed');
  await page.keyboard.press('Escape');
  expect((await snapshot(page)).filters[0].value).toBe('  Andy  ');
  await first(page).getByRole('button', { name: /^Edit Name contains/ }).click();
  await first(page).getByLabel('Value', { exact: true }).fill('<img src=x onerror=window.hacked=true>');
  await leave(page);
  expect((await snapshot(page)).filters[0].id).toBe('filter-1');
  await expect(first(page).locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.hacked)).toBeUndefined();
  await first(page).getByRole('button', { name: /^Remove Name starts with/ }).click();
  await first(page).getByRole('button', { name: 'Clear filters', exact: true }).click();
  expect((await snapshot(page)).filters).toEqual([]);
  const result = await page.evaluate(() => ({ callbacks: window.fixture.callbacks, events: window.fixture.events, submissions: window.fixture.submissions(), hidden: JSON.parse(document.querySelector('#hidden-state').value) }));
  expect(result.callbacks.map(change => change.reason)).toEqual(['add', 'add', 'edit', 'remove', 'clear']);
  expect(result.events.map(change => change.reason)).toEqual(['add', 'add', 'edit', 'remove', 'clear']);
  expect(result.submissions).toBe(0);
  expect(result.hidden.filters).toEqual([]);
});

test('string equality uses explicit labels in the operator selector and chips', async ({ page }) => {
  const host = first(page);
  await textFilter(page, 'Andy', 'equals');
  const chip = host.getByRole('button', { name: 'Edit Name equals "Andy"', exact: true });
  await expect(chip).toBeVisible();
  const before = (await snapshot(page)).filters[0];
  expect(before.operator).toBe('eq');
  await chip.click();
  await host.getByRole('combobox', { name: 'Operator', exact: true }).selectOption({ label: 'does not equal' });
  await leave(page);
  await expect(host.getByRole('button', { name: 'Edit Name does not equal "Andy"', exact: true })).toBeVisible();
  expect((await snapshot(page)).filters[0]).toEqual({ ...before, operator: 'neq' });
});

test('numbers validate edits without destroying the original, with zero and ordered ranges', async ({ page }) => {
  await choose(page, 'RAM', 'between');
  await first(page).getByLabel('From (inclusive)', { exact: true }).fill('0');
  await first(page).getByLabel('To (inclusive)', { exact: true }).fill('64');
  await leave(page);
  await first(page).getByRole('button', { name: /^Edit RAM/ }).click();
  await first(page).getByLabel('From (inclusive)', { exact: true }).fill('65');
  await first(page).getByLabel('From (inclusive)', { exact: true }).press('Enter');
  await expect(first(page).getByRole('alert')).toContainText('Range start');
  expect((await snapshot(page)).filters[0].value).toEqual([0, 64]);
  await first(page).getByLabel('From (inclusive)', { exact: true }).fill('1.5');
  await first(page).getByLabel('From (inclusive)', { exact: true }).press('Enter');
  await expect(first(page).getByRole('alert')).toContainText('whole number');
  await page.keyboard.press('Escape');
  await expect(first(page).getByRole('button', { name: /^Edit RAM/ })).toBeFocused();
  await choose(page, 'RAM', '≥');
  await first(page).getByLabel('Value', { exact: true }).fill('');
  await first(page).getByLabel('Value', { exact: true }).press('Enter');
  await expect(first(page).getByRole('alert')).toContainText('finite number');
  expect((await snapshot(page)).filters).toHaveLength(1);
});

test('changing a field discards incompatible values and clicking the add input saves a valid edit', async ({ page }) => {
  await textFilter(page);
  const host = first(page);
  await host.getByRole('button', { name: /^Edit Name/ }).click();
  await host.getByRole('combobox', { name: 'Field', exact: true }).selectOption('ram');
  await expect(host.getByRole('combobox', { name: 'Operator', exact: true })).toHaveValue('eq');
  await expect(host.getByLabel('Value', { exact: true })).toHaveValue('');
  await host.getByLabel('Value', { exact: true }).fill('64');
  await host.getByRole('combobox').first().click();
  await expect(host.getByRole('option', { name: 'Name text', exact: true })).toBeVisible();
  expect((await snapshot(page)).filters[0]).toMatchObject({ id: 'filter-1', field: 'ram', value: 64 });
  await page.keyboard.press('Escape');
});

test('date-only ranges and incompatible draft values', async ({ page }) => {
  await choose(page, 'Created', 'between');
  await first(page).getByLabel('From (inclusive)', { exact: true }).fill('2026-10-01');
  await first(page).getByLabel('To (inclusive)', { exact: true }).fill('2026-10-31');
  await leave(page);
  expect((await snapshot(page)).filters[0].value).toEqual(['2026-10-01', '2026-10-31']);
  await first(page).getByRole('button', { name: /^Edit Created/ }).click();
  await first(page).getByRole('combobox', { name: 'Operator', exact: true }).selectOption('before');
  await expect(first(page).getByLabel('Value', { exact: true })).toHaveValue('');
  await first(page).getByLabel('Value', { exact: true }).press('Enter');
  await expect(first(page).getByRole('alert')).toContainText('valid date');
  expect((await snapshot(page)).filters[0].operator).toBe('between');
});

test('boolean and nullable choices omit the value column and save only when leaving', async ({ page }) => {
  const host = first(page);
  await choose(page, 'Online', 'equals false');
  expect((await snapshot(page)).filters).toEqual([]);
  await expect(host.locator('.siftbar__value-cell')).toHaveCount(0);
  await expect(host.locator('.siftbar__editor-row .siftbar__label')).toHaveCount(2);
  await leave(page);
  expect((await snapshot(page)).filters[0].value).toBe(false);
  await host.getByRole('button', { name: /^Edit Online/ }).click();
  await host.getByRole('combobox', { name: 'Operator', exact: true }).selectOption('eq:true');
  expect((await snapshot(page)).filters[0].value).toBe(false);
  await page.keyboard.press('Escape');
  expect((await snapshot(page)).filters[0].value).toBe(false);
  await choose(page, 'Name', 'is empty');
  expect((await snapshot(page)).filters).toHaveLength(1);
  await expect(host.locator('.siftbar__value-cell')).toHaveCount(0);
  await leave(page);
  expect((await snapshot(page)).filters[1].value).toBeNull();
  await host.getByRole('button', { name: 'Edit Name is empty', exact: true }).click();
  await host.getByRole('combobox', { name: 'Operator', exact: true }).selectOption('is_not_empty');
  await expect(host.locator('.siftbar__value-cell')).toHaveCount(0);
  await expect(host.locator('.siftbar__editor-row .siftbar__label')).toHaveCount(2);
  expect((await snapshot(page)).filters[1].operator).toBe('is_empty');
  await leave(page);
  expect((await snapshot(page)).filters[1].operator).toBe('is_not_empty');
  await host.getByRole('button', { name: 'Edit Name is not empty', exact: true }).click();
  await host.getByRole('combobox', { name: 'Operator', exact: true }).selectOption('eq');
  await expect(host.getByLabel('Value', { exact: true })).toBeVisible();
});

test('enum single and searchable multi-select preserve stable values', async ({ page }) => {
  await choose(page, 'Status', 'equals');
  await first(page).getByRole('option', { name: 'Active', exact: true }).click();
  await leave(page);
  expect((await snapshot(page)).filters[0].value).toBe('active');
  await choose(page, 'Status', 'is any of');
  await leave(page);
  expect((await snapshot(page)).filters).toHaveLength(1);
  await choose(page, 'Status', 'is any of');
  await first(page).getByRole('option', { name: 'Archived', exact: true }).click();
  await first(page).getByRole('combobox', { name: 'Choose values', exact: true }).fill('Untrusted');
  await first(page).getByRole('listbox', { name: 'Status values', exact: true }).getByRole('option').click();
  await leave(page);
  expect((await snapshot(page)).filters[1].value).toEqual(['off', '<b>x</b>']);
  await expect(first(page).locator('b')).toHaveCount(0);
});

test('unselected enum search text is discarded on leaving without changing the saved chip', async ({ page }) => {
  const host = first(page);
  await choose(page, 'Status', 'equals');
  await host.getByRole('option', { name: 'Active', exact: true }).click();
  await leave(page);
  const before = await snapshot(page);
  await host.getByRole('button', { name: 'Edit Status equals Active', exact: true }).click();
  const value = host.getByRole('combobox', { name: 'Choose a value', exact: true });
  await expect(value).toHaveValue('Active');
  await value.fill('Archived');
  await leave(page);
  expect(await snapshot(page)).toEqual(before);
  await host.getByRole('button', { name: 'Edit Status equals Active', exact: true }).click();
  await value.fill('Archived');
  await host.getByRole('option', { name: 'Archived', exact: true }).click();
  await leave(page);
  expect((await snapshot(page)).filters[0]).toEqual({ ...before.filters[0], value: 'off' });
});

test('keyboard-only creation, chip edit, Escape, aliases, and deliberate Backspace deletion', async ({ page }) => {
  const input = first(page).getByRole('combobox').first();
  await input.focus();
  await page.keyboard.type('hostname');
  await page.keyboard.press('Enter');
  await expect(first(page).getByRole('combobox', { name: 'Operator', exact: true })).toHaveValue('contains');
  await expect(first(page).getByLabel('Value', { exact: true })).toBeFocused();
  await page.keyboard.type('Andy');
  await page.keyboard.press('Enter');
  expect((await snapshot(page)).filters[0].value).toBe('Andy');
  await expect(input).toBeFocused();
  await page.keyboard.press('Backspace');
  expect((await snapshot(page)).filters).toHaveLength(1);
  await expect(first(page).getByRole('button', { name: /^Edit Name/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Changed');
  await page.keyboard.press('Escape');
  expect((await snapshot(page)).filters[0].value).toBe('Andy');
  await input.focus();
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  expect((await snapshot(page)).filters).toEqual([]);
  await expect(input).toBeFocused();
});

test('keyboard number/boolean/enum flows and native date focus/commit', async ({ page }) => {
  const host = first(page);
  async function pick(field, operator) {
    await host.getByRole('combobox').first().focus();
    await page.keyboard.type(field);
    await page.keyboard.press('Enter');
    const select = host.getByRole('combobox', { name: 'Operator', exact: true });
    await select.focus();
    if (operator === 'between') await select.press('End');
    else if (operator === 'equals false') { await select.press('Home'); await expect(select).toBeFocused(); await select.press('ArrowDown'); }
    else if (operator === 'is any of') { await select.press('End'); await expect(select).toBeFocused(); await select.press('ArrowUp'); }
    await expect(select).toBeFocused();
    await select.press('Enter');
  }
  await pick('RAM', 'between');
  await expect(host.getByLabel('From (inclusive)', { exact: true })).toBeFocused();
  await page.keyboard.type('0'); await page.keyboard.press('Tab');
  await page.keyboard.type('64'); await page.keyboard.press('Enter');
  expect((await snapshot(page)).filters[0].value).toEqual([0, 64]);
  await pick('Created', 'on');
  const date = host.getByLabel('Value', { exact: true });
  await expect(date).toBeFocused();
  // Native date segment editing differs by browser/locale; fill establishes the
  // native date, while keyboard-only selection and Enter exercise our flow.
  await date.fill('2026-10-13'); await page.keyboard.press('Enter');
  expect((await snapshot(page)).filters[1].value).toBe('2026-10-13');
  await pick('Online', 'equals false');
  expect((await snapshot(page)).filters[2].value).toBe(false);
  await pick('Status', 'is any of');
  await expect(host.getByRole('combobox', { name: 'Choose values', exact: true })).toBeFocused();
  await page.keyboard.type('Archived'); await page.keyboard.press('Enter');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Active'); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Submit form', exact: true })).toBeFocused();
  await expect.poll(async () => (await snapshot(page)).filters[3]?.value).toEqual(['off', 'active']);
  await host.getByRole('button', { name: /^Edit Status/ }).focus();
  await page.keyboard.press('Enter');
  await expect(host.getByRole('combobox', { name: 'Choose values', exact: true })).toBeFocused();
  await page.keyboard.type('Archived'); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await snapshot(page)).filters[3]?.value).toEqual(['active']);
});

test('destroy aborts listeners even on retained old controls', async ({ page }) => {
  await textFilter(page);
  const result = await page.evaluate(() => {
    const f = window.fixture;
    const oldButton = document.querySelector('#one [data-edit-id]');
    f.one.destroy();
    oldButton.click();
    return { events: f.events.length, markup: document.querySelector('#one').innerHTML };
  });
  expect(result.events).toBe(1);
  expect(result.markup).toContain('Consumer-owned markup');
  expect(result.markup).not.toContain('siftbar__');
});

test('arrow navigation, native text keys, IME Enter, and Tab do not trap focus or submit', async ({ page }) => {
  const input = first(page).getByRole('combobox').first();
  await input.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(first(page).getByRole('dialog')).toHaveAttribute('aria-label', 'Add RAM filter');
  await page.keyboard.press('Escape');
  await choose(page, 'Name', 'contains');
  const value = first(page).getByLabel('Value', { exact: true });
  await value.fill('Andy');
  await value.press('ArrowLeft');
  await value.evaluate(input => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true })));
  expect((await snapshot(page)).filters).toEqual([]);
  await value.press('Enter');
  expect((await snapshot(page)).filters[0].value).toBe('Andy');
  await input.click(); // Reopen after commit even when the add input retained focus.
  await input.press('Tab'); // Clear button.
  await page.keyboard.press('Tab'); // Outside component -> submit button.
  await expect(page.getByRole('button', { name: 'Submit form', exact: true })).toBeFocused();
  await expect(first(page).locator('.siftbar__popup')).toBeHidden();
  expect(await page.evaluate(() => window.fixture.submissions())).toBe(0);
});

test('restoration, clear, and teardown discard valid drafts rather than auto-saving them', async ({ page }) => {
  await choose(page, 'Name', 'equals');
  await first(page).getByLabel('Value', { exact: true }).fill('not saved');
  await page.evaluate(() => window.fixture.one.setState({ version: 1, combinator: 'and', filters: [
    { id: 'restored', field: 'ram', operator: 'eq', value: 32 },
  ] }));
  await leave(page);
  expect((await snapshot(page)).filters[0].value).toBe(32);
  expect(await page.evaluate(() => window.fixture.events)).toEqual([]);
  await first(page).getByRole('button', { name: /^Edit RAM/ }).click();
  await first(page).getByLabel('Value', { exact: true }).fill('64');
  await page.evaluate(() => window.fixture.one.clear());
  await leave(page);
  expect((await snapshot(page)).filters).toEqual([]);
  await choose(page, 'Name', 'equals');
  await first(page).getByLabel('Value', { exact: true }).fill('destroyed draft');
  // Destroy during blur, after the library scheduled its deferred auto-save.
  await page.evaluate(() => document.querySelector('#one .siftbar').addEventListener('focusout', () => window.fixture.one.destroy(), { once: true }));
  await first(page).getByLabel('Value', { exact: true }).press('Tab');
  await expect(first(page).locator('.siftbar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Outside control', exact: true }).click();
  expect(await page.evaluate(() => window.fixture.events.map(event => event.reason))).toEqual(['clear']);
});

test('setFilters applies plain presets, emits by default, and validates atomically', async ({ page }) => {
  const applied = await page.evaluate(() => {
    const conditions = [{ field: 'status', operator: 'any_of', value: ['active'] }];
    window.fixture.one.setFilters(conditions);
    conditions[0].value.push('off');
    return window.fixture.one.getState();
  });
  expect(applied.filters[0].value).toEqual(['active']);
  expect(applied.filters[0].id).toBe('filter-1');
  await first(page).getByRole('button', { name: /^Edit Status/ }).click();
  await first(page).getByRole('combobox', { name: 'Choose values', exact: true }).fill('draft search');
  const result = await page.evaluate(() => {
    try { window.fixture.one.setFilters([{ field: 'ram', operator: 'eq', value: '32' }]); }
    catch (error) { return { state: window.fixture.one.getState(), path: error.issues[0].path }; }
  });
  expect(result.state).toEqual(applied);
  expect(result.path).toBe('filters[0].value');
  await expect(first(page).getByRole('combobox', { name: 'Choose values', exact: true })).toHaveValue('draft search');
  const changes = await page.evaluate(() => {
    window.fixture.one.setFilters([{ field: 'ram', operator: 'eq', value: 32 }], { emit: false });
    const silent = window.fixture.one.getState();
    window.fixture.one.setFilters([]);
    return { silent, reasons: window.fixture.events.map(event => event.reason), empty: window.fixture.one.getState() };
  });
  expect(changes.silent.filters[0].id).toBe('filter-2');
  expect(changes.reasons).toEqual(['set', 'set']);
  expect(changes.empty.filters).toEqual([]);
});

test('set is silent by default, atomic on invalid input, detached, and emits only explicitly', async ({ page }) => {
  await textFilter(page);
  const result = await page.evaluate(() => {
    const f = window.fixture;
    const restored = { version: 1, combinator: 'and', filters: [{ id: 'filter-5', field: 'status', operator: 'any_of', value: ['off'] }] };
    f.one.setState(restored);
    restored.filters[0].value.push('active');
    f.one.getState().filters[0].value.push('active');
    let error;
    try { f.one.setState({ ...f.one.getState(), filters: [...f.one.getState().filters, ...f.one.getState().filters] }); }
    catch (failure) { error = { name: failure.name, issues: failure.issues }; }
    const after = f.one.getState();
    f.one.setState(after, { emit: true });
    return { after, error, reasons: f.callbacks.map(c => c.reason) };
  });
  expect(result.after.filters[0].value).toEqual(['off']);
  expect(result.error.name).toBe('SiftbarValidationError');
  expect(result.error.issues[0].code).toBe('duplicate');
  expect(result.reasons).toEqual(['add', 'set']);
  await textFilter(page, 'Second');
  expect((await snapshot(page)).filters.map(f => f.id)).toEqual(['filter-5', 'filter-2']);
});

test('invalid configuration is structured and leaves the host untouched; default operators are optional', async ({ page }) => {
  const result = await page.evaluate(() => {
    const host = document.createElement('div');
    host.textContent = 'Existing markup';
    document.body.append(host);
    let error;
    try { new window.fixture.Siftbar(host, { fields: window.fixture.fields, label: 3, theme: 'unknown' }); }
    catch (failure) { error = { name: failure.name, issues: failure.issues }; }
    const before = host.textContent;
    const instance = new window.fixture.Siftbar(host, { fields: [{ key: 'name', label: 'Default text', type: 'text', defaultOperator: 'contains', operators: ['contains'] }] });
    host.id = 'default-operator';
    return { error, before, empty: instance.getState() };
  });
  expect(result.error.name).toBe('SiftbarValidationError');
  expect(result.error.issues.map(issue => issue.path)).toEqual(['options.label', 'options.theme']);
  expect(result.before).toBe('Existing markup');
  const host = page.locator('#default-operator');
  await host.getByRole('combobox').click();
  await host.getByRole('option', { name: 'Default text text', exact: true }).click();
  await expect(host.getByLabel('Value', { exact: true })).toBeFocused();
  expect(result.empty.filters).toEqual([]);
});

test('event and callback snapshots are isolated, including recipient mutation', async ({ page }) => {
  await page.evaluate(() => document.querySelector('#one').addEventListener('siftbar:change', event => { event.detail.state.filters[0].value = 'tampered'; }));
  await textFilter(page);
  expect((await snapshot(page)).filters[0].value).toBe('Andy');
  expect(await page.evaluate(() => window.fixture.callbacks[0].state.filters[0].value)).toBe('Andy');
});

test('invalid restoration leaves an in-progress edit intact', async ({ page }) => {
  await textFilter(page);
  await first(page).getByRole('button', { name: /^Edit Name/ }).click();
  await first(page).getByLabel('Value', { exact: true }).fill('unsaved');
  await page.evaluate(() => { try { window.fixture.one.setState({ version: 2 }); } catch { /* Expected rejection. */ } });
  await expect(first(page).getByLabel('Value', { exact: true })).toHaveValue('unsaved');
  expect((await snapshot(page)).filters[0].value).toBe('Andy');
});

test('multiple instances, repeated destroy/remount, preserved host markup, and cancellation cleanup', async ({ page }) => {
  await textFilter(page);
  expect(await page.evaluate(() => window.fixture.two.getState().filters)).toEqual([]);
  const result = await page.evaluate(() => {
    const f = window.fixture;
    let duplicate = false;
    try { new f.Siftbar(document.querySelector('#one'), { fields: f.fields }); } catch { duplicate = true; }
    const saved = f.one.getState();
    for (let i = 0; i < 10; i++) {
      f.one.focus(); f.one.destroy(); f.one.destroy();
      f.one = new f.Siftbar(document.querySelector('#one'), { fields: f.fields });
      f.one.setState(saved);
    }
    return { duplicate, state: f.one.getState(), preserved: document.querySelector('#preserved').textContent };
  });
  expect(result.duplicate).toBe(true);
  expect(result.state.filters[0].value).toBe('Andy');
  expect(result.preserved).toBe('Consumer-owned markup');
  await expect(first(page).locator('.siftbar')).toHaveCount(1);
  await expect(page.locator('.siftbar__popup:popover-open')).toHaveCount(0);
  await page.getByRole('button', { name: 'Outside control' }).click();
});

test('automated accessibility checks on empty, picker, value editor, error, and chips', async ({ page }) => {
  const scan = async () => expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await scan();
  await first(page).getByRole('combobox').first().click(); await scan();
  await page.keyboard.press('Escape');
  await choose(page, 'RAM', 'equals'); await scan();
  await first(page).getByLabel('Value', { exact: true }).press('Enter'); await scan();
  await first(page).getByLabel('Value', { exact: true }).fill('0');
  await leave(page); await scan();
});
