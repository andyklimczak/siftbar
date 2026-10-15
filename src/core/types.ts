export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'enum';
export type OperatorId = 'eq' | 'neq' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'on' | 'before' | 'after'
  | 'any_of' | 'none_of' | 'is_empty' | 'is_not_empty';
export type FilterValue = string | number | boolean | null | string[] | [number, number];
export interface FilterCondition { field: string; operator: OperatorId; value: FilterValue }
export interface Filter extends FilterCondition { id: string }
export interface FilterState { version: 1; combinator: 'and'; filters: Filter[] }
export interface EnumOption { value: string; label: string }
interface BaseField {
  key: string;
  label: string;
  aliases?: readonly string[];
  group?: string;
  nullable?: boolean;
  operators?: readonly OperatorId[];
  defaultOperator?: OperatorId;
  operatorLabels?: Partial<Record<OperatorId, string>>;
  /** Display only; return plain text. Does not change serialized values. */
  formatValue?: (value: FilterValue) => string;
}
export interface TextField extends BaseField { type: 'text' }
export interface NumberField extends BaseField {
  type: 'number'; integer?: boolean; min?: number; max?: number; step?: number; suffix?: string;
}
export interface DateField extends BaseField { type: 'date' }
export interface BooleanField extends BaseField { type: 'boolean' }
export interface EnumField extends BaseField { type: 'enum'; options: readonly EnumOption[] }
export type Field = TextField | NumberField | DateField | BooleanField | EnumField;
export type ChangeReason = 'add' | 'edit' | 'remove' | 'clear' | 'set';
export interface ChangeDetail { reason: ChangeReason; filterId?: string }
export interface ChangeEventDetail extends ChangeDetail { state: FilterState }
export interface SiftbarMessages {
  label: string;
  placeholder: string;
  addFilterLabel: string;
  clear: string;
  clearLabel: string;
  chooseField: string;
  fieldsLabel: string;
  noMatches: string;
  field: string;
  operator: string;
  value: string;
  from: string;
  to: string;
  addDialogLabel: string;
  editDialogLabel: string;
  instructions: string;
  searchOptions: string;
  chooseValue: string;
  chooseValues: string;
  valuesLabel: string;
  selectedValues: string;
  noValuesSelected: string;
  removeSelectedValueLabel: string;
  selectedValueRemoved: string;
  editFilterLabel: string;
  removeFilterLabel: string;
  filtersCleared: string;
  filterRemoved: string;
  filterAdded: string;
  filterUpdated: string;
  draftDiscarded: string;
  saveError: string;
  valuesIn: string;
  true: string;
  false: string;
  booleanOperator: string;
  rangeValue: string;
  valueWithSuffix: string;
  filterLabel: string;
  filterLabelWithoutValue: string;
  listSeparator: string;
  operators: Readonly<Record<OperatorId, string>>;
  fieldTypes: Readonly<Record<FieldType, string>>;
  validation: Readonly<{
    operatorNotAllowed: string;
    nullRequired: string;
    text: string;
    boolean: string;
    finiteNumber: string;
    integer: string;
    minimum: string;
    maximum: string;
    step: string;
    numberRange: string;
    rangeOrder: string;
    date: string;
    dateRange: string;
    enumMultiple: string;
    enumSingle: string;
  }>;
}
/** Partial plain-JSON overrides; nested groups fall back one key at a time. */
export type SiftbarMessageOverrides = Partial<Omit<SiftbarMessages, 'operators' | 'fieldTypes' | 'validation'>> & {
  operators?: Partial<SiftbarMessages['operators']>;
  fieldTypes?: Partial<SiftbarMessages['fieldTypes']>;
  validation?: Partial<SiftbarMessages['validation']>;
};
export interface SiftbarOptions {
  fields: readonly Field[];
  messages?: SiftbarMessageOverrides;
  label?: string;
  placeholder?: string;
  theme?: 'system' | 'light' | 'dark';
  onChange?: (state: FilterState, detail: ChangeDetail) => void;
}
export interface EmitOptions { emit?: boolean }
export interface ValidationIssue { code: string; path: string; message: string }
