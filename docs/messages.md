# Messages and localization

`SiftbarOptions.messages` accepts optional plain-JSON overrides for built-in display
text. Omitted keys inherit English defaults, including individual keys inside
`operators`, `fieldTypes`, and `validation`. No locale detection, translation files,
framework adapter, runtime dependencies, or callbacks are required.

```js
import { Siftbar, DEFAULT_MESSAGES } from 'siftbar';

const filters = new Siftbar(document.querySelector('#filters'), {
  fields: [{ key: 'name', label: 'Nombre', type: 'text' }],
  messages: {
    label: 'Filtros',
    placeholder: 'Añadir un filtro…',
    addFilterLabel: 'Añadir a {label}',
    clear: 'Limpiar',
    clearLabel: 'Limpiar filtros',
    editFilterLabel: 'Editar {filter}',
    removeFilterLabel: 'Quitar {filter}',
    filterAdded: 'Filtro añadido: {filter}.',
    operators: { eq: 'es', contains: 'contiene' },
    fieldTypes: { text: 'texto' },
    validation: { minimum: 'El mínimo es {min}.' },
  },
});

// Full, deeply frozen English catalog, useful when preparing a complete translation.
console.log(DEFAULT_MESSAGES);
```

This is a **partial** translation example; all omitted controls and announcements
remain English. Provide the entire catalog for a completely translated UI. In a
server-rendered application, serialize the message mapping with the rest of the
configuration and let the adapter parse it. No functions are needed. Use the
framework's normal JSON/HTML escaping; never insert raw JSON into HTML attributes.

## Templates and validation

Templates use literal named parameters such as `{filter}`, not JavaScript, HTML,
ICU MessageFormat, or Rails `%{filter}` interpolation. Parameters can be reordered,
repeated, or omitted. Only the parameters documented for that key are accepted.
Interpolation is a single pass: braces, HTML, and replacement tokens inside field
labels or values remain literal text. Messages always render as text, never HTML.

Each override must be a nonempty string. `messages` and its nested groups must be
plain objects (null-prototype objects are also accepted). Invalid types, empty
strings, unknown keys, and unknown parameters throw `SiftbarValidationError` with a
precise `options.messages.…` issue path **before the host DOM is changed**. Inputs
are defensively copied at mount; changing the original mapping does not change an
existing instance. Different instances can use different languages.

## Controls and accessible names

| Key | English default / purpose | Parameters |
| --- | --- | --- |
| `label` | Filters — default group label | — |
| `placeholder` | Add a filter… — default add-field placeholder | — |
| `addFilterLabel` | {label}: add a filter | `label` |
| `clear` | Clear — visible button text | — |
| `clearLabel` | Clear filters — button's accessible name | — |
| `chooseField` | Choose a field — picker heading | — |
| `fieldsLabel` | Filter fields — field list's accessible name | — |
| `noMatches` | No matches. — field and enum search feedback | — |
| `field`, `operator`, `value` | Field, Operator, Value — editor control labels | — |
| `from`, `to` | From (inclusive), To (inclusive) — range control labels | — |
| `addDialogLabel` | Add {field} filter | `field` |
| `editDialogLabel` | Edit {field} filter | `field` |
| `instructions` | Valid filters are saved when you click or tab away. Press Escape to cancel. | — |
| `searchOptions` | Search options… — enum search placeholder | — |
| `chooseValue`, `chooseValues` | Choose a value, Choose values — enum input names | — |
| `valuesLabel` | {field} values — enum list's accessible name | `field` |
| `selectedValues` | Selected: {values} — selection status | `values` |
| `noValuesSelected` | No values selected. | — |
| `removeSelectedValueLabel` | Remove {value} from selected values | `value` |
| `editFilterLabel` | Edit {filter} — chip's accessible name | `filter` |
| `removeFilterLabel` | Remove {filter} — chip removal's accessible name | `filter` |

## Live announcements

| Key | English default | Parameters |
| --- | --- | --- |
| `selectedValueRemoved` | {value} removed from selected values. | `value` |
| `filtersCleared` | Filters cleared. | — |
| `filterRemoved` | Filter removed. | — |
| `filterAdded` | Filter added: {filter}. | `filter` |
| `filterUpdated` | Filter updated: {filter}. | `filter` |
| `draftDiscarded` | Incomplete or invalid filter discarded; saved filters unchanged. | — |
| `saveError` | Unable to save this filter. — unexpected internal validation failure | — |

## Operators, types, and value display

- `operators` maps the stable [operator IDs](../README.md#operators) to labels.
  Its English defaults are the exported `OPERATOR_LABELS` mapping.
- `fieldTypes` maps `text`, `number`, `date`, `boolean`, and `enum` to the hints in
  the field picker. The default hints are those English type identifiers.
- `true` and `false` default to `"true"` / `"false"`. They change boolean display,
  never the stored JSON boolean. They also change boolean operator-choice labels.

| Key | English default | Parameters |
| --- | --- | --- |
| `booleanOperator` | {operator} {value} — boolean editor choices | `operator`, `value` |
| `rangeValue` | {from} and {to} — number/date range chips | `from`, `to` |
| `valueWithSuffix` | {value} {suffix} — number chips with a suffix | `value`, `suffix` |
| `filterLabel` | {field} {operator} {value} — ordinary chip text | `field`, `operator`, `value` |
| `filterLabelWithoutValue` | {field} {operator} — empty/not-empty chip text | `field`, `operator` |
| `listSeparator` | `, ` — enum chip lists and selection status | — |
| `valuesIn` | Values in {suffix}. — number editor help | `suffix` |

Field labels, enum option labels, groups, aliases, and suffixes are app-supplied;
translate them in the field configuration. `field.formatValue` remains an optional
chip-only formatter. Numbers/dates otherwise retain their existing representation;
native number/date input controls follow the browser's language settings. The host
application owns document `lang` / `dir` and any language-switch/remount behavior.

### Precedence and compatibility

- Existing top-level `label` and `placeholder` options override the corresponding
  message defaults.
- A field's `operatorLabels` overrides `messages.operators` for that field.
- Unspecified messages retain the existing English UI. No built-in language pack
  is selected automatically.
- State, field/operator identifiers, enum identifiers, events and callback payloads
  never contain translated labels. Changing languages does not migrate state.
- Configuration errors and programmatic `validateSchema` / `validateState` /
  `setState` / `setFilters` diagnostics remain developer-facing English. The
  validation messages shown by the editor are configurable as described below.

## Editor validation

`messages.validation` accepts these keys. Numeric constraints use the field's
actual values, without silently rounding or otherwise changing validation.

| Key | English default | Parameters |
| --- | --- | --- |
| `operatorNotAllowed` | Operator is not allowed for this field. | — |
| `nullRequired` | This operator requires null, not a value. | — |
| `text` | Enter a text value. | — |
| `boolean` | Choose true or false. | — |
| `finiteNumber` | Enter a finite number. | — |
| `integer` | Enter a whole number. | — |
| `minimum` | Minimum is {min}. | `min` |
| `maximum` | Maximum is {max}. | `max` |
| `step` | Use steps of {step} from {origin}. | `step`, `origin` |
| `numberRange` | Enter two numbers. | — |
| `rangeOrder` | Range start must not exceed the end. | — |
| `date` | Enter a valid date (YYYY-MM-DD). | — |
| `dateRange` | Enter two valid dates (YYYY-MM-DD). | — |
| `enumMultiple` | Choose at least one option, without duplicates. | — |
| `enumSingle` | Choose an available option. | — |
