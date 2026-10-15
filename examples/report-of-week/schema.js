// @setup:start
export const fields = [
  { key: 'category', label: 'Category', type: 'enum', operators: ['eq', 'any_of'], options: [
    { value: 'Running On Empty', label: 'Running On Empty' },
    { value: 'Energy Crisis', label: 'Energy Crisis' },
    { value: 'Drink Review', label: 'Drink Review' },
    { value: 'Music Review', label: 'Music Review' },
    { value: 'Travel Review', label: 'Travel Review' },
    { value: 'Other', label: 'Other' },
  ] },
  { key: 'rating', label: 'Rating', type: 'number', min: 0, max: 10, operators: ['gte', 'lte', 'between'] },
  { key: 'dateReleased', label: 'Released', type: 'date', operators: ['on', 'between'] },
];
// @setup:end
