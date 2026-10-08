import {
  FreedomField,
  GOAL_FIELDS,
  type FreedomDraft,
  type FreedomErrors,
  type FreedomFieldKey,
} from '@/components/freedom/FreedomInputs';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import { MAX_GOAL_YEARS, SAFE_WITHDRAWAL_RATE, type GoalType } from '@/utils/freedom';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TYPES: { key: GoalType; label: TranslationKey }[] = [
  { key: 'BALANCE', label: 'freedom.field.goalBalance' },
  { key: 'INCOME', label: 'freedom.goal.typeIncome' },
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
  const { t, format } = useI18n();
  const yearsLabel = (value: number): string => t('common.years', { count: Number(value.toFixed(1)) });

  const fmt = (value: number) => format.money(Math.round(value), currencySymbol);

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
  const statusLabel = onTrack ? t('freedom.goal.onTrack') : t('freedom.goal.behind');
  const timeframe = t('common.years', { count: years });
  // Rounded up, so the shown amount still reaches the goal.
  const needed = goal.monthlyNeeded === null ? null : Math.ceil(goal.monthlyNeeded);

  const renderResult = (label: string, value: string | null, detail: string) => (
    <View accessible accessibilityLabel={`${t('freedom.a11yEstimated', { label, value: value ?? t('freedom.goal.outOfReachShort') })}. ${detail}`}>
      <View style={styles.row}>
        <SelectableText style={[styles.rowLabel, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </SelectableText>
        {value ? (
          <SelectableText
            style={[styles.rowValue, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {value}
          </SelectableText>
        ) : null}
      </View>
      <SelectableText style={[styles.detail, { color: colors.textSecondary }]}>{detail}</SelectableText>
    </View>
  );

  const renderYears = () => {
    const label = t('freedom.goal.atMonthly', { amount: fmt(monthly) });
    if (goal.yearsNeeded === null) {
      return renderResult(
        label,
        null,
        t('freedom.goal.outOfReach', { years: MAX_GOAL_YEARS })
      );
    }
    if (goal.yearsNeeded === 0) return renderResult(label, t('freedom.goal.reached'), t('freedom.goal.reachedDetail'));
    const gap = goal.yearsNeeded - years;
    const detail =
      Math.abs(gap) < 0.05
        ? t('freedom.goal.rightOn', { timeframe })
        : gap < 0
          ? t('freedom.goal.sooner', { gap: yearsLabel(-gap), timeframe })
          : t('freedom.goal.longer', { gap: yearsLabel(gap), timeframe });
    return renderResult(label, yearsLabel(goal.yearsNeeded), detail);
  };

  const renderMonthly = () => {
    const label = t('freedom.goal.toGetThere', { timeframe });
    if (needed === null) {
      return renderResult(
        label,
        null,
        t('freedom.goal.noMonthly', { timeframe })
      );
    }
    if (needed === 0) return renderResult(label, t('freedom.goal.perMonth', { amount: fmt(0) }), t('freedom.goal.startCovers'));
    const diff = needed - Math.round(monthly);
    const compare =
      diff > 0
        ? t('freedom.goal.moreThanNow', { amount: fmt(diff) })
        : diff < 0
          ? t('freedom.goal.lessThanNow', { amount: fmt(-diff) })
          : t('freedom.goal.sameAsNow');
    const detail =
      annualIncreasePct !== 0
        ? t('freedom.goal.withGrowth', {
            compare,
            percent: `${annualIncreasePct > 0 ? '+' : ''}${percent(annualIncreasePct)}`,
          })
        : `${compare}.`;
    return renderResult(label, t('freedom.goal.perMonth', { amount: fmt(needed) }), detail);
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
        accessibilityLabel={t('freedom.goal.addA11y')}
      >
        <Ionicons name="flag-outline" size={20} color={colors.accent} />
        <View style={styles.addBody}>
          <Text style={[styles.addTitle, { color: colors.text }]}>{t('freedom.goal.add')}</Text>
          <Text style={[styles.addSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('freedom.goal.addSub')}
          </Text>
        </View>
        <Ionicons name="add" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SelectableText style={[styles.title, { color: colors.textSecondary }]}>{t('freedom.goal.title')}</SelectableText>

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
              accessibilityLabel={t('freedom.goal.typeA11y', { label: t(item.label) })}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.textSecondary },
                  selected && [styles.segmentTextActive, { color: colors.text }],
                ]}
                numberOfLines={1}
              >
                {t(item.label)}
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
        <SelectableText style={[styles.note, { color: colors.textSecondary }, stale && styles.stale]}>
          {hasGoal ? `${t('freedom.goal.needsBalance', { amount: fmt(goal.target) })} ` : ''}
          {t('freedom.goal.assumption', {
            percent: percent(SAFE_WITHDRAWAL_RATE),
            rate: format.number(SAFE_WITHDRAWAL_RATE),
          })}
        </SelectableText>
      ) : null}

      {hasGoal ? (
        <View style={[styles.results, { borderTopColor: colors.border }, stale && styles.stale]}>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progressPct }}
            accessibilityLabel={`${t('freedom.goal.progressA11y', {
              status: statusLabel,
              projected: fmt(goal.projected),
              target: fmt(goal.target),
              timeframe,
              percent: progressPct,
            })}${real ? ` ${t('freedom.inTodaysMoney')}` : ''}`}
          >
            <View style={styles.row}>
              <View style={[styles.pill, { backgroundColor: `${statusColor}22` }]}>
                <View style={[styles.dot, { backgroundColor: statusColor }]} />
                <SelectableText style={[styles.pillText, { color: statusColor }]}>{statusLabel}</SelectableText>
              </View>
              <SelectableText style={[styles.rowValue, { color: colors.text }]}>{progressPct}%</SelectableText>
            </View>
            <View style={[styles.track, { backgroundColor: colors.track }]}>
              <View style={[styles.fill, { backgroundColor: statusColor, width: `${progress * 100}%` }]} />
            </View>
            <SelectableText style={[styles.detail, { color: colors.textSecondary }]}>
              {onTrack
                ? t('freedom.goal.above', {
                    projected: fmt(goal.projected),
                    timeframe,
                    diff: fmt(goal.projected - goal.target),
                  })
                : t('freedom.goal.short', {
                    projected: fmt(goal.projected),
                    target: fmt(goal.target),
                    timeframe,
                    diff: fmt(goal.target - goal.projected),
                  })}
              {real ? ` ${t('freedom.inTodaysMoney')}` : ''}
            </SelectableText>
          </View>

          {renderYears()}
          {renderMonthly()}
        </View>
      ) : (
        <SelectableText style={[styles.empty, { color: colors.textSecondary }]}>
          {t('freedom.goal.empty')}
        </SelectableText>
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
