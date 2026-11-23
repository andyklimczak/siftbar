import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockDataApis } from './data-apis.js';
test.beforeEach(async ({ page }) => { await mockDataApis(page); });

test('review examples open with concise setup and keep results logic separate', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('./');
  await expect(page.locator('#basic-count')).toHaveText('8 reviews');
  await expect(page.locator('.code-card')).toHaveCount(6);
  await expect(page.locator('body')).not.toContainText('DummyJSON');
  await expect(page.locator('body')).not.toContainText('setFilters applies');
  await expect(page.locator('.request-url')).toHaveCount(0);
  for (const card of await page.locator('.code-card').all()) {
    const code = card.locator('pre code');
    await expect(code).toContainText('new Siftbar');
    await expect(code).toContainText('import { fields }');
    await expect(code).not.toContainText('const fields =');
    await expect(code).not.toContainText('getState');
    await expect(code).not.toContainText('setState');
    await expect(card.locator('.source-details')).not.toHaveAttribute('open');
    if (await card.getAttribute('data-handler')) {
      await expect(code).toContainText('onChange: updateResults');
      await expect(code).not.toContainText('await fetch(');
      await expect(card.getByRole('button', { name: 'Results logic', exact: true })).toHaveAttribute('aria-pressed', 'false');
    }
    for (const path of (await card.getAttribute('data-sources')).split(',')) expect((await page.request.get(path)).ok()).toBe(true);
  }
  await expect(page.locator('#local-tools')).not.toHaveAttribute('open');
  await page.locator('#local-preset').selectOption('fastFood');
  await expect(page.locator('#local-count')).toHaveText('1 review');
  const before = await page.evaluate(() => window.siftbarDemos.local.getState());
  await page.locator('#local-tools > summary').click();
  await page.locator('#local-state').fill('{"version":2}');
  await page.locator('#local-restore').click();
  await expect(page.locator('#local-error')).toContainText('version');
  expect(await page.evaluate(() => window.siftbarDemos.local.getState())).toEqual(before);
  await page.locator('#local-reset').click();
  await expect(page.locator('#local-count')).toHaveText('8 reviews');
  const source = page.locator('#preset-dropdown .code-card');
  await source.locator('.source-details > summary').click();
  await source.getByRole('button', { name: 'presets.js', exact: true }).click();
  await expect(source.locator('pre code')).toContainText('export const presets');
  await source.locator('.source-details > summary').click();
  await expect(source.locator('pre code')).toContainText('setFilters');
  expect(failures).toEqual([]);
});

for (const scenario of [
  { field: 'Rating number', operator: 'gte', value: '8', count: '2 reviews' },
  { field: 'Released date', operator: 'on', value: '2026-01-23', count: '1 review' },
  { field: 'Category enum', operator: 'eq', option: 'Energy Crisis', count: '2 reviews' },
]) {
  test(`basic example filters ${scenario.field} using supported API fields`, async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#basic-count')).toHaveText('8 reviews');
    const host = page.locator('#basic-filters');
    await host.getByRole('combobox').click();
    await host.getByRole('option', { name: scenario.field, exact: true }).click();
    await host.getByRole('combobox', { name: 'Operator', exact: true }).selectOption(scenario.operator);
    if (scenario.value) await host.getByLabel('Value', { exact: true }).fill(scenario.value);
    if (scenario.option) await host.getByRole('listbox').getByRole('option', { name: scenario.option, exact: true }).click();
    await page.locator('#basic-title').click();
    await expect(page.locator('#basic-count')).toHaveText(scenario.count);
    await expect(page.locator('#buttons-count')).toHaveText('8 reviews');
  });
}

