import { OPERATOR_LABELS } from './operators.js';
import type { SiftbarMessages } from './types.js';

/** English defaults. Display copy only: none of these strings enter saved state. */
export const DEFAULT_MESSAGES: Readonly<SiftbarMessages> = Object.freeze({
  label: 'Filters',
  placeholder: 'Add a filter…',
  addFilterLabel: '{label}: add a filter',
  clear: 'Clear',
  clearLabel: 'Clear filters',
  chooseField: 'Choose a field',
  fieldsLabel: 'Filter fields',
  noMatches: 'No matches.',
  field: 'Field',
  operator: 'Operator',
  value: 'Value',
  from: 'From (inclusive)',
  to: 'To (inclusive)',
  addDialogLabel: 'Add {field} filter',
  editDialogLabel: 'Edit {field} filter',
  instructions: 'Valid filters are saved when you click or tab away. Press Escape to cancel.',
  searchOptions: 'Search options…',
  chooseValue: 'Choose a value',
  chooseValues: 'Choose values',
  valuesLabel: '{field} values',
  selectedValues: 'Selected: {values}',
  noValuesSelected: 'No values selected.',
  removeSelectedValueLabel: 'Remove {value} from selected values',
  selectedValueRemoved: '{value} removed from selected values.',
  editFilterLabel: 'Edit {filter}',
  removeFilterLabel: 'Remove {filter}',
  filtersCleared: 'Filters cleared.',
  filterRemoved: 'Filter removed.',
  filterAdded: 'Filter added: {filter}.',
  filterUpdated: 'Filter updated: {filter}.',
  draftDiscarded: 'Incomplete or invalid filter discarded; saved filters unchanged.',
  saveError: 'Unable to save this filter.',
  valuesIn: 'Values in {suffix}.',
  true: 'true',
  false: 'false',
  booleanOperator: '{operator} {value}',
  rangeValue: '{from} and {to}',
  valueWithSuffix: '{value} {suffix}',
  filterLabel: '{field} {operator} {value}',
  filterLabelWithoutValue: '{field} {operator}',
  listSeparator: ', ',
  operators: OPERATOR_LABELS,
  fieldTypes: Object.freeze({ text: 'text', number: 'number', date: 'date', boolean: 'boolean', enum: 'enum' }),
  validation: Object.freeze({
    operatorNotAllowed: 'Operator is not allowed for this field.',
    nullRequired: 'This operator requires null, not a value.',
    text: 'Enter a text value.',
    boolean: 'Choose true or false.',
    finiteNumber: 'Enter a finite number.',
    integer: 'Enter a whole number.',
    minimum: 'Minimum is {min}.',
    maximum: 'Maximum is {max}.',
    step: 'Use steps of {step} from {origin}.',
    numberRange: 'Enter two numbers.',
    rangeOrder: 'Range start must not exceed the end.',
    date: 'Enter a valid date (YYYY-MM-DD).',
    dateRange: 'Enter two valid dates (YYYY-MM-DD).',
    enumMultiple: 'Choose at least one option, without duplicates.',
    enumSingle: 'Choose an available option.',
  }),
});

// Only named parameters documented for a message are accepted in overrides.
export const MESSAGE_PARAMETERS: Readonly<Record<string, readonly string[]>> = {
  addFilterLabel: ['label'], addDialogLabel: ['field'], editDialogLabel: ['field'],
  valuesLabel: ['field'], selectedValues: ['values'], removeSelectedValueLabel: ['value'],
  selectedValueRemoved: ['value'], editFilterLabel: ['filter'], removeFilterLabel: ['filter'],
  filterAdded: ['filter'], filterUpdated: ['filter'], valuesIn: ['suffix'],
  booleanOperator: ['operator', 'value'], rangeValue: ['from', 'to'], valueWithSuffix: ['value', 'suffix'],
  filterLabel: ['field', 'operator', 'value'], filterLabelWithoutValue: ['field', 'operator'],
  'validation.minimum': ['min'], 'validation.maximum': ['max'], 'validation.step': ['step', 'origin'],
};

/** Single-pass interpolation: values (including braces and HTML) stay literal text. */
export function formatMessage(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => Object.hasOwn(values, key) ? String(values[key]) : placeholder);
}
