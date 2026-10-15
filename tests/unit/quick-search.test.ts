import { describe, expect, it } from 'vitest';
import { StateStore } from '../../src/core/state.js';
import { copyState, SiftbarValidationError, validateQuickSearchFields, validateSchema, validateState } from '../../src/core/validation.js';

const fields = validateSchema([
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'id', label: 'ID', type: 'text' },
  { key: 'exact', label: 'Exact', type: 'text', operators: ['eq'] },
  { key: 'age', label: 'Age', type: 'number' },
]);
const empty = { version: 1, combinator: 'and', filters: [] };

describe('opt-in quick search', () => {
  it('validates and copies configured field keys', () => {
    expect(validateQuickSearchFields(undefined, fields)).toEqual([]);
    expect(validateQuickSearchFields([], fields)).toEqual([]);
    const input = ['email', 'id'];
    const copy = validateQuickSearchFields(input, fields);
    input.push('age');
    expect(copy).toEqual(['email', 'id']);
  });
  it.each([null, 'email', ['missing'], ['age'], ['exact'], ['email', 'email'], [null], new Array(1)])('rejects invalid quick-search configuration %#', input => {
    expect(() => validateQuickSearchFields(input, fields)).toThrow(SiftbarValidationError);
  });
  it('keeps the original state shape for filter-only instances', () => {
    expect(new StateStore(fields).get()).toEqual(empty);
    expect(() => validateState({ ...empty, search: 'text' }, fields)).toThrow('state.search');
  });
  it.each([null, '', '   ', false, 123, ['text'], { fields: ['email'], value: 'text' }, undefined])('rejects invalid search text %# atomically', search => {
    const store = new StateStore(fields, ['email', 'id']);
    store.setSearch('saved');
    expect(() => store.set({ ...empty, search })).toThrow('state.search');
    expect(store.get().search).toBe('saved');
  });
  it('round trips search and filters and preserves search across chip/preset operations', () => {
    const store = new StateStore(fields, ['email', 'id']);
    const value = '  <b>{value}</b>  ';
    store.setSearch(value);
    store.setFilters([{ field: 'email', operator: 'contains', value: 'test' }]);
    const first = store.get().filters[0];
    store.save({ ...first, value: 'edited' }, first.id);
    expect(store.get().search).toBe(value);
    store.remove(first.id);
    expect(store.get().search).toBe(value);
    const copy = copyState(store.get());
    copy.search = 'mutated';
    expect(store.get().search).toBe(value);
    expect(validateState(JSON.parse(JSON.stringify(store.get())), fields, ['email', 'id'])).toEqual(store.get());
    store.setSearch('');
    expect(store.get()).toEqual(empty);
    store.setSearch('again');
    store.clear();
    expect(store.get()).toEqual(empty);
  });
});
