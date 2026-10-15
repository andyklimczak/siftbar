# Public PowerSearch reference notes

These notes describe source inspected on GitHub's `main` branch during planning.
They are not a claim about the historical internal Meta component and not a report
of hands-on Storybook testing. Main-branch behavior can change.

## Sources inspected

Repository: https://github.com/facebook/astryx

- [PowerSearch.tsx](https://github.com/facebook/astryx/blob/main/packages/core/src/PowerSearch/PowerSearch.tsx)
- [PowerSearchEditPopover.tsx](https://github.com/facebook/astryx/blob/main/packages/core/src/PowerSearch/PowerSearchEditPopover.tsx)
  (opening definitions and main editor handlers/rendering)
- [PowerSearchToken.tsx](https://github.com/facebook/astryx/blob/main/packages/core/src/PowerSearch/PowerSearchToken.tsx)
- [types.ts](https://github.com/facebook/astryx/blob/main/packages/core/src/PowerSearch/types.ts)
- [usePowerSearchConfig.ts](https://github.com/facebook/astryx/blob/main/packages/core/src/PowerSearch/usePowerSearchConfig.ts)
- [PowerSearchWithTable.stories.tsx](https://github.com/facebook/astryx/blob/main/apps/storybook/stories/PowerSearchWithTable.stories.tsx)
- [PowerSearch.spec.md](https://github.com/facebook/astryx/blob/main/packages/core/src/PowerSearch/PowerSearch.spec.md)
- [LICENSE](https://github.com/facebook/astryx/blob/main/LICENSE)

## Observed source behavior

- A Tokenizer holds the existing conditions and an input for field selection.
- Selecting a field normally opens a compact popover with field/operator selectors
  and an operator-specific value editor. A default operator can be preselected.
- Creation appends with `[...filters, savedFilter]`; there is no field-key-based
  replacement or uniqueness restriction in this path.
- Clicking a token enters an edit mode targeting its array index. Apply copies the
  list and updates only that index; Cancel closes the popover without calling the
  save handler. Removing targets an individual index.
- Switching field discards its draft value. Switching operators preserves a draft
  only when the operator value-editor type matches.
- Choosing an empty-value operator saves immediately. The boolean helper uses
  `is_true` and `is_false` with empty-value editors. Clicking an existing empty-value
  token also follows an immediate-save path unless a custom editor overrides it.
- Enum options use string machine values and separate labels. Single and multi-value
  editor types are distinct.
- The editor guards Enter/Escape handling against IME events.
- The table example keeps filters in consumer state and evaluates rows separately.
- The helper includes a local evaluator, uses timestamps for absolute dates, and
  supports types beyond Siftbar v1. These are not requirements to copy.

The component's layout spec discusses readable editor width, stable opening-control
anchors, modality-independent placement, and viewport collision handling. Some
requirements are explicitly marked implementation pending; do not treat that spec
as proof that the current component already implements them.

## Siftbar adaptations

- Preserve additive chips, repeated fields, compact editing, and type-specific UI.
- Use an independently implemented framework-free DOM component, not React/StyleX.
- Track edits by persistent condition IDs rather than array-index-derived IDs.
- Follow the brief's simpler versioned JSON, date-only strings, actual booleans,
  and atomic validated restoration instead of PowerSearch's tagged value format.
- Keep field-search text as navigation input; do not adopt optional free-text search.
- Require explicit Apply for every edit, including nullable and boolean conditions,
  so changes are cancellable. Still permit quick no-input choices during creation.
- Validate value compatibility and constraints, not just an editor-type match.
- Keep evaluation in the demo and consumer integration code, outside core Siftbar.
- Provide CSS variables and stable styling hooks rather than design-system bindings.

## License boundary

The inspected repository license is MIT with Meta's copyright notice. The plan is
independent implementation based on the interaction concept; no Astryx source has
been copied into library code. If source is later reused, retain the required
copyright/license notices and document provenance.
