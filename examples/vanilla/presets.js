// @presets:start
export const presets = {
  empty: [],
  fastFood: [
    { field: 'category', operator: 'eq', value: 'Running On Empty' },
    { field: 'rating', operator: 'gte', value: 8 },
  ],
  energy: [{ field: 'category', operator: 'eq', value: 'Energy Crisis' }],
  recent: [{ field: 'dateReleased', operator: 'between', value: ['2025-01-01', '2026-12-31'] }],
};
// @presets:end
