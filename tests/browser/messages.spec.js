import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const host = page => page.locator('#one');
const live = page => host(page).locator('[role="status"][aria-live="polite"]');
const snapshot = page => page.evaluate(() => window.fixture.one.getState());
async function mount(page, messages, options = {}) {
  await page.evaluate(({ messages, options }) => {
    const f = window.fixture;
    f.one.destroy();
    // Exercise the same plain JSON boundary as a server-rendered configuration.
    const config = JSON.parse(JSON.stringify({ fields: f.fields, ...options, messages }));
    f.one = new f.Siftbar(document.querySelector('#one'), config);
    window.messagesConfig = config;
  }, { messages, options });
}
async function choose(page, label) {
  await host(page).locator('.siftbar__add').click();
  await host(page).getByRole('option', { name: label, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('fixtures/');
  await page.waitForFunction(() => Boolean(window.fixture));
});

test('JSON messages translate controls, dialogs, chips and announcements without changing state or other instances', async ({ page }) => {
  await mount(page, {
    label: 'Filtros', placeholder: 'Añadir filtro…', addFilterLabel: 'Añadir a {label}',
    chooseField: 'Elegir campo', fieldsLabel: 'Campos', noMatches: 'Sin resultados.',
    field: 'Campo', operator: 'Operador', value: 'Valor',
    addDialogLabel: 'Añadir: {field}', editDialogLabel: 'Editar: {field}', instructions: 'Escape para cancelar.',
    editFilterLabel: 'Editar: {filter}', removeFilterLabel: 'Quitar: {filter}',
    filterAdded: 'Añadido: {filter}', filterUpdated: 'Actualizado: {filter}',
    filterRemoved: 'Quitado.', filtersCleared: 'Todo limpio.', clear: 'Limpiar', clearLabel: 'Limpiar filtros',
    operators: { contains: 'contiene', eq: 'es' }, fieldTypes: { text: 'texto' },
  });
  await expect(host(page).getByRole('group', { name: 'Filtros', exact: true })).toBeVisible();
  const add = host(page).getByRole('combobox', { name: 'Añadir a Filtros', exact: true });
  await expect(add).toHaveAttribute('placeholder', 'Añadir filtro…');
  await add.click();
  await expect(host(page).locator('.siftbar__heading')).toHaveText('Elegir campo');
  await expect(host(page).getByRole('listbox', { name: 'Campos', exact: true })).toBeVisible();
  await add.fill('missing');
  await expect(host(page).locator('.siftbar__empty')).toHaveText('Sin resultados.');
  await add.fill('Name');
  await host(page).getByRole('option', { name: 'Name texto', exact: true }).click();
  await expect(host(page).getByRole('dialog', { name: 'Añadir: Name', exact: true })).toHaveAccessibleDescription('Escape para cancelar.');
  await expect(host(page).getByRole('combobox', { name: 'Campo', exact: true })).toHaveValue('name');
  await host(page).getByRole('combobox', { name: 'Operador', exact: true }).selectOption({ label: 'es' });
  const value = '<b>{filter} $&</b>';
  await host(page).getByLabel('Valor', { exact: true }).fill(value);
  await host(page).getByLabel('Valor', { exact: true }).press('Enter');
  const label = `Name es ${JSON.stringify(value)}`;
  await expect(host(page).getByRole('button', { name: `Editar: ${label}`, exact: true })).toHaveText(label);
  await expect(live(page)).toHaveText(`Añadido: ${label}`);
  await expect(host(page).locator('b')).toHaveCount(0);
  expect((await snapshot(page)).filters[0]).toMatchObject({ field: 'name', operator: 'eq', value });
  await host(page).getByRole('button', { name: `Editar: ${label}`, exact: true }).click();
  await expect(host(page).getByRole('dialog', { name: 'Editar: Name', exact: true })).toBeVisible();
  await host(page).getByLabel('Valor', { exact: true }).fill('nuevo');
  await host(page).getByLabel('Valor', { exact: true }).press('Enter');
  await expect(live(page)).toHaveText('Actualizado: Name es "nuevo"');
  await host(page).getByRole('button', { name: 'Quitar: Name es "nuevo"', exact: true }).click();
  await expect(live(page)).toHaveText('Quitado.');
  await page.evaluate(() => window.fixture.one.setFilters([{ field: 'name', operator: 'eq', value: 'A' }]));
  await host(page).getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(live(page)).toHaveText('Todo limpio.');
  expect((await snapshot(page)).filters).toEqual([]);
  await page.locator('#two .siftbar__add').click();
  await expect(page.locator('#two .siftbar__heading')).toHaveText('Choose a field');
  await expect(page.locator('#two').getByRole('option', { name: 'Name text', exact: true })).toBeVisible();
});

test('booleans, type hints and nullable chips use localized display text but keep typed wire values', async ({ page }) => {
  await mount(page, {
    true: 'sí', false: 'no', booleanOperator: '{value} {operator}',
    operators: { eq: 'es', is_empty: 'vacío' }, fieldTypes: { boolean: 'booleano' },
  });
  await choose(page, 'Online booleano');
  await expect(host(page).locator('.siftbar__operator-select option')).toHaveText(['sí es', 'no es', 'vacío', 'is not empty']);
  await host(page).getByRole('combobox', { name: 'Operator', exact: true }).selectOption('eq:false');
  await host(page).getByRole('combobox', { name: 'Operator', exact: true }).press('Enter');
  await expect(host(page).locator('.siftbar__chip-edit')).toHaveText('Online es no');
  expect((await snapshot(page)).filters[0]).toMatchObject({ field: 'online', operator: 'eq', value: false });
  await host(page).locator('.siftbar__chip-edit').click();
  await host(page).getByRole('combobox', { name: 'Operator', exact: true }).selectOption('is_empty');
  await host(page).getByRole('combobox', { name: 'Operator', exact: true }).press('Enter');
  await expect(host(page).locator('.siftbar__chip-edit')).toHaveText('Online vacío');
  expect((await snapshot(page)).filters[0].value).toBeNull();
});

test('number validation, constraint interpolation, range labels and help are localized', async ({ page }) => {
  await mount(page, {
    from: 'Desde', to: 'Hasta', valuesIn: 'Unidad: {suffix}', rangeValue: '{from} hasta {to}',
    validation: { finiteNumber: 'Falta un número.', minimum: 'Mínimo: {min}', step: 'Paso {step} desde {origin}', rangeOrder: 'Orden incorrecto.' },
    draftDiscarded: 'Borrador descartado.',
  }, { fields: [{ key: 'n', label: 'Distance', type: 'number', min: 2, max: 10, step: 2, suffix: 'km' }] });
  await choose(page, 'Distance number');
  await expect(host(page).locator('.siftbar__help')).toHaveText('Unidad: km');
  const value = host(page).getByLabel('Value', { exact: true });
  await value.press('Enter');
  await expect(host(page).getByRole('alert')).toHaveText('Falta un número.');
  await value.fill('0'); await value.press('Enter');
  await expect(host(page).getByRole('alert')).toHaveText('Mínimo: 2');
  await value.fill('3'); await value.press('Enter');
  await expect(host(page).getByRole('alert')).toHaveText('Paso 2 desde 2');
  await host(page).getByRole('combobox', { name: 'Operator', exact: true }).selectOption('between');
  await host(page).getByLabel('Desde', { exact: true }).fill('8');
  await host(page).getByLabel('Hasta', { exact: true }).fill('2');
  await host(page).getByLabel('Hasta', { exact: true }).press('Enter');
  await expect(host(page).getByRole('alert')).toHaveText('Orden incorrecto.');
  await page.locator('#outside').click();
  await expect(live(page)).toHaveText('Borrador descartado.');
  expect((await snapshot(page)).filters).toEqual([]);
  await choose(page, 'Distance number');
  await host(page).getByRole('combobox', { name: 'Operator', exact: true }).selectOption('between');
  await host(page).getByLabel('Desde', { exact: true }).fill('2');
  await host(page).getByLabel('Hasta', { exact: true }).fill('4');
  await host(page).getByLabel('Hasta', { exact: true }).press('Enter');
  await expect(host(page).locator('.siftbar__chip-edit')).toHaveText('Distance between 2 hasta 4 km');
});

test('enum search, selection status and token removal are localized and remain accessible', async ({ page }) => {
  await mount(page, {
    searchOptions: 'Buscar…', chooseValue: 'Elegir uno', chooseValues: 'Elegir varios',
    valuesLabel: 'Opciones de {field}', selectedValues: 'Elegidos: {values}', noValuesSelected: 'Ninguno.',
    removeSelectedValueLabel: 'Quitar {value}', selectedValueRemoved: 'Quitado: {value}', noMatches: 'Sin opciones.',
    listSeparator: ' / ',
  });
  await choose(page, 'Status enum');
  await expect(host(page).getByRole('combobox', { name: 'Elegir uno', exact: true })).toHaveAttribute('placeholder', 'Buscar…');
  await host(page).getByRole('combobox', { name: 'Operator', exact: true }).selectOption('any_of');
  await expect(host(page).getByRole('listbox', { name: 'Opciones de Status', exact: true })).toBeVisible();
  await expect(host(page).locator('.siftbar__selection')).toHaveText('Ninguno.');
  await host(page).getByRole('option', { name: 'Active', exact: true }).click();
  await host(page).getByRole('option', { name: 'Archived', exact: true }).click();
  await expect(host(page).locator('.siftbar__selection')).toHaveText('Elegidos: Active / Archived');
  await host(page).getByRole('button', { name: 'Quitar Archived', exact: true }).click();
  await expect(live(page)).toHaveText('Quitado: Archived');
  await expect(host(page).getByRole('combobox', { name: 'Elegir varios', exact: true })).toBeFocused();
  await host(page).getByRole('combobox', { name: 'Elegir varios', exact: true }).fill('missing');
  await expect(host(page).locator('.siftbar__empty')).toHaveText('Sin opciones.');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('#outside').click();
  expect((await snapshot(page)).filters[0]).toMatchObject({ field: 'status', operator: 'any_of', value: ['active'] });
});

test('explicit labels and field operator labels win, and caller mutation cannot change messages', async ({ page }) => {
  await mount(page, { label: 'Ignored', placeholder: 'Ignored', clear: 'Limpiar', operators: { eq: 'es' } }, {
    label: 'My filters', placeholder: 'My placeholder',
    fields: [{ key: 'a', label: 'A', type: 'text', operators: ['eq'], operatorLabels: { eq: 'matches exactly' } }],
  });
  await page.evaluate(() => { window.messagesConfig.messages.clear = 'changed'; window.messagesConfig.messages.operators.eq = 'changed'; });
  await expect(host(page).getByRole('combobox', { name: 'My filters: add a filter', exact: true })).toHaveAttribute('placeholder', 'My placeholder');
  await choose(page, 'A text');
  await expect(host(page).locator('.siftbar__operator-select option')).toHaveText(['matches exactly']);
  await host(page).getByLabel('Value', { exact: true }).fill('saved');
  await host(page).getByLabel('Value', { exact: true }).press('Enter');
  await expect(host(page).locator('.siftbar__clear')).toHaveText('Limpiar');
  await expect(host(page).locator('.siftbar__chip-edit')).toHaveText('A matches exactly "saved"');
});

test('invalid messages fail before mounting and leave the host reusable', async ({ page }) => {
  const result = await page.evaluate(() => {
    const f = window.fixture;
    f.one.destroy();
    const host = document.querySelector('#one');
    const before = host.innerHTML;
    const paths = [];
    for (const messages of [null, { clear: '' }, { operators: { eq: 1 } }, { editFilterLabel: '{unknown}' }]) {
      try { new f.Siftbar(host, { fields: f.fields, messages }); }
      catch (error) { paths.push(error.issues[0].path); }
      if (host.innerHTML !== before) throw new Error('Invalid messages changed the host');
    }
    f.one = new f.Siftbar(host, { fields: f.fields, messages: { clear: 'Limpiar' } });
    return paths;
  });
  expect(result).toEqual(['options.messages', 'options.messages.clear', 'options.messages.operators.eq', 'options.messages.editFilterLabel']);
  await expect(host(page).locator('.siftbar')).toHaveCount(1);
  await expect(page.locator('#preserved')).toHaveText('Consumer-owned markup');
});
