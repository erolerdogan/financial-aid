import {
  FreedomField,
  GOAL_FIELDS,
  type FreedomDraft,
  type FreedomErrors,
  type FreedomFieldKey,
} from '@/components/freedom/FreedomInputs';
import { useTheme } from '@/contexts/ThemeContext';
import { MAX_GOAL_YEARS, SAFE_WITHDRAWAL_RATE, type GoalType } from '@/utils/freedom';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TYPES: { key: GoalType; label: string }[] = [
  { key: 'BALANCE', label: 'Target balance' },
  { key: 'INCOME', label: 'Passive income' },
];

const ON_TRACK_COLOR = '#34C759';
const BEHIND_COLOR = '#FF9500';

export type GoalResult = {
  /** Target balance in the selected mode; 0 means no goal set. */
  target: number;
  /** Final balance of the plan in the selected mode. */
  projected: number;
  /** Years until the target at the current monthly amount; null when out of reach. */
  yearsNeeded: number | null;
  /** Monthly amount that reaches the target in the plan's timeframe; null when out of reach. */
  monthlyNeeded: number | null;
};

interface GoalSectionProps {
  goalType: GoalType;
  onGoalTypeChange: (type: GoalType) => void;
  draft: FreedomDraft;
  errors: FreedomErrors;
  onChange: (key: FreedomFieldKey, text: string) => void;
  goal: GoalResult;
  /** The plan's timeframe and monthly amount, which the results are measured against. */
  years: number;
  monthly: number;
  annualIncreasePct: number;
  currencySymbol: string;
  /** Amounts are in today's money (after inflation). */
  real?: boolean;
  /** The inputs are invalid, so the numbers are from the last valid plan. */
  stale?: boolean;
}

const percent = (value: number): string => `${Number((value * 100).toFixed(2))}%`;

const yearsLabel = (value: number): string => {
  const rounded = Number(value.toFixed(1));
  return `${rounded} ${rounded === 1 ? 'year' : 'years'}`;
};

