import { Siftbar } from '../../dist/siftbar.js';
import { fields } from '../report-of-week/schema.js';
import { createResultView } from '../report-of-week/results.js';

export function mountPresetButtonsExample() {
  // @binding:start
  const updateResults = createResultView('buttons');
  // @binding:end
  // @setup:start
  const siftbar = new Siftbar(document.querySelector('#button-filters'), {
    fields,
    onChange: updateResults,
  });
  document.querySelector('#fast-food-preset').addEventListener('click', () => {
    siftbar.setFilters([
      { field: 'category', operator: 'eq', value: 'Running On Empty' },
      { field: 'rating', operator: 'gte', value: 8 },
    ]);
  });
  document.querySelector('#energy-preset').addEventListener('click', () => {
    siftbar.setFilters([{ field: 'category', operator: 'eq', value: 'Energy Crisis' }]);
  });
  // @setup:end
  return { siftbar, updateResults };
}
