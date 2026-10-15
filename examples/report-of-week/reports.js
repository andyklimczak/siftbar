import { Siftbar } from '../../dist/siftbar.js';
import { fields } from './schema.js';
import { createResultView } from './results.js';

export function mountReportsExample() {
  // @binding:start
  const updateResults = createResultView('reports');
  // @binding:end
  // @setup:start
  const siftbar = new Siftbar(document.querySelector('#reports-filters'), {
    fields,
    onChange: updateResults,
  });
  // @setup:end
  return { siftbar, updateResults };
}
