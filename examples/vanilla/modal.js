import { Siftbar } from '../../dist/siftbar.js';
import { fields } from '../report-of-week/schema.js';

export function mountModalExample() {
  const dialog = document.querySelector('#filter-dialog');
  // @setup:start
  const siftbar = new Siftbar(document.querySelector('#modal-filters'), { fields });
  // @setup:end
  const hidden = document.querySelector('#modal-state');
  hidden.value = JSON.stringify(siftbar.getState());
  document.querySelector('#modal-filters').addEventListener('siftbar:change', event => {
    hidden.value = JSON.stringify(event.detail.state);
  });
  document.querySelector('#open-modal').addEventListener('click', () => dialog.showModal());
  document.querySelector('#close-modal').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', () => { /* The outer dialog retains native Escape behavior. */ });
  return siftbar;
}
