import { Siftbar } from '../../dist/siftbar.js';
import { fields } from '../report-of-week/schema.js';

export function mountThemeExamples() {
  // @setup:start
  const dark = new Siftbar(document.querySelector('#dark-filters'), { fields, theme: 'dark', label: 'Dark theme' });
  const branded = new Siftbar(document.querySelector('#brand-filters'), { fields, theme: 'light', label: 'Custom theme' });
  // @setup:end
  // Custom CSS lives in themes.css; each root and its popup inherit the variables.
  dark.setFilters([{ field: 'category', operator: 'eq', value: 'Energy Crisis' }]);
  // @setup:start
  const narrow = new Siftbar(document.querySelector('#narrow-filters'), {
    fields: [{ key: 'description', label: 'A field with a deliberately long descriptive label', type: 'text' }],
    label: 'Narrow layout',
  });
  // @setup:end
  narrow.setFilters([{ field: 'description', operator: 'contains', value: 'A long value that truncates visually but stays available to assistive technology' }]);
  return [dark, branded, narrow];
}