test('basic, buttons, dropdown and Clear remain independent', async ({ page }) => {
  await page.goto('./');
  for (const [index, id] of ['playground', 'preset-buttons', 'preset-dropdown'].entries()) await expect(page.locator('.example-section').nth(index)).toHaveAttribute('id', id);
  await page.locator('#fast-food-preset').click();
  await expect(page.locator('#buttons-count')).toHaveText('1 review');
  await expect(page.locator('#button-filters [data-edit-id]')).toHaveCount(2);
  await page.locator('#energy-preset').click();
  await expect(page.locator('#buttons-count')).toHaveText('2 reviews');
  await expect(page.locator('#basic-count')).toHaveText('8 reviews');
  await page.locator('#local-preset').selectOption('fastFood');
  await expect(page.locator('#local-count')).toHaveText('1 review');
  await page.locator('#local-filters').getByRole('button', { name: /^Remove Rating/ }).click();
  await expect(page.locator('#local-preset')).toHaveValue('custom');
  await expect(page.locator('#local-count')).toHaveText('3 reviews');
  await page.locator('#local-reset').click();
  await expect(page.locator('#local-preset')).toHaveValue('empty');
  await expect(page.locator('#local-count')).toHaveText('8 reviews');
});

test('displayed setup snippets run with consumer-supplied handlers', async ({ page }) => {
  await page.goto('fixtures/');
  await page.evaluate(async () => {
    window.setupChanges = [];
    window.updateResults = state => window.setupChanges.push(state);
    for (const name of ['basic', 'buttons', 'local', 'reports', 'themes', 'modal']) {
      const template = document.createElement('template');
      template.innerHTML = await fetch(`../snippets/${name}.html`).then(response => response.text());
      document.body.append(template.content);
      await import(`../snippets/${name}.js`);
    }
  });
  const search = page.locator('#basic-filters').getByRole('combobox');
  await search.fill('Chicken');
  await search.press('Enter');
  expect(await page.evaluate(() => window.setupChanges.at(-1).search)).toBe('Chicken');
  await page.locator('#fast-food-preset').click();
  expect(await page.evaluate(() => window.setupChanges.at(-1).filters.map(({ field, operator, value }) => ({ field, operator, value })))).toEqual([
    { field: 'category', operator: 'eq', value: 'Running On Empty' }, { field: 'rating', operator: 'gte', value: 8 },
  ]);
  await page.locator('#local-preset').selectOption('energy');
  expect(await page.evaluate(() => window.setupChanges.at(-1).filters[0].value)).toBe('Energy Crisis');
  await page.locator('#local-reset').click();
  expect(await page.evaluate(() => window.setupChanges.at(-1).filters)).toEqual([]);
});

test('theme variables apply independently to top-layer popups', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => Boolean(window.siftbarDemos));
  for (const [host, color] of [['dark-filters', 'rgb(23, 33, 49)'], ['brand-filters', 'rgb(255, 255, 255)']]) {
    const instance = page.locator(`#${host}`);
    await instance.getByRole('combobox').first().click();
    await expect(instance.locator('.siftbar__popup')).toHaveCSS('background-color', color);
    await page.keyboard.press('Escape');
  }
  await expect(page.locator('#dark-filters [data-edit-id]')).toHaveCount(1);
});

