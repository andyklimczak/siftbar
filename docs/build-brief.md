# Siftbar: detailed implementation prompt

Build **Siftbar**, a small, framework-independent JavaScript library for constructing structured filters in a compact, tokenized search bar.

The proposed description is: **A framework-free, typed filter bar for the web.**

This is not an ordinary free-text search box, a command palette, an AI search tool, or a large SQL query-builder form. It should feel like one polished search control: select a field, select an operator appropriate to that field, enter/select a value, then see an editable filter chip in the bar.

## 1. Inspiration: Meta PowerSearch

I used a component at Meta that I remember as PowerSearch. Clicking its search bar opened a list of available fields. Selecting a field exposed suitable operations and a corresponding value editor:

- Text: contains, starts with, exact match, and related operations.
- Numbers: greater than, less than, greater/less than or equal, equals.
- Dates: before, after, between.
- Other types: choices, booleans, and potentially searchable entities.

Each completed condition became a token in the same bar. Multiple conditions narrowed a table or another data view. Users did not have to learn a query language or write an expression correctly by hand.

Meta now publishes a closely matching component called **PowerSearch** in its **Astryx** design system. Its public implementation defines fields, operators, and typed values; supports editable/removable filter tokens; and provides string, numeric, date, boolean, enum, list, and entity value editors. Its `usePowerSearchConfig` helper supplies type-specific operators. There is also a public example connecting it to a table.

References to inspect for behavior and API ideas:

- Repository: https://github.com/facebook/astryx
- Component: https://github.com/facebook/astryx/tree/main/packages/core/src/PowerSearch
- Default operators: https://github.com/facebook/astryx/blob/main/packages/core/src/PowerSearch/usePowerSearchConfig.ts
- Table example: https://github.com/facebook/astryx/blob/main/apps/storybook/stories/PowerSearchWithTable.stories.tsx
- Storybook: https://astryx.atmeta.com/storybook/?path=/story/core-powersearch--full-featured

Do not claim the public component is necessarily the exact historical internal version I used. Reproduce the interaction concept, not Meta branding. Astryx is React-based; Siftbar must not depend on React, Astryx, or StyleX. If reusing any licensed source rather than independently implementing behavior, comply with its license and retain required notices.

## 2. Product goals and technical constraints

- Work on a plain HTML page through JavaScript and CSS.
- No required React, Vue, Svelte, Angular, jQuery, or design-system runtime.
- No required build step for a consuming page. Supply a browser-ready distribution as well as an ESM package.
- TypeScript is fine for authoring, provided the shipped library is JavaScript with declaration files.
- Aim for zero runtime dependencies. Development/test/build dependencies are fine.
- Keep UI construction separate from applying filters to data or querying a backend.
- Work with server-rendered applications, including Rails/Hotwire, without requiring a rewrite into an SPA.
- Require an explicit field schema; do not require loading all table rows into the browser.
- Build a complete usable vertical slice, not a stub or attractive screenshot with broken interaction.

## 3. Interaction flow

### Empty bar

Render a conventional search-bar-shaped control with an accessible label and customizable placeholder. Clicking/focusing it opens the field picker. Permit typing to narrow field names and aliases; this text is navigation input, not an automatically committed free-text filter.

Each field has a human label and stable machine key. Show useful type cues and optionally group fields by category.

### Selecting a field

Move into an operator-selection step. Only display operators supported by that field's type and allowed by its configuration. Do not show numeric operations for text, or date operations for a boolean.

### Selecting an operator

Show the appropriate value editor. A contains filter needs one text input; a numeric between filter needs two numeric inputs; a date between filter needs two date inputs; an enum needs a choice picker. A no-value operator such as is empty must not require an irrelevant value.

Show the current field/operator context and provide a way to go backward without clearing the whole bar.

### Committing a filter

Validate before committing. A valid condition becomes a chip such as:

- Name contains "Andy"
- RAM >= 32
- Created between 2026-10-01 and 2026-10-31
- Status is Active

Keep room in the bar to add another condition. Long labels should truncate visually without losing accessible full text. Chips should wrap cleanly on smaller screens.

### Editing and removal

Clicking a chip opens its existing condition for editing. Cancel preserves the original condition. Apply changes only after validation; never destroy the original filter when an edit is invalid. Each chip has an accessible remove button. Provide clear-all and predictable focus restoration after editing/removal.

Changing the field or operator must discard incompatible draft values rather than reinterpret them silently. Permit multiple filters for the same field. In v1, completed filters are combined with AND.

## 4. Field types and operators

Support these core types:

### Text

Equals, not equals, contains, does not contain, starts with, ends with. Case sensitivity should be documented and configurable if an optional local evaluator is supplied. Preserve value text: do not silently trim meaningful spaces or normalize case in serialized output.

### Number

