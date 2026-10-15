import { describe, expect, it } from 'vitest';
import { isCalendarDate, SiftbarValidationError, validateSchema, validateState, valueError } from '../../src/core/validation.js';
import { OPERATOR_LABELS, operatorLabel, operatorsFor } from '../../src/core/operators.js';
import { StateStore } from '../../src/core/state.js';
import { filterLabel } from '../../src/core/format.js';
import type { Field, FilterState, OperatorId } from '../../src/core/types.js';
import { filterRecords } from '../../examples/vanilla/evaluate.js';

const fields = validateSchema([
  { key: 'name', label: 'Name', type: 'text', nullable: true },
  { key: 'ram', label: 'RAM', type: 'number', integer: true, min: 0, max: 256 },
  { key: 'created', label: 'Created', type: 'date' },
  { key: 'online', label: 'Online', type: 'boolean', nullable: true },
  { key: 'status', label: 'Status', type: 'enum', options: [{ value: 'active', label: 'Active' }, { value: 'off', label: 'Archived' }] },
]);
const state = (field = 'name', operator: OperatorId = 'contains', value: unknown = '  Andy  '): unknown => ({
  version: 1, combinator: 'and', filters: [{ id: 'filter-1', field, operator, value }],
});

describe('schema and operators', () => {
  it('uses explicit equality labels without changing wire IDs or custom labels', () => {
    expect(OPERATOR_LABELS.eq).toBe('equals');
    expect(OPERATOR_LABELS.neq).toBe('does not equal');
    for (const [index, operator, value, label] of [
      [0, 'eq', 'Andy', 'Name equals "Andy"'],
      [0, 'neq', 'Andy', 'Name does not equal "Andy"'],
      [1, 'eq', 32, 'RAM equals 32'],
      [4, 'eq', 'active', 'Status equals Active'],
      [3, 'eq', false, 'Online equals false'],
    ] as const) {
      const filter = validateState(state(fields[index].key, operator, value), fields).filters[0];
      expect(filter.operator).toBe(operator);
      expect(filterLabel(fields[index], filter)).toBe(label);
    }
    expect(operatorLabel({ ...fields[0], operatorLabels: { eq: 'matches exactly' } }, 'eq')).toBe('matches exactly');
  });
  it('has exactly the appropriate operators and nullable choices', () => {
    expect(operatorsFor(fields[0])).toContain('contains');
    expect(operatorsFor(fields[0])).not.toContain('gt');
    expect(operatorsFor(fields[1])).toContain('between');
    expect(operatorsFor(fields[2])).toEqual(['on', 'before', 'after', 'between']);
    expect(operatorsFor(fields[3])).toEqual(['eq', 'is_empty', 'is_not_empty']);
    expect(operatorsFor(fields[4])).toEqual(['eq', 'neq', 'any_of', 'none_of']);
  });
  it.each([
    [], [{ key: 'a', label: 'A', type: 'unknown' }],
    [{ key: 'a', label: 'A', type: 'text', operators: ['gt'] }],
    [{ key: 'a', label: 'A', type: 'text', operators: [] }],
    [{ key: 'a', label: 'A', type: 'text', operators: ['eq', 'eq'] }],
    [{ key: 'a', label: 'A', type: 'text', defaultOperator: 'gt' }],
    [{ key: 'a', label: 'A', type: 'text', nullable: 'yes' }],
    [{ key: 'a', label: 'A', type: 'number', step: 0 }],
    [{ key: 'a', label: 'A', type: 'number', min: 10, max: 0 }],
    [{ key: 'a', label: 'A', type: 'number', max: Infinity }],
    [{ key: 'a', label: 'A', type: 'enum', options: [] }],
    [{ key: 'a', label: 'A', type: 'enum', options: [{ value: 1, label: 'One' }] }],
    [{ key: 'a', label: 'A', type: 'enum', options: [{ value: 'x', label: 'X' }, { value: 'x', label: 'Y' }] }],
    [{ key: 'a', label: 'A', type: 'text' }, { key: 'a', label: 'B', type: 'date' }],
  ].map(input => ({ input })))('rejects invalid schema %#', ({ input }) => expect(() => validateSchema(input)).toThrow(SiftbarValidationError));
  it('copies nested configuration arrays and labels without mutating inputs', () => {
    const config = [{ key: 'a', label: 'A', type: 'enum', options: [{ value: 'x', label: 'X' }], aliases: ['old'], operators: ['eq'], operatorLabels: { eq: 'equals' } }];
    const copy = validateSchema(config);
    config[0].options[0].label = 'Changed'; config[0].aliases.push('new'); config[0].operatorLabels.eq = 'changed';
    expect((copy[0] as Extract<Field, { type: 'enum' }>).options[0].label).toBe('X');
    expect(copy[0].aliases).toEqual(['old']); expect(copy[0].operatorLabels?.eq).toBe('equals');
  });
});
describe('typed values', () => {
  it.each([NaN, Infinity, -Infinity, '', '32', null, undefined, false, 1.5, -1, 257])('rejects invalid integer number %s', value => expect(() => validateState(state('ram', 'eq', value), fields)).toThrow());
  it('preserves zero and false as real typed values', () => {
    expect(validateState(state('ram', 'eq', 0), fields).filters[0].value).toBe(0);
    expect(validateState(state('online', 'eq', false), fields).filters[0].value).toBe(false);
    expect(() => validateState(state('online', 'eq', 'false'), fields)).toThrow();
  });
  it('keeps every text character, including empty text and HTML-looking values', () => {
    for (const value of ['  Andy  ', '', '<script>alert(1)</script>', 'こんにちは']) {
      const valid = validateState(state('name', 'eq', value), fields);
      expect(valid.filters[0].value).toBe(value);
      expect(validateState(JSON.parse(JSON.stringify(valid)), fields)).toEqual(valid);
    }
  });
  it('validates decimal steps from min without rounding', () => {
    const field: Field = { key: 'n', label: 'N', type: 'number', min: 0.1, step: 0.2 };
    expect(valueError(field, 'eq', 0.3)).toBeNull();
    expect(valueError(field, 'eq', 0.31)).toContain('steps');
    expect(valueError(field, 'eq', 0.1)).toBeNull();
    expect(valueError({ ...field, min: undefined }, 'eq', 0.3)).toContain('steps');
  });
  it.each([[32, 64], [0, 0]])('accepts inclusive ordered number range %j', (a, b) => expect(() => validateState(state('ram', 'between', [a, b]), fields)).not.toThrow());
  it.each([[64, 32], [0, Infinity], ['0', 32], [], [1], [1, 2, 3]])('rejects invalid number range %j', (...range) => expect(() => validateState(state('ram', 'between', range), fields)).toThrow());
  it.each(['2024-02-29', '2000-02-29', '0001-01-01', '9999-12-31', '2026-10-31'])('accepts actual date %s', value => expect(isCalendarDate(value)).toBe(true));
  it.each(['2026-02-29', '1900-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '2026-00-10', '2026-10-00', '2026-1-1', '2026-10-13T00:00:00Z', new Date()])('rejects invalid date %s', value => expect(isCalendarDate(value)).toBe(false));
  it('round trips date-only ranges without using timezones', () => {
    const valid = validateState(state('created', 'between', ['2026-10-01', '2026-10-31']), fields);
    expect(validateState(JSON.parse(JSON.stringify(valid)), fields)).toEqual(valid);
    expect(() => validateState(state('created', 'between', ['2026-10-31', '2026-10-01']), fields)).toThrow();
  });
  it('uses stable enum identifiers and exact multi-selection order', () => {
    const valid = validateState(state('status', 'any_of', ['off', 'active']), fields);
    expect(valid.filters[0].value).toEqual(['off', 'active']);
    expect(filterLabel(fields[4], valid.filters[0])).toBe('Status is any of Archived, Active');
    for (const value of [[], ['active', 'active'], ['missing'], [1], 'active']) expect(() => validateState(state('status', 'any_of', value), fields)).toThrow();
    expect(() => validateState(state('status', 'eq', 'Active'), fields)).toThrow();
  });
  it('requires explicit nullable support and exactly null for empty operators', () => {
    expect(() => validateState(state('name', 'is_empty', null), fields)).not.toThrow();
    for (const value of ['', 0, false, undefined]) expect(() => validateState(state('name', 'is_empty', value), fields)).toThrow();
    expect(() => validateState(state('ram', 'is_empty', null), fields)).toThrow();
  });
});
describe('state and identity', () => {
  it('sets plain conditions with generated IDs and detached values', () => {
    const store = new StateStore(fields);
    const conditions = [
      { field: 'status', operator: 'any_of', value: ['active'] },
      { field: 'name', operator: 'contains', value: 'A' },
      { field: 'name', operator: 'contains', value: 'B' },
    ];
    store.setFilters(conditions);
    conditions[0].value = ['off'];
    expect(store.get().filters.map(filter => filter.id)).toEqual(['filter-1', 'filter-2', 'filter-3']);
    expect(store.get().filters[0].value).toEqual(['active']);
    expect(store.get().filters.map(filter => filter.field)).toEqual(['status', 'name', 'name']);
    store.setFilters([]);
    expect(store.get().filters).toEqual([]);
  });
  it('rejects invalid condition lists atomically without consuming IDs', () => {
    const store = new StateStore(fields);
    store.setFilters([{ field: 'name', operator: 'eq', value: 'saved' }]);
    const before = store.get();
    const sparse = new Array(1);
    class Condition { field = 'name'; operator = 'eq'; value = 'class instance'; }
    for (const input of [null, {}, [null], sparse, [new Condition()],
      [{ id: 'supplied', field: 'name', operator: 'eq', value: 'A' }],
      [{ field: 'unknown', operator: 'eq', value: 'A' }],
      [{ field: 'name', operator: 'eq', value: 'A', extra: true }],
      [{ field: 'name', operator: 'eq', value: 'A' }, { field: 'ram', operator: 'eq', value: '32' }],
    ]) {
      expect(() => store.setFilters(input)).toThrow(SiftbarValidationError);
      expect(store.get()).toEqual(before);
    }
    expect(store.freshId()).toBe('filter-2');
  });
  it('keeps condition validation paths simple and avoids restored ID collisions', () => {
    const store = new StateStore(fields);
    store.set(state('name', 'eq', 'existing'));
    try { store.setFilters([{ field: 'ram', operator: 'eq', value: '32' }]); }
    catch (error) { expect((error as SiftbarValidationError).issues[0].path).toBe('filters[0].value'); }
    store.setFilters([{ field: 'ram', operator: 'eq', value: 32 }]);
    expect(store.get().filters[0].id).toBe('filter-2');
  });
  it('rejects malformed and unknown state with structured issues', () => {
    for (const input of [null, [], { version: 2, combinator: 'or', filters: [] }, state('missing'), state('name', 'gt', 2), { version: 1, combinator: 'and', filters: [{ id: '', field: 'name', operator: 'eq' }] }, { version: 1, combinator: 'and', filters: [], labels: {} }]) {
      expect(() => validateState(input, fields)).toThrow(SiftbarValidationError);
    }
    try { validateState(state('missing'), fields); } catch (error) { expect((error as SiftbarValidationError).issues[0].path).toBe('state.filters[0].field'); }
  });
  it('restores atomically, rejects duplicate IDs, and never exposes internal arrays', () => {
    const store = new StateStore(fields);
    const valid = validateState(state('status', 'any_of', ['active']), fields);
    store.set(valid); const before = store.get();
    expect(() => store.set({ ...valid, filters: [valid.filters[0], valid.filters[0]] })).toThrow();
    expect(store.get()).toEqual(before);
    (valid.filters[0].value as string[]).push('off');
    (store.get().filters[0].value as string[]).push('off');
    expect(store.get()).toEqual(before);
  });
  it('appends repeated fields and preserves IDs on edit/restoration without collisions', () => {
    const store = new StateStore(fields); store.set(state());
    const nextId = store.freshId(); expect(nextId).toBe('filter-2');
    store.save({ id: nextId, field: 'name', operator: 'eq', value: 'B' });
    store.save({ id: 'ignored', field: 'name', operator: 'eq', value: 'C' }, 'filter-1');
    expect(store.get().filters.map(filter => filter.id)).toEqual(['filter-1', 'filter-2']);
    const saved = store.get(); store.clear(); store.set(JSON.parse(JSON.stringify(saved)));
    expect(store.get()).toEqual(saved);
    store.remove('filter-1'); expect(store.get().filters).toHaveLength(1);
    expect(store.freshId()).toBe('filter-3');
  });
  it('rejects sparse arrays instead of normalizing them during restoration', () => {
    expect(() => validateState(state('status', 'any_of', new Array(1)), fields)).toThrow();
    expect(() => validateState({ version: 1, combinator: 'and', filters: new Array(1) }, fields)).toThrow();
    expect(() => validateSchema(new Array(1))).toThrow();
  });
  it('does not change frozen supplied state', () => {
    const valid = validateState(state(), fields);
    Object.freeze(valid.filters[0]); Object.freeze(valid.filters); Object.freeze(valid);
    expect(validateState(valid, fields)).toEqual(valid);
  });
  it('imports built ESM without a browser DOM', async () => {
    const built = await import('../../dist/siftbar.js');
    expect(built.Siftbar).toBeTypeOf('function');
    expect(typeof globalThis.document).toBe('undefined');
  });
});
describe('demo-only evaluator semantics', () => {
  const rows = [{ name: 'Andy', ram: 0, online: false, created: '2026-10-01' }, { name: '', ram: 64, online: true, created: '2026-10-31' }];
  const run = (field: string, operator: OperatorId, value: unknown, options = {}) => filterRecords(rows, state(field, operator, value) as FilterState, options);
  it('uses inclusive ranges and exclusive date before/after', () => {
    expect(run('created', 'between', ['2026-10-01', '2026-10-31'])).toHaveLength(2);
    expect(run('created', 'before', '2026-10-01')).toHaveLength(0);
    expect(run('created', 'after', '2026-10-31')).toHaveLength(0);
    expect(run('ram', 'between', [0, 64])).toHaveLength(2);
  });
  it('documents configurable text matching and does not confuse false/zero with empty', () => {
    expect(run('name', 'contains', 'andy')).toHaveLength(1);
    expect(run('name', 'contains', 'andy', { caseSensitive: true })).toHaveLength(0);
    expect(run('ram', 'is_empty', null)).toHaveLength(0);
    expect(run('online', 'is_empty', null)).toHaveLength(0);
    expect(run('name', 'is_empty', null)).toHaveLength(1);
  });
});
