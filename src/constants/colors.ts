export const CATEGORY_COLORS: Record<string, string> = {
  Housing: '#007AFF',
  Childcare: '#AF52DE',
  Groceries: '#34C759',
  'Dining Out': '#FF9500',
  Transportation: '#5856D6',
  'Utilities & Telecom': '#5AC8FA',
  'Health & Care': '#FF2D55',
  'Shopping & Retail': '#FFCC00',
  'Taxes & Municipal Fees': '#FF3B30',
  'Credit Card Payments': '#30B0C7',
  'Financial Transfers': '#00C7BE',
  'Loan & Insurance': '#A2845E',
};

export const CATEGORY_COLOR_PALETTE: string[] = [
  '#007AFF',
  '#5856D6',
  '#AF52DE',
  '#FF2D55',
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#00C7BE',
  '#5AC8FA',
  '#A2845E',
  '#8E8E93',
];

let customCategoryColors: Record<string, string> = {};

export function setCustomCategoryColors(map: Record<string, string>): void {
  customCategoryColors = map;
}

export function getCategoryColor(category: string): string {
  return customCategoryColors[category] || CATEGORY_COLORS[category] || '#8E8E93';
}