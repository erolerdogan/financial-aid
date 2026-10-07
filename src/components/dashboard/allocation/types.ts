import { CategoryTotal } from '@/db/database';

export interface AllocationChartViewProps {
  /** Categories to draw, largest first. */
  items: CategoryTotal[];
  /** Spending across all categories of the period, including the ones not in `items`. */
  total: number;
  /** Category expanded in the list below; the others are dimmed. */
  expandedCategory: string | null;
  onCategoryPress: (categoryName: string) => void;
}

export const sharePercent = (amount: number, total: number): number => (total > 0 ? (amount / total) * 100 : 0);
