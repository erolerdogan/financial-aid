import type { ThemeColors } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import { PILLAR_THRESHOLDS, type HealthStatus, type PillarId, type PillarScore } from '@/utils/budgetHealth';

// Same system colours the coverage badge and budget bars use; they read on light and dark cards.
const GREEN = '#34C759';
const YELLOW = '#FF9500';
const RED = '#FF3B30';

export const statusColor = (status: HealthStatus, colors: ThemeColors): string => {
  if (status === 'green') return GREEN;
  if (status === 'yellow') return YELLOW;
  if (status === 'red') return RED;
  return colors.textSecondary;
};

export const scoreColor = (score: number | null, colors: ThemeColors): string => {
  if (score === null) return colors.textSecondary;
  if (score >= 70) return GREEN;
  if (score >= 45) return YELLOW;
  return RED;
};

export const levelKey = (score: number): TranslationKey => {
  if (score >= 80) return 'health.level.great';
  if (score >= 60) return 'health.level.good';
  if (score >= 40) return 'health.level.fair';
  return 'health.level.low';
};

/** For savings the problem is being under the range, so the wording flips. */
export const statusLabelKey = (status: HealthStatus, higherIsBetter: boolean): TranslationKey => {
  if (status === 'green') return 'health.status.green';
  if (status === 'grey') return 'health.status.grey';
  if (higherIsBetter) return status === 'yellow' ? 'health.status.belowYellow' : 'health.status.belowRed';
  return status === 'yellow' ? 'health.status.yellow' : 'health.status.red';
};

export const pillarStatus = (pillar: PillarScore): HealthStatus => {
  if (pillar.score === null) return 'grey';
  if (pillar.score >= 80) return 'green';
  return pillar.score >= 40 ? 'yellow' : 'red';
};

export const PILLAR_LABELS: Record<PillarId, TranslationKey> = {
  savings: 'health.pillar.savings',
  housing: 'health.pillar.housing',
  fixed: 'health.pillar.fixed',
  debt: 'health.pillar.debt',
  buffer: 'health.pillar.buffer',
};

export const pillarTargetKey = (id: PillarId): TranslationKey => {
  if (id === 'savings') return 'health.pillar.targetMin';
  if (id === 'buffer') return 'health.pillar.targetBuffer';
  return 'health.pillar.targetMax';
};

export const pillarTarget = (id: PillarId): number => PILLAR_THRESHOLDS[id].full;

/** One decimal under 10, none above: "7.5", "32". */
export const trimNumber = (value: number): number => Number(value.toFixed(Math.abs(value) < 10 ? 1 : 0));
