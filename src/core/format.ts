import { noValue, operatorLabel } from './operators.js';
import { DEFAULT_MESSAGES, formatMessage } from './messages.js';
import type { Field, Filter, FilterValue, SiftbarMessages } from './types.js';
export function formatValue(field: Field, value: FilterValue, messages: SiftbarMessages = DEFAULT_MESSAGES): string {
  if (field.formatValue) return String(field.formatValue(value));
  if (field.type === 'enum') {
    const label = (v: string) => field.options.find(option => option.value === v)?.label ?? v;
    return Array.isArray(value) ? (value as string[]).map(label).join(messages.listSeparator) : label(String(value));
  }
  if (Array.isArray(value)) {
    const range = formatMessage(messages.rangeValue, { from: value[0], to: value[1] });
    return field.type === 'number' && field.suffix ? formatMessage(messages.valueWithSuffix, { value: range, suffix: field.suffix }) : range;
  }
  if (field.type === 'text') return JSON.stringify(value);
  if (field.type === 'number' && field.suffix) return formatMessage(messages.valueWithSuffix, { value: String(value), suffix: field.suffix });
  if (field.type === 'boolean') return value ? messages.true : messages.false;
  return String(value);
}
export function filterLabel(field: Field, filter: Filter, messages: SiftbarMessages = DEFAULT_MESSAGES): string {
  const operator = operatorLabel(field, filter.operator, messages.operators);
  if (noValue(filter.operator)) return formatMessage(messages.filterLabelWithoutValue, { field: field.label, operator });
  const value = field.type === 'boolean' && filter.operator === 'eq' ? (filter.value ? messages.true : messages.false)
    : formatValue(field, filter.value, messages);
  return formatMessage(messages.filterLabel, { field: field.label, operator, value });
}
