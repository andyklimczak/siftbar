// Application-owned table renderer, not a Siftbar API.
export function renderRows(rows, records, columns) {
  rows.replaceChildren(...records.map(record => {
    const row = document.createElement('tr');
    for (const key of columns) {
      const cell = document.createElement('td');
      cell.textContent = record[key] === null ? '—' : String(record[key]);
      row.append(cell);
    }
    return row;
  }));
}
