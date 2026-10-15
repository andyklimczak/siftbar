import type { Field, FieldType, OperatorId } from './types.js';

export const OPERATOR_LABELS: Readonly<Record<OperatorId, string>> = Object.freeze({
  eq: 'equals', neq: 'does not equal', contains: 'contains', not_contains: 'does not contain',
  starts_with: 'starts with', ends_with: 'ends with', gt: '>', gte: '≥', lt: '<', lte: '≤',
  between: 'between', on: 'on', before: 'before', after: 'after',
  any_of: 'is any of', none_of: 'is none of', is_empty: 'is empty', is_not_empty: 'is not empty',
});
const BY_TYPE: Record<FieldType, readonly OperatorId[]> = {
  text: ['contains', 'eq', 'neq', 'not_contains', 'starts_with', 'ends_with'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  date: ['on', 'before', 'after', 'between'],
  boolean: ['eq'], enum: ['eq', 'neq', 'any_of', 'none_of'],
};
export function supportedOperators(type: FieldType, nullable = false): OperatorId[] {
  return [...BY_TYPE[type], ...(nullable ? ['is_empty', 'is_not_empty'] as const : [])];
}
export function operatorsFor(field: Field): readonly OperatorId[] {
  return field.operators ?? supportedOperators(field.type, field.nullable);
}
export function operatorLabel(field: Field, operator: OperatorId, labels: Readonly<Record<OperatorId, string>> = OPERATOR_LABELS): string {
  return field.operatorLabels?.[operator] ?? labels[operator];
}
export function noValue(operator: OperatorId): boolean {
  return operator === 'is_empty' || operator === 'is_not_empty';
}
