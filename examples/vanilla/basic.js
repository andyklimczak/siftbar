import { Siftbar } from '../../dist/siftbar.js';
import { fields } from '../report-of-week/schema.js';
import { createResultView } from '../report-of-week/results.js';

export function mountBasicExample() {
  // @binding:start
  const updateResults = createResultView('basic');
  // @binding:end
  // @setup:start
  const siftbar = new Siftbar(document.querySelector('#basic-filters'), {
    fields,
    onChange: updateResults,
  });
  // @setup:end
  return { siftbar, updateResults };
}
