import { autoUpdate, computePosition, flip, shift, size, offset } from '@floating-ui/dom';
import { filterLabel } from '../core/format.js';
import { noValue, operatorLabel, operatorsFor } from '../core/operators.js';
import { StateStore } from '../core/state.js';
import { copyState, copyValue, SiftbarValidationError, validateSchema, valueError } from '../core/validation.js';
import type { ChangeDetail, EmitOptions, Field, Filter, FilterCondition, FilterState, FilterValue, OperatorId, SiftbarOptions, ValidationIssue } from '../core/types.js';

type Step = 'field' | 'value';
type EditorFocus = 'value' | 'field' | 'operator';
interface Draft { field?: string; operator?: OperatorId; value?: FilterValue; editId?: string }
interface OperatorChoice { key: string; operator: OperatorId; label: string; value?: boolean }
interface Choice { key: string; label: string; hint?: string; group?: string; selected?: boolean; select: () => void }
const mounted = new WeakMap<HTMLElement, Siftbar>();
let instanceSequence = 0;

/** Framework-free structured filter control. Mounts only inside the supplied host. */
export class Siftbar {
  private readonly doc: Document;
  private readonly fields: Field[];
  private readonly store: StateStore;
  private readonly options: SiftbarOptions;
  private readonly uid: string;
  private readonly root: HTMLDivElement;
  private readonly chips: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly clearButton: HTMLButtonElement;
  private readonly popup: HTMLDivElement;
  private readonly live: HTMLDivElement;
  private readonly abort: AbortController;
  private dead = false;
  private draft: Draft | null = null;
  private step: Step = 'field';
  private fieldSelect?: HTMLSelectElement;
  private operatorSelect?: HTMLSelectElement;
  private valueTouched = false;
  private openingControl: HTMLElement | null = null;
  private stopPositioning?: () => void;
  private positionGeneration = 0;
  private choices: Choice[] = [];
  private active = -1;
  private list?: HTMLDivElement;
  private combo?: HTMLInputElement;
  private error?: HTMLDivElement;
  private valueInputs: HTMLInputElement[] = [];
  private suppressOpen = false;
  private composing = false;
  private pendingFocus?: HTMLElement;
  private focusTimer?: number;
  private chipPointer = false;
  private contentAbort?: AbortController;
  private choiceAbort?: AbortController;
  private chipAbort?: AbortController;
  private selectedChip?: string;
  private multiValues: string[] = [];