Equals, not equals, greater than, greater than or equal, less than, less than or equal, between. Store JSON numbers, not numeric strings. Reject invalid or non-finite numbers. Respect optional integer-only, min/max, and step constraints; do not silently round. Between uses an ordered two-number array and is inclusive by default.

### Date

On, before, after, between. Date-only values serialize as `YYYY-MM-DD`, not timezone-shifted JavaScript timestamps. Between uses two ordered dates, with inclusive endpoints. Before/after are exclusive. Validate actual calendar dates. Clearly distinguish date-only values from date-time values; date-time/timezone features can be a later extension rather than an underspecified v1 feature.

### Boolean

Is true and is false. Store booleans, not the strings "true" and "false". Make selection understandable to nontechnical users.

### Enum

Is, is not, is any of, is none of. Separate stable option values from display labels. Single-select values are scalars; multi-select values are arrays. Support a configured static option list and searchable options.

### Nullable fields

Where explicitly enabled, support is empty/is not empty. These use `value: null` as a no-value condition. Do not conflate numeric zero or boolean false with emptiness. Let backend consumers define whether "empty" means null, missing, empty string, or another domain rule.

Use stable, documented operator IDs, such as `eq`, `neq`, `contains`, `not_contains`, `starts_with`, `ends_with`, `gt`, `gte`, `lt`, `lte`, `between`, `before`, `after`, `on`, `any_of`, `none_of`, `is_empty`, and `is_not_empty`. Labels are independently configurable.

## 5. Proposed public API

Treat this as a proposed API to refine, not an assertion that an existing package already implements it:

```js
import { Siftbar } from 'siftbar';
import 'siftbar/styles.css';

const siftbar = new Siftbar(document.querySelector('#filters'), {
  label: 'Filter computers',
  placeholder: 'Add a filter…',
  fields: [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      operators: ['contains', 'starts_with', 'eq'],
    },
    {
      key: 'ram_gb',
      label: 'RAM',
      type: 'number',
      integer: true,
      min: 0,
      suffix: 'GB',
      operators: ['eq', 'gte', 'lte', 'between'],
    },
    {
      key: 'created_at',
      label: 'Created',
      type: 'date',
      operators: ['before', 'after', 'between'],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'archived', label: 'Archived' },
      ],
    },
    { key: 'online', label: 'Online', type: 'boolean' },
  ],
  onChange(state, detail) {
    // detail.reason: add, edit, remove, clear, or set
    console.log(state);
  },
});
```

Useful instance methods:

- `getState()` returns a detached serializable snapshot.
- `setState(state, { emit: false })` restores valid state without triggering change callbacks by default.
- `clear({ emit: true })` removes all conditions.
- `focus()` focuses the add-filter control.
- `destroy()` cleans up DOM, listeners, observers, pending requests, and timers.

Use one constructor mounting convention rather than introducing redundant mount APIs. If you prefer another convention, document it consistently. Also emit a `siftbar:change` DOM CustomEvent with the same state and reason to support plain-JS and Stimulus integrations. Initialization should not emit an unexplained change event. Never mutate supplied configuration, state, or option arrays.

Importing the package must be safe without a browser DOM; access document/window when mounting, not at module evaluation.

## 6. Output contract

Use a versioned plain JSON structure:

```json
{
  "version": 1,
  "combinator": "and",
  "filters": [
    {
      "id": "filter-1",
      "field": "name",
      "operator": "contains",
      "value": "Andy"
    },
    {
      "id": "filter-2",
      "field": "ram_gb",
      "operator": "gte",
      "value": 32
    },
    {
      "id": "filter-3",
      "field": "created_at",
      "operator": "between",
      "value": ["2026-10-01", "2026-10-31"]
    }
  ]
}
```

IDs identify editable UI conditions and must survive edits/restoration. Define how fresh IDs are generated without collisions. Labels, DOM elements, functions, Date objects, and backend-specific expressions do not belong in the saved filter state.

Restoring invalid state must produce an explicit validation error, leave existing state intact, and never partially apply it. Reject unknown field keys, unsupported operators, incompatible value types, invalid ranges, and duplicate filter IDs. Support exact round-trip serialization of valid state.

## 7. Accessibility and keyboard behavior

Treat this as core functionality, not a final polish task:

- Use appropriate combobox/listbox semantics for pickers, including expanded state, controls, and active option announcements.
- Arrow keys navigate options; Enter selects or commits a valid draft; Escape cancels/closes the current draft or edit without clearing saved filters.
- Tab/Shift+Tab follow a predictable focus order and never trap the user.
- With an empty add-filter input, Backspace may select the last chip first; only a subsequent intentional action removes it.
- Expose chip removal through keyboard-accessible labeled buttons.
- Preserve native editing keys within text and number inputs.
- Do not intercept Enter while IME composition is active.
- Announce meaningful validation errors and filter changes without excessive screen-reader chatter.
- Support mouse, touch, keyboard, zoom, reduced motion, and visible focus indicators.
- Ensure popovers are usable near viewport edges and in scrollable/modal containers.

