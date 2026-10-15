import { describe, expect, it } from 'vitest';
import { DEFAULT_MESSAGES, formatMessage } from '../../src/core/messages.js';
import { filterLabel, formatValue } from '../../src/core/format.js';
import { SiftbarValidationError, validateMessages, validateState, valueError } from '../../src/core/validation.js';
import type { Field, Filter, OperatorId, SiftbarMessages } from '../../src/core/types.js';

const text: Field = { key: 'name', label: 'Nombre', type: 'text', nullable: true };
const number: Field = { key: 'n', label: 'Número', type: 'number', integer: true, min: 2, max: 10, step: 2, nullable: true };
const date: Field = { key: 'date', label: 'Fecha', type: 'date' };
const boolean: Field = { key: 'bool', label: 'Activo', type: 'boolean' };
const enumeration: Field = { key: 'enum', label: 'Estado', type: 'enum', options: [{ value: 'a', label: 'Uno' }, { value: 'b', label: 'Dos' }] };
const condition = (field: Field, operator: OperatorId, value: Filter['value']): Filter => ({ id: 'filter-1', field: field.key, operator, value });

describe('message configuration', () => {
  it('keeps English defaults, merges partial nested overrides, and defensively copies every group', () => {
    const input = { clear: 'Limpiar', operators: { eq: 'es' }, fieldTypes: { text: 'texto' }, validation: { integer: 'Entero.' } };
    const messages = validateMessages(input);
    expect(validateMessages(undefined)).toEqual(DEFAULT_MESSAGES);
    expect(validateMessages({})).toEqual(DEFAULT_MESSAGES);
    expect(messages.clear).toBe('Limpiar');
    expect(messages.operators.eq).toBe('es');
    expect(messages.operators.neq).toBe('does not equal');
    expect(messages.fieldTypes.text).toBe('texto');
    expect(messages.fieldTypes.date).toBe('date');
    expect(messages.validation.integer).toBe('Entero.');
    expect(messages.validation.text).toBe('Enter a text value.');
    input.clear = 'changed'; input.operators.eq = 'changed'; input.fieldTypes.text = 'changed'; input.validation.integer = 'changed';
    expect(messages.clear).toBe('Limpiar');
    expect(messages.operators.eq).toBe('es');
    expect(messages.fieldTypes.text).toBe('texto');
    expect(messages.validation.integer).toBe('Entero.');
    expect(Object.isFrozen(DEFAULT_MESSAGES)).toBe(true);
    for (const key of ['operators', 'fieldTypes', 'validation'] as const) {
      expect(messages[key]).not.toBe(DEFAULT_MESSAGES[key]);
      expect(Object.isFrozen(DEFAULT_MESSAGES[key])).toBe(true);
    }
  });

  it('accepts frozen and null-prototype JSON mappings without mutating them', () => {
    const input = Object.freeze({ operators: Object.freeze({ eq: 'es' }) });
    expect(validateMessages(input).operators.eq).toBe('es');
    expect(validateMessages(Object.assign(Object.create(null), { clear: 'Limpiar' })).clear).toBe('Limpiar');
  });

  it.each([
    [null, 'options.messages'], [[], 'options.messages'], ['text', 'options.messages'],
    [{ unknown: 'x' }, 'options.messages.unknown'],
    [{ clear: '' }, 'options.messages.clear'], [{ clear: 1 }, 'options.messages.clear'],
    [{ clear: undefined }, 'options.messages.clear'], [{ clear: () => 'x' }, 'options.messages.clear'],
    [{ clear: 'Unknown {parameter}' }, 'options.messages.clear'],
    [{ addFilterLabel: '{filter}' }, 'options.messages.addFilterLabel'],
    [{ operators: null }, 'options.messages.operators'], [{ operators: [] }, 'options.messages.operators'],
    [{ operators: undefined }, 'options.messages.operators'], [{ operators: { eq: 1 } }, 'options.messages.operators.eq'],
    [{ operators: { missing: 'x' } }, 'options.messages.operators.missing'],
    [{ fieldTypes: { custom: 'x' } }, 'options.messages.fieldTypes.custom'],
    [{ validation: { minimum: 'Minimum {max}' } }, 'options.messages.validation.minimum'],
    [JSON.parse('{"__proto__":{"clear":"bad"}}'), 'options.messages.__proto__'],
    [JSON.parse('{"operators":{"constructor":"bad"}}'), 'options.messages.operators.constructor'],
  ])('rejects invalid overrides with a precise path %#', (input, path) => {
    try { validateMessages(input); expect.fail('Expected validation failure'); }
    catch (error) {
      expect(error).toBeInstanceOf(SiftbarValidationError);
      expect((error as SiftbarValidationError).issues[0].path).toBe(path);
    }
  });

  it('interpolates named values once, preserving HTML, replacement tokens, and braces as text', () => {
    const messages = validateMessages({ filterAdded: '{filter} — añadido: {filter}' });
    expect(formatMessage(messages.filterAdded, { filter: '<b>$& {filter}</b>' }))
      .toBe('<b>$& {filter}</b> — añadido: <b>$& {filter}</b>');
    expect(formatMessage('{missing}', {})).toBe('{missing}');
    expect(formatMessage('{value}', { value: 0 })).toBe('0');
  });
});