  constructor(host: HTMLElement, options: SiftbarOptions) {
    if (!host || host.nodeType !== 1 || !host.ownerDocument) throw new TypeError('Siftbar requires a host element.');
    if (mounted.has(host)) throw new Error('This host already has a Siftbar instance. Destroy it before remounting.');
    this.fields = validateSchema(options?.fields);
    const issues: ValidationIssue[] = [];
    const invalid = (path: string, message: string) => issues.push({ code: 'invalid', path: `options.${path}`, message });
    if (options.label !== undefined && typeof options.label !== 'string') invalid('label', 'Expected text.');
    if (options.placeholder !== undefined && typeof options.placeholder !== 'string') invalid('placeholder', 'Expected text.');
    if (options.theme !== undefined && !['system', 'light', 'dark'].includes(options.theme)) invalid('theme', 'Expected system, light, or dark.');
    if (options.onChange !== undefined && typeof options.onChange !== 'function') invalid('onChange', 'Expected a function.');
    if (issues.length) throw new SiftbarValidationError(issues);
    this.doc = host.ownerDocument;
    this.options = { ...options, fields: this.fields };
    this.store = new StateStore(this.fields);
    let uid: string;
    do { uid = `siftbar-${++instanceSequence}`; } while (this.doc.querySelector(`[id^="${uid}-"]`));
    this.uid = uid;
    // Use the host document's realm so mounting in an iframe works too.
    this.abort = new this.doc.defaultView!.AbortController();
    this.root = this.element('div', 'siftbar');
    this.root.dataset.theme = options.theme ?? 'system';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', options.label ?? 'Filters');
    const bar = this.element('div', 'siftbar__bar');
    const icon = this.element('span', 'siftbar__icon', '⌕');
    icon.setAttribute('aria-hidden', 'true');
    this.chips = this.element('div', 'siftbar__chips');
    this.input = this.element('input', 'siftbar__add');
    this.input.type = 'text';
    this.input.placeholder = options.placeholder ?? 'Add a filter…';
    this.input.setAttribute('aria-label', `${options.label ?? 'Filters'}: add a filter`);
    this.input.autocomplete = 'off';
    this.clearButton = this.button('Clear filters', 'siftbar__clear', () => this.clear());
    this.clearButton.textContent = 'Clear';
    this.popup = this.element('div', 'siftbar__popup');
    this.popup.id = `${this.uid}-popup`;
    this.popup.setAttribute('popover', 'manual');
    this.popup.hidden = true;
    this.live = this.element('div', 'siftbar__sr');
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');
    this.live.setAttribute('aria-atomic', 'true');
    bar.append(icon, this.chips, this.input, this.clearButton);
    this.root.append(bar, this.popup, this.live);
    host.append(this.root);
    mounted.set(host, this);
    this.host = host;
    this.setupCombo(this.input);
    const signal = this.abort.signal;
    this.input.addEventListener('focus', () => {
      if (!this.suppressOpen && (!this.draft || this.combo !== this.input)) {
        this.finishDraft();
        if (!this.dead) this.beginAdd();
      }
    }, { signal });
    this.input.addEventListener('click', () => {
      if (!this.draft || this.combo !== this.input) {
        this.finishDraft();
        if (!this.dead) this.beginAdd();
      }
    }, { signal });
    this.input.addEventListener('input', () => {
      this.selectedChip = undefined;
      if (!this.draft || this.combo !== this.input) {
        const query = this.input.value;
        this.finishDraft();
        if (this.dead) return;
        this.input.value = query; this.beginAdd();
      }
      this.renderFieldChoices(this.input.value);
    }, { signal });
    this.root.addEventListener('compositionstart', () => { this.composing = true; }, { signal });
    this.root.addEventListener('compositionend', () => { this.composing = false; }, { signal });
    this.root.addEventListener('keydown', event => this.onKey(event), { signal });
    this.root.addEventListener('focusout', () => this.scheduleFinish(), { signal });
    this.doc.addEventListener('pointerdown', event => {
      const target = event.target as Node;
      this.chipPointer = Boolean(this.draft && this.chips.contains(target));
      if (!this.draft) return;
      if (!this.root.contains(target) || (this.step === 'value' && !this.popup.contains(target)
        && !this.chips.contains(target) && target !== this.input && !this.clearButton.contains(target))) this.finishDraft();
    }, { signal });
    for (const type of ['pointerup', 'pointercancel']) {
      this.doc.addEventListener(type, () => { if (this.chipPointer) this.scheduleFinish(true); }, { signal });
    }
    this.renderChips();
  }
  private readonly host: HTMLElement;

