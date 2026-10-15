const filters = new window.Siftbar(document.querySelector('#filters'), {
  label: 'Standalone filters', fields: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'ram', label: 'RAM', type: 'number', integer: true, min: 0 },
  ],
  onChange(state) { document.querySelector('#state').textContent = JSON.stringify(state, null, 2); },
});
document.querySelector('#state').textContent = JSON.stringify(filters.getState(), null, 2);
