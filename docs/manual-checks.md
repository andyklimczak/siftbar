# Manual accessibility and interaction checklist

Status: checklist provided; human screen-reader/touch/zoom testing has not yet been
performed. Automated keyboard/axe checks are recorded separately in verification.md.
Do not treat an automated pass as full accessibility certification.

Start with `npm run dev`, then open http://127.0.0.1:4173/siftbar/.

## Progressive examples and setup

- The first example filters review category, rating, and release date using supported
  API operators. Text/boolean library support remains covered by the interaction fixtures.
  There are no preset controls or visible state tools in this example.
- Read the opening integration guide: assets/container, field definitions, and an
  application-owned results handler. Confirm it does not imply Siftbar fetches or evaluates data.
- The second applies Fast food rated 8+/Energy Crisis presets through ordinary buttons.
- The third uses a preset dropdown and Clear. After manually changing a preset chip,
  the dropdown should say Custom filters; Clear resets it and the results.
- Examples remain independent: presets in one never modify another.
- Setup/HTML and actual updateResults/HTTP code are visible and separately copyable.
  Confirm request parameters and fetch calls require no expansion; full rendering and
  state tools stay optional. Live demos should not show verbose request URLs/prose.

## Keyboard (mouse disconnected)

- Tab to the add combobox; browse fields with arrows and select with Enter.
- In the generic fixture, search an alias such as hostname. Confirm search text does not become a filter.
- Selecting a field immediately shows Field, Operator, and Value in one row on
  desktop. Confirm the default operator, native select navigation, and responsive
  wrapping on mobile. Enter advances through selects and commits boolean/no-value
  choices from the operator control. There are no Cancel/Add/Apply buttons.
- Create text, number, date, boolean, enum single, and enum multi filters.
- Enum options align directly beneath Value, not beneath Field/Operator. For multi-value
  operators, selected values appear as chips inside Value. Toggle with Enter, remove
  each using its × button (mouse or keyboard), then Tab away to save. Removal must not
  submit a form or auto-save prematurely. Emptying an existing selection preserves the
  saved filter on dismissal; Escape restores it. Check narrow layouts and long labels.
- Exercise numeric/date ranges, zero, false, meaningful spaces, empty text, and
  nullable choices. Verify errors identify the problem and original filters survive.
- Focus a chip, activate to edit, change values/operator/field, click or Tab away to
  save, or press Escape to cancel. Invalid drafts must preserve the saved chip.
- Escape from the editor cancels. The selected chip regains focus after edit/cancel.
  Check native select Escape dismissal with each browser/OS.
- Boolean and nullable selections stay drafts until leaving or pressing Operator
  Enter. Only Field/Operator are shown: no third column or no-value placeholder.
  Editing enum search text requires explicitly choosing an option.
- An untouched blank text draft does not save. Typing and clearing it explicitly
  saves an empty string. Switching chips saves the old draft and opens the new one.
- Tab and Shift+Tab leave the component without trapping or stealing focus.
- On empty add input, Backspace first focuses the last chip, not deletes it. A second
  Backspace deletes it. Verify labeled remove buttons and clear-all remain reachable.
- After committing while the add input retains focus, Enter/ArrowDown reopens browsing.
- Move around in text/number inputs with native editing shortcuts; don't lose typing.
- Use an actual CJK IME: Enter confirms composition without committing the filter.
- Enter in draft controls never submits an enclosing form; deliberate form submit
  still works outside the filter editor.

## Screen readers

Check at least NVDA + Firefox/Chrome and VoiceOver + Safari when available. Record
versions, OS, and outcome; these combinations are not currently claimed tested.

- Label, expanded state, active option, selection, and option types are understandable.
- No-match picker state is understandable. Multi-selection state is discoverable.
- Chip labels include full field/operator/value despite ellipsis.
- Removal and editing buttons have distinct names; no nested interactive controls.
- Validation errors and add/edit/remove/clear announcements are spoken meaningfully,
  without constant duplicate announcements while typing.
- Auto-save instructions, invalid-draft dismissal, and saved-filter announcements
  are understandable. Auto-save keeps focus on the clicked/tabbed-to destination;
  Escape/remove and the modal example restore focus appropriately.
- Code panels and result-table scrolling can be reached and operated from the keyboard.

## Layout, touch, and preferences

- Test 320px and 360px widths, very long labels, and several wrapped chips.
- Test actual browser zoom at 200% and 400% (viewport resize alone is not a zoom test).
- Test light, dark, system-dark, custom colors, and a complete base.css custom skin.
- Verify contrast and visible focus, including on selected options and remove buttons.
- Enable reduced motion and high contrast/forced colors where available.
- Use a real touch device: select fields/operators, scroll option lists, edit/remove
  chips, and ensure virtual-keyboard space does not hide required controls.
- Open the native modal example, scroll/resize it, and verify its top-layer popup is
  reachable and Escape cancels the draft before closing the outer modal.
- Place the control at each viewport edge, in overflow-clipped parents, and in a long
  scrollable page. Verify popup controls stay visible and focus remains stable.

## Lifecycle and security

- Clear, copy JSON, restore it, and try invalid JSON/state; verify atomic rejection.
- Use two differently themed instances and verify state/focus/popup independence.
- Repeat mount/destroy cycles; retained old DOM nodes should no longer respond.
- Exercise the real Turbo/Stimulus fixtures via the browser test suite. External gem
  maintainers separately verify actual Rails asset pipelines, ERB helpers, and versions.
- Enter HTML-looking labels/values; they must be plain text and execute nothing.
- Every data example uses review API category/rating/date queries, with request code
  visible inline. Any-of categories make separate API calls and merge unique reviews.
  Rapid changes must not let obsolete responses replace current results.
- Category accepts predefined choices—not arbitrary text. Unrated reviews must not
  become zero; dataset-only categories are not offered as API filter choices.
- Confirm all review data comes directly from the API. Block requests, return HTTP
  errors, or simulate malformed responses: show an error and Retry without requesting
  repository JSON or substituting records. Retry uses current filters. Widgets and
  inline code panels should remain usable during failures.
