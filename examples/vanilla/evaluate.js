// Example-only evaluator. Siftbar itself never evaluates rows or builds queries.
// Text comparisons default to case-insensitive; serialized text is untouched.
// This demo defines empty as null, missing, or an empty string (not 0 or false).
export function filterRecords(records, state, { caseSensitive = false } = {}) {
  const text = value => caseSensitive ? value : value.toLocaleLowerCase();
  return records.filter(row => state.filters.every(({ field, operator, value }) => {
    const current = row[field];
    const empty = current === null || current === undefined || current === '';
    if (operator === 'is_empty') return empty;
    if (operator === 'is_not_empty') return !empty;
    if (['gt', 'gte', 'lt', 'lte', 'before', 'after', 'on', 'between'].includes(operator)) {
      const bound = Array.isArray(value) ? value[0] : value;
      if (typeof current !== typeof bound || (typeof current === 'number' && !Number.isFinite(current)) || empty) return false;
    }
    switch (operator) {
      case 'contains': return typeof current === 'string' && text(current).includes(text(value));
      case 'not_contains': return typeof current === 'string' && !text(current).includes(text(value));
      case 'starts_with': return typeof current === 'string' && text(current).startsWith(text(value));
      case 'ends_with': return typeof current === 'string' && text(current).endsWith(text(value));
      case 'eq': return typeof current === 'string' && typeof value === 'string' && ['name', 'model', 'firstName', 'lastName', 'product', 'manufacturer'].includes(field) ? text(current) === text(value) : current === value;
      case 'neq': return typeof current === 'string' && typeof value === 'string' && ['name', 'model', 'firstName', 'lastName', 'product', 'manufacturer'].includes(field) ? text(current) !== text(value) : current !== value;
      case 'gt': case 'after': return current > value;
      case 'gte': return current >= value;
      case 'lt': case 'before': return current < value;
      case 'lte': return current <= value;
      case 'on': return current === value;
      case 'between': return current >= value[0] && current <= value[1];
      case 'any_of': return value.includes(current);
      case 'none_of': return !value.includes(current);
      default: throw new Error(`Unsupported demo operator: ${operator}`);
    }
  }));
}
