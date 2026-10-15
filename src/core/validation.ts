import { operatorsFor, supportedOperators, noValue } from './operators.js';
import { DEFAULT_MESSAGES, formatMessage, MESSAGE_PARAMETERS } from './messages.js';
import type { Field, FilterState, FilterValue, NumberField, OperatorId, SiftbarMessages, ValidationIssue } from './types.js';

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
/** Validate/copy overrides before mounting; programmer-facing diagnostics stay English. */
export function validateMessages(input: unknown): SiftbarMessages {
  function group(defaults: object, overrides: unknown, prefix = ''): Record<string, unknown> {
    if (overrides !== undefined && !isRecord(overrides)) fail(`options.messages${prefix ? `.${prefix}` : ''}`, 'Expected a message mapping.');
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(overrides ?? {})) {
      if (!Object.hasOwn(defaults, key)) fail(`options.messages.${prefix ? `${prefix}.` : ''}${key}`, 'Unknown message.', 'unknown');
    }
    for (const [key, fallback] of Object.entries(defaults)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const supplied = overrides !== undefined && Object.hasOwn(overrides, key);
      const value = supplied ? (overrides as Record<string, unknown>)[key] : fallback;
      if (typeof fallback !== 'string') {
        if (supplied && !isRecord(value)) fail(`options.messages.${path}`, 'Expected a message mapping.');
        result[key] = group(fallback, value, path);
      } else {
        if (typeof value !== 'string' || !value.length) fail(`options.messages.${path}`, 'Expected nonempty text.');
        for (const match of value.matchAll(/\{([^{}]+)\}/g)) {
          if (!(MESSAGE_PARAMETERS[path] ?? []).includes(match[1])) fail(`options.messages.${path}`, `Unknown message parameter: ${match[1]}.`);
        }
        result[key] = value;
      }
    }
    return result;
  }
  return group(DEFAULT_MESSAGES, input) as unknown as SiftbarMessages;
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
export function validateQuickSearchFields(input: unknown, fields: readonly Field[]): string[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) fail('options.quickSearchFields', 'Expected a field key array.');
  const seen = new Set<string>();
  return Array.from(input, (key: unknown, index) => {
    const path = `options.quickSearchFields[${index}]`;
    const field = fields.find(field => field.key === key);
    if (!field || field.type !== 'text' || !operatorsFor(field).includes('contains')) fail(path, 'Expected a text field supporting contains.');
    if (seen.has(field.key)) fail(path, 'Field keys must be unique.', 'duplicate');
    seen.add(field.key);
    return field.key;
  });
}
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function numberError(value: unknown, field: NumberField, messages: SiftbarMessages): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return messages.validation.finiteNumber;
  if (field.integer && !Number.isInteger(value)) return messages.validation.integer;
  if (field.min !== undefined && value < field.min) return formatMessage(messages.validation.minimum, { min: field.min });
  if (field.max !== undefined && value > field.max) return formatMessage(messages.validation.maximum, { max: field.max });
  if (field.step !== undefined) {
    const steps = (value - (field.min ?? 0)) / field.step;
    // Tolerate only floating-point representation error, never round stored values.
    if (!Number.isFinite(steps) || Math.abs(steps - Math.round(steps)) > 8 * Number.EPSILON * Math.max(1, Math.abs(steps))) return formatMessage(messages.validation.step, { step: field.step, origin: field.min ?? 0 });
  }
  return null;
}
export function valueError(field: Field, operator: OperatorId, value: unknown, messages: SiftbarMessages = DEFAULT_MESSAGES): string | null {
  if (!operatorsFor(field).includes(operator)) return messages.validation.operatorNotAllowed;
  if (noValue(operator)) return value === null ? null : messages.validation.nullRequired;
  switch (field.type) {
    case 'text': return typeof value === 'string' ? null : messages.validation.text;
    case 'boolean': return typeof value === 'boolean' ? null : messages.validation.boolean;
    case 'number':
      if (operator !== 'between') return numberError(value, field, messages);
      if (!Array.isArray(value) || value.length !== 2) return messages.validation.numberRange;
      return numberError(value[0], field, messages) ?? numberError(value[1], field, messages)
        ?? (value[0] > value[1] ? messages.validation.rangeOrder : null);
    case 'date':
      if (operator !== 'between') return isCalendarDate(value) ? null : messages.validation.date;
      if (!Array.isArray(value) || value.length !== 2 || !Array.from(value).every(isCalendarDate)) return messages.validation.dateRange;
      return value[0] <= value[1] ? null : messages.validation.rangeOrder;
    case 'enum': {
      const allowed = new Set(field.options.map(option => option.value));
      if (operator === 'any_of' || operator === 'none_of') {
        return Array.isArray(value) && value.length > 0 && Array.from(value).every(v => typeof v === 'string' && allowed.has(v)) && new Set(value).size === value.length
          ? null : messages.validation.enumMultiple;
      }
      return typeof value === 'string' && allowed.has(value) ? null : messages.validation.enumSingle;
    }
  }
}
export function validateState(input: unknown, fields: readonly Field[], quickSearchFields: readonly string[] = []): FilterState {
  quickSearchFields = validateQuickSearchFields(quickSearchFields, fields);
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string, code = 'invalid') => issues.push({ path, message, code });
  if (!isRecord(input)) fail('state', 'Expected a state object.');
  for (const key of Object.keys(input)) if (!['version', 'combinator', 'filters', 'search'].includes(key)) add(`state.${key}`, 'Unexpected property.', 'unknown');
  if (Object.hasOwn(input, 'search')) {
    if (!quickSearchFields.length) add('state.search', 'Quick search is not enabled.');
    else if (typeof input.search !== 'string' || !input.search.trim().length) add('state.search', 'Expected nonempty search text; omit search to clear it.');
  }
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
  return { version: 1, combinator: 'and', ...(state.search !== undefined ? { search: state.search } : {}), filters: state.filters.map(filter => ({
    id: filter.id, field: filter.field, operator: filter.operator,
    value: copyValue(filter.value),
  })) };
}
export function copyValue(value: FilterValue): FilterValue {
  return Array.isArray(value) ? [...value] as FilterValue : value;
}
export function copyState(state: FilterState): FilterState {
  return { version: 1, combinator: 'and', ...(state.search !== undefined ? { search: state.search } : {}), filters: state.filters.map(filter => ({ ...filter, value: copyValue(filter.value) })) };
}