  getState(): FilterState { this.assertAlive(); return this.store.get(); }
  setState(state: unknown, { emit = false }: EmitOptions = {}): void {
    this.assertAlive();
    this.store.set(state); // Atomic: validation failure leaves UI and saved state intact.
    this.afterSet(emit);
  }
  /** Replace filters from plain conditions; IDs and serialization stay internal. */
  setFilters(filters: readonly FilterCondition[], { emit = true }: EmitOptions = {}): void {
    this.assertAlive();
    this.store.setFilters(filters);
    this.afterSet(emit);
  }
  private afterSet(emit: boolean): void {
    const hadFocus = this.root.contains(this.doc.activeElement);
    this.close(false);
    this.renderChips();
    if (hadFocus) this.focusWithoutOpening(this.input);
    if (emit) this.notify({ reason: 'set' });
  }
  clear({ emit = true }: EmitOptions = {}): void {
    this.assertAlive();
    const changed = this.store.get().filters.length > 0;
    this.store.clear();
    this.close(false);
    this.renderChips();
    this.focusWithoutOpening(this.input);
    if (emit && changed) { this.announce('Filters cleared.'); this.notify({ reason: 'clear' }); }
  }
  focus(): void { this.assertAlive(); this.input.focus(); if (!this.draft) this.beginAdd(); }
  destroy(): void {
    if (this.dead) return;
    this.close(false);
    this.dead = true;
    this.abort.abort();
    this.chipAbort?.abort();
    this.root.remove();
    mounted.delete(this.host);
  }
  private assertAlive(): void { if (this.dead) throw new Error('Siftbar has been destroyed.'); }
  private element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const element = this.doc.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  private button(label: string, className: string, action: () => void, signal = this.contentAbort?.signal ?? this.abort.signal): HTMLButtonElement {
    const button = this.element('button', className, label);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', action, { signal });
    return button;
  }
  private scheduleFinish(releasePointer = false): void {
    this.doc.defaultView!.clearTimeout(this.focusTimer);
    // Wait for native blur/focus and chip click actions to finish. Rebuilding chips
    // between pointerdown and click would detach the clicked button in Firefox.
    this.focusTimer = this.doc.defaultView!.setTimeout(() => {
      this.focusTimer = undefined;
      if (releasePointer) this.chipPointer = false;
      if (!this.dead && this.draft && !this.pendingFocus
        && !(this.chipPointer && this.chips.contains(this.doc.activeElement))
        && !(this.step === 'value' ? this.popup : this.root).contains(this.doc.activeElement)) this.finishDraft();
    }, 0);
  }
  private field(): Field | undefined { return this.fields.find(field => field.key === this.draft?.field); }
  private announce(message: string): void { this.live.textContent = message; }
  private notify(detail: ChangeDetail): void {
    const snapshot = this.store.get();
    const callbackSnapshot = copyState(snapshot);
    // Dispatch first, then callback. Neither recipient can mutate internal state or
    // the other's payload. Both observe the same transition even if one changes state.
    this.host.dispatchEvent(new this.doc.defaultView!.CustomEvent('siftbar:change', {
      bubbles: true, detail: { ...detail, state: snapshot },
    }));
    this.options.onChange?.(callbackSnapshot, { ...detail });
  }
  private renderChips(): void {
    this.chipAbort?.abort();
    this.chipAbort = new this.doc.defaultView!.AbortController();
    this.chips.replaceChildren();
    const filters = this.store.get().filters;
    filters.forEach(filter => {
      const field = this.fields.find(field => field.key === filter.field)!;
      const label = filterLabel(field, filter);
      const chip = this.element('span', 'siftbar__chip');
      chip.dataset.filterId = filter.id;
      const edit = this.button(`Edit ${label}`, 'siftbar__chip-edit', () => this.beginEdit(filter.id, edit), this.chipAbort!.signal);
      edit.textContent = label;
      edit.title = label;
      edit.dataset.editId = filter.id;
      const remove = this.button(`Remove ${label}`, 'siftbar__chip-remove', () => this.remove(filter.id), this.chipAbort!.signal);
      remove.textContent = '×';
      remove.dataset.removeId = filter.id;
      chip.append(edit, remove);
      this.chips.append(chip);
    });
    this.clearButton.hidden = !filters.length;
  }
  private remove(id: string): void {
    const filters = this.store.get().filters;
    const index = filters.findIndex(filter => filter.id === id);
    if (index < 0) return;
    this.close(false);
    this.store.remove(id);
    this.renderChips();
    this.selectedChip = undefined;
    const edits = this.chips.querySelectorAll<HTMLButtonElement>('[data-edit-id]');
    this.focusWithoutOpening(edits[Math.min(index, edits.length - 1)] ?? this.input);
    this.announce('Filter removed.');
    this.notify({ reason: 'remove', filterId: id });
  }
  private beginAdd(): void {
    this.draft = {};
    this.openingControl = this.input;
    this.step = 'field';
    this.renderFieldPicker();
    this.show();
  }
  private beginEdit(id: string, openingControl: HTMLElement): void {
    this.finishDraft();
    if (this.dead) return;
    const filter = this.store.get().filters.find(filter => filter.id === id);
    if (!filter) return;
    openingControl = Array.from(this.chips.querySelectorAll<HTMLElement>('[data-edit-id]')).find(button => button.dataset.editId === id) ?? openingControl;
    this.draft = { field: filter.field, operator: filter.operator, value: copyValue(filter.value), editId: id };
    this.openingControl = openingControl;
    this.selectedChip = undefined;
    this.step = 'value';
    this.renderValueEditor();
    this.show();
  }
  private resetContent(): void {
    this.contentAbort?.abort();
    this.choiceAbort?.abort();
    this.contentAbort = new this.doc.defaultView!.AbortController();
    this.pendingFocus = undefined;
    if (this.combo) {
      this.combo.setAttribute('aria-expanded', 'false');
      this.combo.removeAttribute('aria-activedescendant');
    }
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.popup.replaceChildren();
    this.popup.removeAttribute('role');
    this.popup.removeAttribute('aria-label');
    this.popup.removeAttribute('aria-describedby');
    this.choices = [];
    this.active = -1;
    this.list = undefined;
    this.combo = undefined;
    this.error = undefined;
    this.valueInputs = [];
    this.fieldSelect = undefined;
    this.operatorSelect = undefined;
  }
  private setupCombo(input: HTMLInputElement): void {
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', `${this.uid}-list`);
  }
  private pickerInput(label: string, placeholder: string, parent: HTMLElement = this.popup): HTMLInputElement {
    const wrapper = this.element('label', 'siftbar__label', label);
    const input = this.element('input', 'siftbar__picker-input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    this.setupCombo(input);
    wrapper.append(input);
    parent.append(wrapper);
    return input;
  }
  private createList(combo: HTMLInputElement, label: string, multi = false, parent: HTMLElement = this.popup): void {
    this.combo = combo;
    this.list = this.element('div', 'siftbar__list');
    this.list.id = `${this.uid}-list`;
    this.list.setAttribute('role', 'listbox');
    this.list.setAttribute('aria-label', label);
    if (multi) this.list.setAttribute('aria-multiselectable', 'true');
    parent.append(this.list);
    combo.setAttribute('aria-expanded', 'true');
  }
  private drawChoices(choices: Choice[], preserveActive = false): void {
    this.choiceAbort?.abort();
    this.choiceAbort = new this.doc.defaultView!.AbortController();
    const oldKey = preserveActive ? this.choices[this.active]?.key : undefined;
    this.choices = choices;
    this.active = choices.length ? Math.max(0, choices.findIndex(choice => choice.key === oldKey)) : -1;
    this.list!.replaceChildren();
    if (!choices.length) {
      // A status is outside the listbox: it is not a selectable option.
      this.list!.hidden = true;
      let empty = this.popup.querySelector('.siftbar__empty');
      if (!empty) {
        empty = this.element('p', 'siftbar__empty');
        empty.setAttribute('role', 'status');
        this.list!.after(empty);
      }
      empty.textContent = 'No matches.';
    } else {
      this.list!.hidden = false;
      this.popup.querySelector('.siftbar__empty')?.remove();
      let group: string | undefined;
      choices.forEach((choice, index) => {
        if (choice.group && choice.group !== group) {
          const heading = this.element('div', 'siftbar__group', choice.group);
          heading.setAttribute('role', 'presentation');
          this.list!.append(heading);
          group = choice.group;
        }
        const option = this.element('div', 'siftbar__option');
        option.id = `${this.uid}-option-${index}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(choice.selected ?? false));
        option.dataset.index = String(index);
        const label = this.element('span', 'siftbar__option-label', choice.label);
        option.append(label);
        if (choice.hint) option.append(this.element('span', 'siftbar__type', choice.hint));
        const signal = this.choiceAbort!.signal;
        option.addEventListener('pointerdown', event => event.preventDefault(), { signal });
        option.addEventListener('click', () => { choice.select(); }, { signal });
        option.addEventListener('pointermove', () => { this.active = index; this.updateActive(false); }, { signal });
        this.list!.append(option);
      });
    }
    this.updateActive(false);
  }
  private updateActive(scroll = true): void {
    this.list?.querySelectorAll<HTMLElement>('[role="option"]').forEach(option => {
      option.dataset.active = String(Number(option.dataset.index) === this.active);
    });
    if (this.active >= 0) {
      this.combo?.setAttribute('aria-activedescendant', `${this.uid}-option-${this.active}`);
      if (scroll) this.doc.getElementById(`${this.uid}-option-${this.active}`)?.scrollIntoView({ block: 'nearest' });
    } else this.combo?.removeAttribute('aria-activedescendant');
  }
  private heading(text: string): void {
    this.popup.append(this.element('div', 'siftbar__heading', text));
  }
  private renderFieldPicker(): void {
    this.resetContent();
    this.step = 'field';
    this.popup.dataset.step = 'field';
    this.heading('Choose a field');
    this.createList(this.input, 'Filter fields');
    this.renderFieldChoices(this.input.value);
  }
  private renderFieldChoices(query: string): void {
    const q = query.toLocaleLowerCase();
    this.drawChoices(this.fields.filter(field => [field.label, ...(field.aliases ?? [])].some(label => label.toLocaleLowerCase().includes(q)))
      .map(field => ({ key: field.key, label: field.label, hint: field.type, group: field.group, select: () => this.chooseField(field) })));
  }
  private chooseField(field: Field, focus: EditorFocus = 'value'): void {
    if (!this.draft) return;
    const operator = field.defaultOperator ?? operatorsFor(field)[0];
    this.valueTouched = false;
    this.draft = { field: field.key, operator, editId: this.draft.editId,
      value: noValue(operator) ? null : field.type === 'boolean' ? true : undefined };
    this.input.value = '';
    this.renderValueEditor(focus);
  }
  private operatorChoices(field: Field): OperatorChoice[] {
    return operatorsFor(field).flatMap<OperatorChoice>(operator => field.type === 'boolean' && operator === 'eq'
      ? [true, false].map(value => ({ key: `eq:${value}`, operator, value, label: `${operatorLabel(field, operator)} ${value}` }))
      : [{ key: operator, operator, label: operatorLabel(field, operator) }]);
  }
  private chooseOperator(operator: OperatorId, booleanValue?: boolean): void {
    if (!this.draft) return;
    this.captureValue();
    const old = this.draft.value;
    this.draft.operator = operator;
    this.draft.value = noValue(operator) ? null : booleanValue !== undefined ? booleanValue
      : old !== undefined && !valueError(this.field()!, operator, old) ? old : undefined;
    this.renderValueEditor('operator');
  }
  private renderValueEditor(focus: EditorFocus = 'value'): void {
    const field = this.field()!;
    const operator = this.draft!.operator!;
    this.resetContent();
    this.step = 'value';
    this.popup.dataset.step = 'value';
    this.popup.setAttribute('role', 'dialog');
    this.popup.setAttribute('aria-label', `${this.draft!.editId ? 'Edit' : 'Add'} ${field.label} filter`);
    const instructions = this.element('p', 'siftbar__sr', 'Valid filters are saved when you click or tab away. Press Escape to cancel.');
    instructions.id = `${this.uid}-instructions`;
    this.popup.setAttribute('aria-describedby', instructions.id);
    this.popup.append(instructions);
    const editor = this.element('div', 'siftbar__editor-row');
    const context = this.element('div', 'siftbar__context');
    const fieldLabel = this.element('label', 'siftbar__label', 'Field');
    const fieldSelect = this.element('select', 'siftbar__context-button siftbar__field-select');
    this.fields.forEach(candidate => {
      const option = this.element('option', '', candidate.label);
      option.value = candidate.key;
      fieldSelect.append(option);
    });
    fieldSelect.value = field.key;
    fieldSelect.title = field.label;
    fieldSelect.addEventListener('change', () => {
      const candidate = this.fields.find(item => item.key === fieldSelect.value);
      if (candidate) this.chooseField(candidate, 'field');
    }, { signal: this.contentAbort!.signal });
    this.fieldSelect = fieldSelect;
    fieldLabel.append(fieldSelect);
    const operatorLabelElement = this.element('label', 'siftbar__label', 'Operator');
    const operatorSelect = this.element('select', 'siftbar__context-button siftbar__operator-select');
    const choices = this.operatorChoices(field);
    choices.forEach(choice => {
      const option = this.element('option', '', choice.label);
      option.value = choice.key;
      operatorSelect.append(option);
    });
    operatorSelect.value = field.type === 'boolean' && operator === 'eq' ? `eq:${this.draft!.value}` : operator;
    operatorSelect.addEventListener('change', () => {
      const choice = choices.find(item => item.key === operatorSelect.value);
      if (choice) this.chooseOperator(choice.operator, choice.value);
    }, { signal: this.contentAbort!.signal });
    this.operatorSelect = operatorSelect;
    operatorLabelElement.append(operatorSelect);
    context.append(fieldLabel, operatorLabelElement);
    const valueCell = this.element('div', 'siftbar__value-cell');
    editor.append(context);
    const needsValue = !noValue(operator) && field.type !== 'boolean';
    if (needsValue) editor.append(valueCell);
    else editor.classList.add('siftbar__editor-row--no-value');
    this.popup.append(editor);
    if (needsValue && field.type === 'enum') {
      this.renderEnumEditor(field, operator, valueCell);
    } else if (needsValue) {
      const range = operator === 'between';
      const values = range && Array.isArray(this.draft!.value) ? this.draft!.value : [this.draft!.value];
      const row = this.element('div', 'siftbar__values');
      for (let i = 0; i < (range ? 2 : 1); i++) {
        const label = this.element('label', 'siftbar__label', range ? (i === 0 ? 'From (inclusive)' : 'To (inclusive)') : 'Value');
        const input = this.element('input', 'siftbar__value-input');
        input.type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
        input.autocomplete = 'off';
        input.value = values[i] === undefined ? '' : String(values[i]);
        if (field.type === 'number') {
          input.step = field.step !== undefined ? String(field.step) : field.integer ? '1' : 'any';
          if (field.min !== undefined) input.min = String(field.min);
          if (field.max !== undefined) input.max = String(field.max);
        }
        if (field.type === 'date') { input.min = '0001-01-01'; input.max = '9999-12-31'; }
        input.addEventListener('input', () => { this.valueTouched = true; this.hideError(); }, { signal: this.contentAbort!.signal });
        this.valueInputs.push(input);
        label.append(input);
        row.append(label);
      }
      valueCell.append(row);
      if (field.type === 'number' && field.suffix) valueCell.append(this.element('p', 'siftbar__help', `Values in ${field.suffix}.`));
    }
    this.error = this.element('div', 'siftbar__error');
    this.error.id = `${this.uid}-error`;
    this.error.setAttribute('role', 'alert');
    this.error.hidden = true;
    this.popup.append(this.error);
    this.valueInputs.forEach(input => input.setAttribute('aria-describedby', this.error!.id));
    this.combo?.setAttribute('aria-describedby', this.error.id);
    this.focusSoon(focus === 'field' ? fieldSelect : focus === 'operator' ? operatorSelect
      : this.valueInputs[0] ?? this.combo ?? operatorSelect);
    // Reposition before showing the wider editor, including near viewport edges.
    if (!this.popup.hidden) this.show();
  }
  private renderEnumEditor(field: Extract<Field, { type: 'enum' }>, operator: OperatorId, parent: HTMLElement): void {
    const multi = operator === 'any_of' || operator === 'none_of';
    this.multiValues = Array.isArray(this.draft!.value) ? [...this.draft!.value] as string[] : [];
    const label = this.element('label', 'siftbar__label', 'Value');
    const control = this.element('div', 'siftbar__enum-control');
    const tokens = this.element('div', 'siftbar__enum-tokens');
    const combo = this.element('input', 'siftbar__picker-input');
    combo.type = 'text';
    combo.autocomplete = 'off';
    combo.placeholder = 'Search options…';
    combo.id = `${this.uid}-enum-value`;
    combo.setAttribute('aria-label', multi ? 'Choose values' : 'Choose a value');
    label.htmlFor = combo.id;
    this.setupCombo(combo);
    control.append(tokens, combo);
    const dropdown = this.element('div', 'siftbar__enum-dropdown');
    const selection = this.element('p', 'siftbar__selection siftbar__sr');
    selection.setAttribute('role', 'status');
    parent.append(label, control, dropdown, selection);
    if (!multi && typeof this.draft!.value === 'string') combo.value = field.options.find(option => option.value === this.draft!.value)?.label ?? '';
    this.createList(combo, `${field.label} values`, multi, dropdown);
    const render = (preserve = false) => {
      const selected = multi ? this.multiValues : this.draft!.value === undefined ? [] : [this.draft!.value as string];
      selection.textContent = selected.length ? `Selected: ${selected.map(value => field.options.find(option => option.value === value)?.label).join(', ')}` : 'No values selected.';
      this.drawChoices(field.options.filter(option => option.label.toLocaleLowerCase().includes(combo.value.toLocaleLowerCase()))
        .map(option => ({ key: option.value, label: option.label, selected: selected.includes(option.value),
          hint: selected.includes(option.value) ? '✓' : undefined,
          select: () => {
            if (multi) {
              this.multiValues = this.multiValues.includes(option.value) ? this.multiValues.filter(value => value !== option.value) : [...this.multiValues, option.value];
              this.draft!.value = [...this.multiValues];
            } else { this.draft!.value = option.value; combo.value = option.label; }
            this.hideError();
            render(true);
          },
        })), preserve);
      tokens.replaceChildren();
      if (multi) {
        for (const value of this.multiValues) {
          const text = field.options.find(option => option.value === value)!.label;
          const token = this.element('span', 'siftbar__enum-chip');
          const name = this.element('span', 'siftbar__enum-chip-label', text);
          name.title = text;
          const remove = this.element('button', 'siftbar__enum-chip-remove', '×');
          remove.type = 'button';
          remove.setAttribute('aria-label', `Remove ${text} from selected values`);
          remove.addEventListener('click', () => {
            this.multiValues = this.multiValues.filter(item => item !== value);
            this.draft!.value = [...this.multiValues];
            this.hideError();
            render(true);
            combo.focus(); // Keep the draft open when the focused token disappears.
            this.announce(`${text} removed from selected values.`);
          }, { signal: this.choiceAbort!.signal });
          token.append(name, remove);
          tokens.append(token);
        }
      }
    };
    combo.addEventListener('input', () => {
      if (!multi && combo.value !== field.options.find(option => option.value === this.draft!.value)?.label) this.draft!.value = undefined;
      this.hideError();
      render();
    }, { signal: this.contentAbort!.signal });
    render();
  }
  private readValue(): unknown {
    const field = this.field()!;
    if (noValue(this.draft!.operator!)) return null;
    if (field.type === 'boolean' || field.type === 'enum') return this.draft!.value;
    // Untouched blank text is not an intentional empty-string filter. Typing and
    // clearing it, editing a saved empty string, or pressing Enter is explicit.
    if (field.type === 'text' && this.valueInputs[0]?.value === '' && this.draft!.value === undefined && !this.valueTouched) return undefined;
    const values = this.valueInputs.map(input => field.type === 'number'
      ? input.value === '' || input.validity.badInput ? NaN : Number(input.value) : input.value);
    return this.draft!.operator === 'between' ? values : values[0];
  }
  private captureValue(): void {
    if (this.step !== 'value' || !this.draft) return;
    const value = this.readValue();
    this.draft.value = valueError(this.field()!, this.draft.operator!, value) ? undefined : value as FilterValue;
  }
  private hideError(): void {
    if (this.error) this.error.hidden = true;
    this.valueInputs.forEach(input => input.removeAttribute('aria-invalid'));
    this.combo?.removeAttribute('aria-invalid');
  }
  private finishDraft(): void {
    if (!this.draft) return;
    if (this.step === 'value' && !this.composing && this.commit(false)) return;
    if (this.step === 'value') this.announce('Incomplete or invalid filter discarded; saved filters unchanged.');
    this.close(false);
  }
  private commit(restoreFocus = true): boolean {
    if (!this.draft?.field || !this.draft.operator) return false;
    const value = this.step === 'value' ? this.readValue() : this.draft.value;
    const message = valueError(this.field()!, this.draft.operator, value);
    if (message) {
      if (!this.error) this.renderValueEditor();
      this.error!.textContent = message;
      this.error!.hidden = false;
      this.valueInputs.forEach(input => input.setAttribute('aria-invalid', 'true'));
      this.combo?.setAttribute('aria-invalid', 'true');
      return false;
    }
    const editId = this.draft.editId;
    const filter: Filter = { id: editId ?? this.store.freshId(), field: this.draft.field, operator: this.draft.operator, value: value as FilterValue };
    try { this.store.save(filter, editId); }
    catch (error) {
      if (!(error instanceof SiftbarValidationError)) throw error;
      this.announce(error.message); return false;
    }
    const focused = this.doc.activeElement as HTMLElement | null;
    const focusedEdit = focused?.dataset.editId;
    const focusedRemove = focused?.dataset.removeId;
    this.close(false);
    this.renderChips();
    const edit = editId ? Array.from(this.chips.querySelectorAll<HTMLButtonElement>('[data-edit-id]')).find(button => button.dataset.editId === editId) : undefined;
    if (restoreFocus) this.focusWithoutOpening(edit ?? this.input);
    else if (focusedEdit || focusedRemove) {
      const replacement = Array.from(this.chips.querySelectorAll<HTMLButtonElement>('button')).find(button =>
        focusedEdit ? button.dataset.editId === focusedEdit : button.dataset.removeId === focusedRemove);
      if (replacement) this.focusWithoutOpening(replacement);
    }
    this.announce(`Filter ${editId ? 'updated' : 'added'}: ${filterLabel(this.fields.find(field => field.key === filter.field)!, filter)}.`);
    this.notify({ reason: editId ? 'edit' : 'add', filterId: filter.id });
    return true;
  }
  private onKey(event: KeyboardEvent): void {
    if (event.isComposing || this.composing || event.keyCode === 229 || event.defaultPrevented) return;
    if (event.target === this.input && !this.draft && ['Enter', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); this.beginAdd(); return;
    }
    if (event.key === 'Escape' && this.draft) {
      event.preventDefault();
      this.close(true);
      return;
    }
    if (event.target === this.combo && this.choices.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.active = (this.active + (event.key === 'ArrowDown' ? 1 : -1) + this.choices.length) % this.choices.length;
        this.updateActive(); return;
      }
      if (event.key === 'Enter') { event.preventDefault(); this.choices[this.active]?.select(); return; }
    }
    if (event.key === 'Enter' && (event.target === this.fieldSelect || event.target === this.operatorSelect)) {
      event.preventDefault();
      if (event.target === this.fieldSelect) this.focusSoon(this.operatorSelect!);
      else if (this.valueInputs[0] ?? this.combo) this.focusSoon((this.valueInputs[0] ?? this.combo)!);
      else this.commit();
      return;
    }
    if (event.key === 'Enter' && this.draft && this.step === 'value' && this.valueInputs.includes(event.target as HTMLInputElement)) {
      event.preventDefault(); this.valueTouched = true; this.commit(); return;
    }
    // No-match combobox Enter must not submit an enclosing form.
    if (event.key === 'Enter' && event.target === this.combo) { event.preventDefault(); return; }
    if (event.key === 'Enter' && event.target === this.input) { event.preventDefault(); return; }
    if (event.key === 'Backspace' && event.target === this.input && this.input.value === '') {
      const filters = this.store.get().filters;
      if (filters.length) {
        event.preventDefault();
        this.close(false);
        const last = filters.at(-1)!;
        this.selectedChip = last.id;
        this.focusWithoutOpening(Array.from(this.chips.querySelectorAll<HTMLButtonElement>('[data-edit-id]')).at(-1) ?? this.input);
      }
      return;
    }
    const target = event.target as HTMLElement;
    const id = target.dataset.editId;
    if (id && (event.key === 'Delete' || (event.key === 'Backspace' && this.selectedChip === id))) {
      event.preventDefault(); this.remove(id);
    }
  }
  private focusWithoutOpening(control: HTMLElement): void {
    this.suppressOpen = true;
    control.focus();
    this.suppressOpen = false;
  }
  private focusSoon(control: HTMLElement): void {
    this.pendingFocus = control;
    queueMicrotask(() => this.flushFocus());
  }
  private flushFocus(): void {
    const control = this.pendingFocus;
    if (!control || this.popup.hidden || this.popup.dataset.positioned === 'false') return;
    this.pendingFocus = undefined;
    if (!this.dead && this.draft && this.root.contains(control)) control.focus();
  }
  private show(): void {
    this.popup.hidden = false;
    if (typeof this.popup.showPopover === 'function') this.popup.showPopover();
    const reference = this.openingControl ?? this.input;
    const generation = ++this.positionGeneration;
    this.popup.dataset.positioned = 'false';
    const update = () => {
      if (this.dead || !this.draft) return;
      void computePosition(reference, this.popup, {
        strategy: 'fixed', placement: 'bottom-start',
        middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 }), size({ padding: 12,
          apply: ({ availableWidth, availableHeight, elements }) => {
            if (generation !== this.positionGeneration || this.dead) return;
            elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`;
            elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
          },
        })],
      }).then(({ x, y }) => {
        if (generation !== this.positionGeneration || this.dead || !this.draft) return;
        this.popup.style.left = `${x}px`;
        this.popup.style.top = `${y}px`;
        this.popup.dataset.positioned = 'true';
        this.flushFocus();
      });
    };
    this.stopPositioning?.();
    this.stopPositioning = autoUpdate(reference, this.popup, update);
  }
  private close(restore: boolean): void {
    this.doc.defaultView!.clearTimeout(this.focusTimer);
    this.focusTimer = undefined;
    this.chipPointer = false;
    this.contentAbort?.abort();
    this.contentAbort = undefined;
    this.choiceAbort?.abort();
    this.choiceAbort = undefined;
    this.positionGeneration++;
    this.stopPositioning?.();
    this.stopPositioning = undefined;
    if (typeof this.popup.hidePopover === 'function' && this.popup.matches(':popover-open')) this.popup.hidePopover();
    this.popup.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.input.value = '';
    const opener = this.openingControl;
    this.draft = null;
    this.pendingFocus = undefined;
    this.fieldSelect = undefined;
    this.operatorSelect = undefined;
    this.valueTouched = false;
    this.choices = [];
    this.combo = undefined;
    this.valueInputs = [];
    if (restore) this.focusWithoutOpening(opener?.isConnected ? opener : this.input);
  }
}