describe('localized value validation', () => {
  const validation = Object.fromEntries(Object.keys(DEFAULT_MESSAGES.validation).map(key => [key, `translated:${key}`])) as unknown as SiftbarMessages['validation'];
  const messages = validateMessages({ validation });
  it.each([
    [text, 'gt', 'x', 'operatorNotAllowed'], [text, 'is_empty', '', 'nullRequired'],
    [text, 'eq', undefined, 'text'], [boolean, 'eq', 'false', 'boolean'],
    [number, 'eq', NaN, 'finiteNumber'], [number, 'eq', 2.5, 'integer'],
    [number, 'eq', 0, 'minimum'], [number, 'eq', 12, 'maximum'], [number, 'eq', 3, 'step'],
    [number, 'between', [2], 'numberRange'], [number, 'between', [2, 3], 'step'],
    [number, 'between', [8, 2], 'rangeOrder'], [date, 'on', '2026-02-30', 'date'],
    [date, 'between', ['2026-01-01'], 'dateRange'],
    [date, 'between', ['2026-02-01', '2026-01-01'], 'rangeOrder'],
    [enumeration, 'eq', 'missing', 'enumSingle'], [enumeration, 'any_of', [], 'enumMultiple'],
  ] as const)('localizes value errors without changing the validation result %#', (field, operator, value, key) => {
    expect(valueError(field, operator, value, messages)).toBe(`translated:${key}`);
    expect(valueError(field, operator, value)).not.toBe(`translated:${key}`);
  });

  it('interpolates numeric constraints and keeps zero and false valid', () => {
    const messages = validateMessages({ validation: {
      minimum: '≥ {min}', maximum: '≤ {max}', step: 'Paso {step}; inicio {origin}',
    } });
    expect(valueError(number, 'eq', 0, messages)).toBe('≥ 2');
    expect(valueError(number, 'eq', 12, messages)).toBe('≤ 10');
    expect(valueError(number, 'eq', 3, messages)).toBe('Paso 2; inicio 2');
    expect(valueError({ ...number, min: undefined }, 'eq', 3, messages)).toBe('Paso 2; inicio 0');
    expect(valueError({ ...number, min: 0 }, 'eq', 0, messages)).toBeNull();
    expect(valueError(boolean, 'eq', false, messages)).toBeNull();
    expect(valueError(text, 'is_empty', null, messages)).toBeNull();
  });
});

describe('localized chip formatting', () => {
  const messages = validateMessages({
    true: 'sí', false: 'no', operators: { eq: 'es', between: 'entre', any_of: 'incluye', is_empty: 'vacío' },
    filterLabel: '{value} ← {operator} ← {field}', filterLabelWithoutValue: '{operator}: {field}',
    rangeValue: '{from} hasta {to}', valueWithSuffix: '{suffix}: {value}', listSeparator: ' / ',
  });
  it('formats booleans, ranges, lists and empty conditions without changing stored values', () => {
    const cases: [Field, OperatorId, Filter['value'], string][] = [
      [boolean, 'eq', false, 'no ← es ← Activo'],
      [boolean, 'eq', true, 'sí ← es ← Activo'],
      [{ ...number, suffix: 'GB' }, 'between', [2, 4], 'GB: 2 hasta 4 ← entre ← Número'],
      [{ ...number, suffix: 'GB' }, 'eq', 2, 'GB: 2 ← es ← Número'],
      [date, 'between', ['2026-01-01', '2026-01-02'], '2026-01-01 hasta 2026-01-02 ← entre ← Fecha'],
      [enumeration, 'any_of', ['a', 'b'], 'Uno / Dos ← incluye ← Estado'],
      [text, 'is_empty', null, 'vacío: Nombre'],
      [text, 'eq', '<b>{field}</b>', '"<b>{field}</b>" ← es ← Nombre'],
    ];
    for (const [field, operator, value, label] of cases) {
      const filter = condition(field, operator, value);
      const before = JSON.stringify(filter);
      expect(filterLabel(field, filter, messages)).toBe(label);
      expect(JSON.stringify(filter)).toBe(before);
      expect(validateState({ version: 1, combinator: 'and', filters: [filter] }, [field]).filters[0]).toEqual(filter);
    }
  });

  it('keeps per-field operator labels and formatters ahead of global defaults', () => {
    const field: Field = { ...text, operatorLabels: { eq: 'exactamente' }, formatValue: value => `custom:${value}` };
    expect(filterLabel(field, condition(field, 'eq', 'A'), messages)).toBe('custom:A ← exactamente ← Nombre');
    expect(formatValue(boolean, false, messages)).toBe('no');
    expect(filterLabel(text, condition(text, 'eq', 'A'))).toBe('Nombre equals "A"');
  });
});
