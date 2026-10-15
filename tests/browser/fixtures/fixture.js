import { Siftbar } from '../dist/siftbar.js';
const fields = [
  { key: 'name', label: 'Name', type: 'text', aliases: ['hostname'], nullable: true },
  { key: 'ram', label: 'RAM', type: 'number', integer: true, min: 0, max: 256 },
  { key: 'created', label: 'Created', type: 'date' },
  { key: 'online', label: 'Online', type: 'boolean', nullable: true },
  { key: 'status', label: 'Status', type: 'enum', options: [{ value: 'active', label: 'Active' }, { value: 'off', label: 'Archived' }, { value: '<b>x</b>', label: '<b>Untrusted</b>' }] },
];
const callbacks = [];
const events = [];
let submissions = 0;
document.querySelector('#form').addEventListener('submit', event => { event.preventDefault(); submissions++; });
document.querySelector('#one').addEventListener('siftbar:change', event => {
  events.push(structuredClone(event.detail));
  document.querySelector('#hidden-state').value = JSON.stringify(event.detail.state);
});
const one = new Siftbar(document.querySelector('#one'), { fields, label: 'First filters', theme: 'light', onChange: (state, detail) => callbacks.push({ state, ...detail }) });
const two = new Siftbar(document.querySelector('#two'), { fields, label: 'Second filters', theme: 'dark' });
document.querySelector('#hidden-state').value = JSON.stringify(one.getState());
window.fixture = { Siftbar, fields, one, two, callbacks, events, submissions: () => submissions };