test('narrow viewport and long chips keep focus and popup in bounds', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.waitForFunction(() => Boolean(window.siftbarDemos));
  const host = page.locator('#narrow-filters');
  await host.getByRole('button', { name: /^Edit/ }).click();
  const box = await host.locator('.siftbar__popup').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(361);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(641);
  await expect(host.getByLabel('Value', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mobile date ranges wrap without overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('fixtures/');
  await page.waitForFunction(() => Boolean(window.fixture));
  const host = page.locator('#one');
  await host.getByRole('combobox').first().click();
  await host.getByRole('option', { name: 'Created date', exact: true }).click();
  await host.getByRole('combobox', { name: 'Operator', exact: true }).selectOption('between');
  for (const label of ['From (inclusive)', 'To (inclusive)']) {
    const box = await host.getByLabel(label, { exact: true }).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
  }
});

test('modal editing and Escape retain saved filters', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => Boolean(window.siftbarDemos));
  await page.locator('#open-modal').click();
  const host = page.locator('#modal-filters');
  await host.getByRole('combobox').click();
  await host.getByRole('option', { name: 'Rating number', exact: true }).click();
  await host.getByLabel('Value', { exact: true }).fill('8');
  await page.getByRole('heading', { name: 'Filter in a modal', exact: true }).click();
  expect(await page.locator('#modal-state').evaluate(element => JSON.parse(element.value).filters[0].value)).toBe(8);
  await host.getByRole('button', { name: /^Edit/ }).click();
  await page.locator('.modal-scroll').evaluate(element => { element.scrollTop = 35; });
  await page.setViewportSize({ width: 600, height: 500 });
  await host.getByLabel('Value', { exact: true }).fill('9');
  await page.keyboard.press('Escape');
  await expect(page.locator('#filter-dialog')).toBeVisible();
  expect(await page.evaluate(() => window.siftbarDemos.modal.getState().filters[0].value)).toBe(8);
  await page.locator('#close-modal').click();
  await expect(page.locator('#filter-dialog')).toBeHidden();
});

test('standalone script and review ESM pages work without a consumer build', async ({ page }) => {
  await page.goto('examples/vanilla/standalone.html');
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Name text', exact: true }).click();
  await page.getByLabel('Value', { exact: true }).fill('Andy');
  await page.getByRole('heading', { name: 'Standalone script, no build step', exact: true }).click();
  await expect(page.locator('#state')).toContainText('Andy');
  await page.goto('examples/vanilla/');
  await expect(page.locator('#local-count')).toHaveText('8 reviews');
  await page.goto('examples/report-of-week/');
  await expect(page.locator('#reports-count')).toHaveText('8 reviews');
});

test('published guide renders Markdown and keeps section links working', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Documentation', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Siftbar API and integration guide' })).toBeVisible();
  await expect(page.locator('pre code').first()).toContainText("import { Siftbar } from 'siftbar';");
  await expect(page.getByRole('link', { name: 'README', exact: true }))
    .toHaveAttribute('href', 'https://github.com/andyklimczak/siftbar/blob/master/README.md');
  await page.getByRole('link', { name: 'Saved state and validation', exact: true }).click();
  expect(new URL(page.url()).hash).toBe('#advanced-saved-state-and-validation');
  await expect(page.getByRole('heading', { name: 'Advanced: saved state and validation' })).toBeInViewport();
  // The guide should have no broken table-of-contents targets.
  for (const href of await page.locator('a[href^="#"]').evaluateAll(links => links.map(link => link.hash))) {
    await expect(page.locator(href)).toHaveCount(1);
  }
});

test('each example heading links directly to its section', async ({ page }) => {
  await page.goto('./');
  const headings = page.locator('.example-section h2 .example-link');
  await expect(headings).toHaveCount(6);
  for (const link of await headings.all()) {
    const section = await link.evaluate(element => element.closest('.example-section').id);
    await expect(link).toHaveAttribute('href', `#${section}`);
    await link.click();
    expect(new URL(page.url()).hash).toBe(`#${section}`);
  }
  await page.reload();
  await expect(page.locator('#containers')).toBeInViewport();
});

test('Pages assets work at the domain root and project path', async ({ page }) => {
  for (const prefix of ['/', '/siftbar/']) {
    await page.goto(prefix);
    await expect(page.locator('#basic-count')).toHaveText('8 reviews');
    const base = page.url();
    for (const path of ['.nojekyll', 'dist/siftbar.js', 'dist/styles.css', 'snippets/basic.results.js']) {
      expect((await page.request.get(new URL(path, base).href)).ok(), `${prefix}${path}`).toBe(true);
    }
  }
});

test('demo shell passes automated accessibility checks', async ({ page }) => {
  await page.goto('./');
  const basic = page.locator('#playground .code-card');
  await basic.getByRole('button', { name: 'Results logic', exact: true }).click();
  await expect(basic.locator('pre code')).toContainText('function updateResults(');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
