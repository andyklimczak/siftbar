import { operatorsFor, supportedOperators, noValue } from './operators.js';
import type { Field, FilterState, FilterValue, NumberField, OperatorId, ValidationIssue } from './types.js';

export class SiftbarValidationError extends Error {
  readonly issues: readonly ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
    this.name = 'SiftbarValidationError';
    this.issues = issues.map(issue => ({ ...issue }));
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function fail(path: string, message: string, code = 'invalid'): never {
  throw new SiftbarValidationError([{ path, message, code }]);
}
export function validateSchema(input: unknown): Field[] {
  if (!Array.isArray(input) || input.length === 0) fail('fields', 'Provide at least one field.');
  const keys = new Set<string>();
  const fields: Field[] = [];
  Array.from(input).forEach((entry: unknown, index: number) => {
    const path = `fields[${index}]`;
    if (!isRecord(entry)) fail(path, 'Expected a field object.');
    if (typeof entry.key !== 'string' || !entry.key.length) fail(`${path}.key`, 'Expected a nonempty key.');
    if (keys.has(entry.key)) fail(`${path}.key`, 'Field keys must be unique.', 'duplicate');
    keys.add(entry.key);
    if (typeof entry.label !== 'string' || !entry.label.length) fail(`${path}.label`, 'Expected a nonempty label.');
    if (typeof entry.type !== 'string' || !['text', 'number', 'date', 'boolean', 'enum'].includes(entry.type)) fail(`${path}.type`, 'Unknown field type.');
    for (const name of ['nullable', 'integer']) {
      if (entry[name] !== undefined && typeof entry[name] !== 'boolean') fail(`${path}.${name}`, 'Expected a boolean.');
    }
    for (const name of ['group', 'suffix']) {
      if (entry[name] !== undefined && typeof entry[name] !== 'string') fail(`${path}.${name}`, 'Expected text.');
    }
    if (entry.aliases !== undefined && (!Array.isArray(entry.aliases) || !Array.from(entry.aliases).every(a => typeof a === 'string'))) fail(`${path}.aliases`, 'Expected a string array.');
    if (entry.formatValue !== undefined && typeof entry.formatValue !== 'function') fail(`${path}.formatValue`, 'Expected a function.');
    const field = entry as unknown as Field;
    const supported = supportedOperators(field.type, field.nullable);
    if (field.operators !== undefined && (!Array.isArray(field.operators) || !field.operators.length
      || new Set(field.operators).size !== field.operators.length
      || !Array.from(field.operators).every(op => supported.includes(op)))) fail(`${path}.operators`, 'Expected unique operators supported by this field.');
    if (field.defaultOperator !== undefined && !operatorsFor(field).includes(field.defaultOperator)) fail(`${path}.defaultOperator`, 'Default operator must be allowed.');
    if (entry.operatorLabels !== undefined) {
      if (!isRecord(entry.operatorLabels)) fail(`${path}.operatorLabels`, 'Expected operator label mapping.');
      for (const [key, label] of Object.entries(entry.operatorLabels)) {
        if (!supported.includes(key as OperatorId) || typeof label !== 'string' || !label.length) fail(`${path}.operatorLabels.${key}`, 'Expected a supported operator and nonempty label.');
      }
    }
    if (field.type === 'number') {
      for (const name of ['min', 'max', 'step'] as const) {
        if (field[name] !== undefined && (typeof field[name] !== 'number' || !Number.isFinite(field[name]))) fail(`${path}.${name}`, 'Expected a finite number.');
      }
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) fail(path, 'Minimum must not exceed maximum.');
      if (field.step !== undefined && field.step <= 0) fail(`${path}.step`, 'Step must be positive.');
    }
    if (field.type === 'enum') {
      if (!Array.isArray(field.options) || !field.options.length) fail(`${path}.options`, 'Provide at least one option.');
      const values = new Set<string>();
      Array.from(field.options).forEach((option: unknown, i: number) => {
        if (!isRecord(option) || typeof option.value !== 'string' || typeof option.label !== 'string') fail(`${path}.options[${i}]`, 'Expected a string value and label.');
        if (values.has(option.value)) fail(`${path}.options[${i}].value`, 'Option values must be unique.', 'duplicate');
        values.add(option.value);
      });
    }
    fields.push({ ...field,
      ...(field.aliases ? { aliases: [...field.aliases] } : {}),
      ...(field.operators ? { operators: [...field.operators] } : {}),
      ...(field.operatorLabels ? { operatorLabels: { ...field.operatorLabels } } : {}),
      ...(field.type === 'enum' ? { options: field.options.map(option => ({ ...option })) } : {}),
    } as Field);
  });
  return fields;
}
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function numberError(value: unknown, field: NumberField): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Enter a finite number.';
  if (field.integer && !Number.isInteger(value)) return 'Enter a whole number.';
  if (field.min !== undefined && value < field.min) return `Minimum is ${field.min}.`;
  if (field.max !== undefined && value > field.max) return `Maximum is ${field.max}.`;
  if (field.step !== undefined) {
    const steps = (value - (field.min ?? 0)) / field.step;
    // Tolerate only floating-point representation error, never round stored values.
    if (!Number.isFinite(steps) || Math.abs(steps - Math.round(steps)) > 8 * Number.EPSILON * Math.max(1, Math.abs(steps))) return `Use steps of ${field.step} from ${field.min ?? 0}.`;
  }
  return null;
}
export function valueError(field: Field, operator: OperatorId, value: unknown): string | null {
  if (!operatorsFor(field).includes(operator)) return 'Operator is not allowed for this field.';
  if (noValue(operator)) return value === null ? null : 'This operator requires null, not a value.';
  switch (field.type) {
    case 'text': return typeof value === 'string' ? null : 'Enter a text value.';
    case 'boolean': return typeof value === 'boolean' ? null : 'Choose true or false.';
    case 'number':
      if (operator !== 'between') return numberError(value, field);
      if (!Array.isArray(value) || value.length !== 2) return 'Enter two numbers.';
      return numberError(value[0], field) ?? numberError(value[1], field)
        ?? (value[0] > value[1] ? 'Range start must not exceed the end.' : null);
    case 'date':
      if (operator !== 'between') return isCalendarDate(value) ? null : 'Enter a valid date (YYYY-MM-DD).';
      if (!Array.isArray(value) || value.length !== 2 || !Array.from(value).every(isCalendarDate)) return 'Enter two valid dates (YYYY-MM-DD).';
      return value[0] <= value[1] ? null : 'Range start must not exceed the end.';
    case 'enum': {
      const allowed = new Set(field.options.map(option => option.value));
      if (operator === 'any_of' || operator === 'none_of') {
        return Array.isArray(value) && value.length > 0 && Array.from(value).every(v => typeof v === 'string' && allowed.has(v)) && new Set(value).size === value.length
          ? null : 'Choose at least one option, without duplicates.';
      }
      return typeof value === 'string' && allowed.has(value) ? null : 'Choose an available option.';
    }
  }
}
export function validateState(input: unknown, fields: readonly Field[]): FilterState {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string, code = 'invalid') => issues.push({ path, message, code });
  if (!isRecord(input)) fail('state', 'Expected a state object.');
  for (const key of Object.keys(input)) if (!['version', 'combinator', 'filters'].includes(key)) add(`state.${key}`, 'Unexpected property.', 'unknown');
  if (input.version !== 1) add('state.version', 'Only version 1 is supported.');
  if (input.combinator !== 'and') add('state.combinator', 'Only AND is supported.');
  if (!Array.isArray(input.filters)) add('state.filters', 'Expected an array.');
  else {
    const ids = new Set<string>();
    const byKey = new Map(fields.map(field => [field.key, field]));
    Array.from(input.filters).forEach((filter: unknown, i: number) => {
      const path = `state.filters[${i}]`;
      if (!isRecord(filter)) { add(path, 'Expected a filter object.'); return; }
      for (const key of Object.keys(filter)) if (!['id', 'field', 'operator', 'value'].includes(key)) add(`${path}.${key}`, 'Unexpected property.', 'unknown');
      if (typeof filter.id !== 'string' || !filter.id.length) add(`${path}.id`, 'Expected a nonempty string ID.');
      else if (ids.has(filter.id)) add(`${path}.id`, 'Duplicate filter ID.', 'duplicate');
      else ids.add(filter.id);
      const field = typeof filter.field === 'string' ? byKey.get(filter.field) : undefined;
      if (!field) add(`${path}.field`, 'Unknown field.', 'unknown');
      else if (typeof filter.operator !== 'string' || !operatorsFor(field).includes(filter.operator as OperatorId)) add(`${path}.operator`, 'Unsupported operator.', 'unknown');
      else {
        const error = valueError(field, filter.operator as OperatorId, filter.value);
        if (error) add(`${path}.value`, error);
      }
    });
  }
  if (issues.length) throw new SiftbarValidationError(issues);
  const state = input as unknown as FilterState;
  return { version: 1, combinator: 'and', filters: state.filters.map(filter => ({
    id: filter.id, field: filter.field, operator: filter.operator,
    value: copyValue(filter.value),
  })) };
}
export function copyValue(value: FilterValue): FilterValue {
  return Array.isArray(value) ? [...value] as FilterValue : value;
}
export function copyState(state: FilterState): FilterState {
  return { version: 1, combinator: 'and', filters: state.filters.map(filter => ({ ...filter, value: copyValue(filter.value) })) };
}
