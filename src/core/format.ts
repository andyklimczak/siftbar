import { noValue, operatorLabel } from './operators.js';
import type { Field, Filter, FilterValue } from './types.js';
export function formatValue(field: Field, value: FilterValue): string {
  if (field.formatValue) return String(field.formatValue(value));
  if (field.type === 'enum') {
    const label = (v: string) => field.options.find(option => option.value === v)?.label ?? v;
    return Array.isArray(value) ? (value as string[]).map(label).join(', ') : label(String(value));
  }
  if (Array.isArray(value)) return `${value.join(' and ')}${field.type === 'number' && field.suffix ? ` ${field.suffix}` : ''}`;
  if (field.type === 'text') return JSON.stringify(value);
  if (field.type === 'number') return `${value}${field.suffix ? ` ${field.suffix}` : ''}`;
  return String(value);
}
export function filterLabel(field: Field, filter: Filter): string {
  if (field.type === 'boolean' && filter.operator === 'eq') return `${field.label} ${operatorLabel(field, 'eq')} ${filter.value ? 'true' : 'false'}`;
  return `${field.label} ${operatorLabel(field, filter.operator)}${noValue(filter.operator) ? '' : ` ${formatValue(field, filter.value)}`}`;
}
