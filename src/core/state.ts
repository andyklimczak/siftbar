import { copyState, isRecord, SiftbarValidationError, validateState } from './validation.js';
import type { Field, Filter, FilterState } from './types.js';

/** Internal state store. All replacements are validated before assignment. */
export class StateStore {
  private state: FilterState = { version: 1, combinator: 'and', filters: [] };
  private nextId = 1;
  private issued = new Set<string>();
  constructor(private fields: readonly Field[]) {}
  get(): FilterState { return copyState(this.state); }
  set(input: unknown): void {
    const valid = validateState(input, this.fields);
    this.state = valid;
    valid.filters.forEach(filter => this.issued.add(filter.id));
  }
  setFilters(input: unknown): void {
    if (!Array.isArray(input)) throw new SiftbarValidationError([{ code: 'invalid', path: 'filters', message: 'Expected an array.' }]);
    const candidates = Array.from(input, (condition: unknown, index) => {
      const path = `filters[${index}]`;
      if (!isRecord(condition)) throw new SiftbarValidationError([{ code: 'invalid', path, message: 'Expected a plain filter condition.' }]);
      if (Object.hasOwn(condition, 'id')) throw new SiftbarValidationError([{ code: 'unknown', path: `${path}.id`, message: 'IDs are managed by Siftbar. Omit this property.' }]);
      return { ...condition, id: `candidate-${index}` };
    });
    // Validate everything before issuing IDs or replacing the saved conditions.
    let valid: FilterState;
    try { valid = validateState({ version: 1, combinator: 'and', filters: candidates }, this.fields); }
    catch (error) {
      if (!(error instanceof SiftbarValidationError)) throw error;
      throw new SiftbarValidationError(error.issues.map(issue => ({ ...issue, path: issue.path.replace(/^state\./, '') })));
    }
    this.set({ ...valid, filters: valid.filters.map(filter => ({ ...filter, id: this.freshId() })) });
  }
  freshId(): string {
    let id: string;
    do { id = `filter-${this.nextId++}`; } while (this.issued.has(id));
    this.issued.add(id);
    return id;
  }
  save(filter: Filter, editId?: string): void {
    const filters = this.get().filters;
    if (editId) {
      const index = filters.findIndex(item => item.id === editId);
      if (index < 0) throw new Error('The edited filter no longer exists.');
      filters[index] = { ...filter, id: editId };
    } else filters.push(filter);
    this.set({ version: 1, combinator: 'and', filters });
  }
  remove(id: string): void {
    this.set({ ...this.get(), filters: this.state.filters.filter(filter => filter.id !== id) });
  }
  clear(): void { this.state = { version: 1, combinator: 'and', filters: [] }; }
}