export function GoalSection({
  goalType,
  onGoalTypeChange,
  draft,
  errors,
  onChange,
  goal,
  years,
  monthly,
  annualIncreasePct,
  currencySymbol,
  real = false,
  stale = false,
}: GoalSectionProps) {
  const { colors } = useTheme();

  const fmt = (value: number) =>
    `${currencySymbol}${Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const field = GOAL_FIELDS[goalType];
  const hasGoal = goal.target > 0;
  // Opt-in: a single row until a goal exists. Once open it stays open, so clearing the field does not close it.
  const [open, setOpen] = useState(hasGoal);
  if (hasGoal && !open) setOpen(true);
  const onTrack = goal.projected >= goal.target;
  const progress = hasGoal ? Math.min(1, Math.max(0, goal.projected / goal.target)) : 0;
  // Never rounds up to 100% while the goal is still short.
  const progressPct = onTrack ? 100 : Math.min(99, Math.round(progress * 100));
  const statusColor = onTrack ? ON_TRACK_COLOR : BEHIND_COLOR;
  const statusLabel = onTrack ? 'On track' : 'Behind';
  const timeframe = `${years} ${years === 1 ? 'year' : 'years'}`;
  // Rounded up, so the shown amount still reaches the goal.
  const needed = goal.monthlyNeeded === null ? null : Math.ceil(goal.monthlyNeeded);

  const renderResult = (label: string, value: string | null, detail: string) => (
    <View accessible accessibilityLabel={`${label}, estimated, ${value ?? 'out of reach'}. ${detail}`}>
      <View style={styles.row}>
        <Text style={[styles.rowLabel, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        {value ? (
          <Text
            style={[styles.rowValue, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {value}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.detail, { color: colors.textSecondary }]}>{detail}</Text>
    </View>
  );

  const renderYears = () => {
    const label = `At ${fmt(monthly)} a month`;
    if (goal.yearsNeeded === null) {
      return renderResult(
        label,
        null,
        `This pace doesn't get there within ${MAX_GOAL_YEARS} years. A higher monthly amount or a smaller goal brings it within reach.`
      );
    }
    if (goal.yearsNeeded === 0) return renderResult(label, 'Reached', 'Your starting amount already covers this goal.');
    const gap = goal.yearsNeeded - years;
    const detail =
      Math.abs(gap) < 0.05
        ? `Right on your ${timeframe} timeframe.`
        : gap < 0
          ? `${yearsLabel(-gap)} sooner than your ${timeframe} timeframe.`
          : `${yearsLabel(gap)} longer than your ${timeframe} timeframe.`;
    return renderResult(label, yearsLabel(goal.yearsNeeded), detail);
  };

  const renderMonthly = () => {
    const label = `To get there in ${timeframe}`;
    if (needed === null) {
      return renderResult(
        label,
        null,
        `No monthly amount gets there in ${timeframe} with these numbers. Try more years or a lower fee.`
      );
    }
    if (needed === 0) return renderResult(label, `${fmt(0)} a month`, 'Your starting amount gets there on its own.');
    const growth = annualIncreasePct !== 0 ? `, then ${annualIncreasePct > 0 ? '+' : ''}${percent(annualIncreasePct)} a year` : '';
    const diff = needed - Math.round(monthly);
    const compare =
      diff > 0 ? `${fmt(diff)} more than now` : diff < 0 ? `${fmt(-diff)} less than now` : 'what you invest now';
    return renderResult(label, `${fmt(needed)} a month`, `${compare}${growth}.`);
  };

  if (!open) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.card, styles.addRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Add a goal. See if you are on track for a target balance or a monthly income"
      >
        <Ionicons name="flag-outline" size={20} color={colors.accent} />
        <View style={styles.addBody}>
          <Text style={[styles.addTitle, { color: colors.text }]}>Add a goal</Text>
          <Text style={[styles.addSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            See if you are on track
          </Text>
        </View>
        <Ionicons name="add" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>GOAL (EST.)</Text>

      <View style={[styles.segmentedContainer, { backgroundColor: colors.track }]} accessibilityRole="radiogroup">
        {TYPES.map((item) => {
          const selected = item.key === goalType;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.8}
              style={[styles.segmentBtn, selected && [styles.segmentBtnActive, { backgroundColor: colors.raised }]]}
              onPress={() => onGoalTypeChange(item.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.label} goal`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.textSecondary },
                  selected && [styles.segmentTextActive, { color: colors.text }],
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.field}>
        <FreedomField
          field={field}
          value={draft[field.key]}
          error={errors[field.key]}
          onChange={onChange}
          currencySymbol={currencySymbol}
        />
      </View>

      {goalType === 'INCOME' ? (
        <Text style={[styles.note, { color: colors.textSecondary }, stale && styles.stale]}>
          {hasGoal ? `Needs a balance of ${fmt(goal.target)}. ` : ''}
          Assumption: the {percent(SAFE_WITHDRAWAL_RATE)} rule, you withdraw {percent(SAFE_WITHDRAWAL_RATE)} of the
          balance per year (income × 12 ÷ {SAFE_WITHDRAWAL_RATE}). A rule of thumb, not a guarantee.
        </Text>
      ) : null}

      {hasGoal ? (
        <View style={[styles.results, { borderTopColor: colors.border }, stale && styles.stale]}>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progressPct }}
            accessibilityLabel={`${statusLabel}. Estimated ${fmt(goal.projected)} of ${fmt(
              goal.target
            )} after ${timeframe}, ${progressPct} percent${real ? ", in today's money" : ''}`}
          >
            <View style={styles.row}>
              <View style={[styles.pill, { backgroundColor: `${statusColor}22` }]}>
                <View style={[styles.dot, { backgroundColor: statusColor }]} />
                <Text style={[styles.pillText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <Text style={[styles.rowValue, { color: colors.text }]}>{progressPct}%</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.track }]}>
              <View style={[styles.fill, { backgroundColor: statusColor, width: `${progress * 100}%` }]} />
            </View>
            <Text style={[styles.detail, { color: colors.textSecondary }]}>
              {onTrack
                ? `${fmt(goal.projected)} est. after ${timeframe}, ${fmt(goal.projected - goal.target)} above your goal.`
                : `${fmt(goal.projected)} est. of ${fmt(goal.target)} after ${timeframe}, ${fmt(
                    goal.target - goal.projected
                  )} short.`}
              {real ? " In today's money." : ''}
            </Text>
          </View>

          {renderYears()}
          {renderMonthly()}
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          Enter a goal to see how long it takes and what to invest each month.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 12 },
  addBody: { flex: 1 },
  addTitle: { fontSize: 15, fontWeight: '600' },
  addSubtitle: { fontSize: 12, marginTop: 2 },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  segmentedContainer: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segmentBtn: { flex: 1, paddingVertical: 7, paddingHorizontal: 4, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '500' },
  segmentTextActive: { fontWeight: '700' },
  field: { marginTop: 14 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  empty: { fontSize: 13, lineHeight: 18, marginTop: 12 },
  results: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 14, gap: 14 },
  stale: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flexShrink: 1, fontSize: 14 },
  rowValue: { flexShrink: 0, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  detail: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 13, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10 },
  fill: { height: 8, borderRadius: 4 },
});