Use automated accessibility checks plus documented manual keyboard checks; do not claim full accessibility from an automated scan alone.

## 8. Styling and extensibility

Ship a small neutral default stylesheet with namespaced classes and CSS custom properties for colors, borders, spacing, radius, focus ring, chips, dropdowns, and typography. Avoid global CSS resets or host-page styles. Handle light/dark themes, wrapping, readable errors, and long field/value labels.

Leave clear extension points for custom field labels, allowed/default operators, placeholder text, formatting, and future custom value editors. Async enum/entity suggestions are a subsequent feature unless trivial to include safely: define loading/empty/error states, cancellation, and protection from out-of-order responses. Never embed service credentials in the component.

Do not make consuming applications adopt a CSS framework or component library.

## 9. Scope and non-goals

The first release should complete the compact field/operator/value/chip interaction with the five core field types and flat AND logic.

Do not build these into v1:

- React/Vue wrappers or a required web-component wrapper.
- AI/natural-language query interpretation.
- A full free-text query-language parser.
- SQL generation or direct database execution.
- A table/grid framework.
- Mandatory backend integration or automatic network calls.
- Mandatory data loading or automatic field inference.
- Nested boolean query trees, saved-filter accounts, drag-reordering, or an elaborate custom date picker.

Plain JavaScript is the product, not a secondary wrapper around a framework implementation. A later optional Stimulus adapter should remain thin.

## 10. Security and backend boundary

Render untrusted labels and values as text, not raw HTML. Test malicious-looking strings. The library does not grant permissions or validate server authorization. Document that backend applications must independently validate/allowlist fields and operators and parameterize queries; accepting Siftbar JSON does not make database filtering safe automatically.

Do not evaluate strings as code or translate user field names directly into SQL identifiers.

## 11. Demo, packaging, and documentation

Include a runnable demo filtering a table of computers with name, CPU/model, RAM, date, status, and online fields. Demonstrate all field types, range editors, multiple chips, editing, clear-all, preloaded filters, and a live JSON panel. The demo may use a small explicitly local evaluator; core Siftbar must work without data rows.

Also include a plain HTML/JavaScript usage example without an application framework, and a server-filtering integration example that passes JSON to consumer-owned code without including a real backend dependency.

Proposed source organization:

- `src/core/` — schema, operators, state, validation, serialization.
- `src/ui/` — DOM rendering, pickers, chips, focus, interaction state machine.
- `src/styles/` — default styling and theme variables.
- `tests/unit/` — non-DOM behavior.
- `tests/browser/` — complete interaction flows.
- `examples/vanilla/` — runnable browser demo.

Document installation/imports, field schemas, operators and semantics, JSON state, lifecycle/events, CSS customization, server integration, limitations, browser support, and licenses. Include usable package exports, types, browser distribution, an explicit open-source license, and the CSS import path. Do not publish to npm or create remote repositories without approval; `siftbar` was unregistered when checked but is not reserved.

## 12. Testing and definition of done

Use suitable development tools such as Vitest and Playwright, without adding runtime dependencies just for convenience.

Test:

- Correct operators/editors for every field type.
- Invalid numbers, non-finite values, zero, false, missing values, and empty operators.
- Date-only round trips, invalid calendar dates, reversed ranges, and boundary semantics.
- Exact text preservation, stable enum values, and safe display of HTML-looking strings.
- Add/edit/cancel/remove/clear/set flows and multiple conditions for the same field.
- State round-trip, duplicate IDs, unknown fields/operators, defensive copying, and atomic invalid-state rejection.
- Callback and CustomEvent behavior, including silent programmatic restoration.
- Full keyboard-only filter creation and editing, chip removal, Escape, Tab, and IME behavior.
- More than one Siftbar instance on a page, repeated mounting/destruction, cleanup, and no cross-instance interference.
- Narrow layouts, long chips, scrolling, and visible focus.
- Framework-free browser usage in Chromium, Firefox, and WebKit where available.

Implement in this order: define schema/operator/state contracts; build one complete text-filter flow; add remaining types; finish editing/removal and keyboard/accessibility behavior; add theming, demo, packaging, and documentation; run tests against actual built artifacts.

Done means a user can open the plain-JS demo, build and edit text/number/date/boolean/enum filters entirely with mouse or keyboard, receive valid JSON, clear/restore it, and destroy the component without leaks. The published build must not import a UI framework. Report actual commands/results and any untested limitations, not invented passing tests.

Prioritize a small, polished, framework-free PowerSearch-style interaction over a broad but unfinished query-building platform.
