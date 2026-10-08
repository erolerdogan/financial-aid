import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import { type Scenario, type ScenarioKey, type ScenarioResult } from '@/utils/freedom';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ScenarioSelectorProps {
  scenarios: ScenarioResult[];
  /** Null when the return field holds a custom value. */
  active: ScenarioKey | null;
  onSelect: (scenario: Scenario) => void;
  currencySymbol: string;
  /** The inputs are invalid, so the balances are from the last valid plan. */
  stale?: boolean;
}

const percent = (value: number): string => `${Number((value * 100).toFixed(2))}%`;

export const SCENARIO_LABELS: Record<ScenarioKey, TranslationKey> = {
  PESSIMISTIC: 'freedom.scenario.cautious',
  NEUTRAL: 'freedom.scenario.expected',
  OPTIMISTIC: 'freedom.scenario.optimistic',
};

export function ScenarioSelector({ scenarios, active, onSelect, currencySymbol, stale = false }: ScenarioSelectorProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();

  const fmt = (value: number) => format.money(Math.round(value), currencySymbol);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SelectableText style={[styles.title, { color: colors.textSecondary }]}>{t('freedom.outlook')}</SelectableText>

      <View style={[styles.segmentedContainer, { backgroundColor: colors.track }]} accessibilityRole="radiogroup">
        {scenarios.map((scenario) => {
          const selected = scenario.key === active;
          return (
            <TouchableOpacity
              key={scenario.key}
              activeOpacity={0.8}
              style={[styles.segmentBtn, selected && [styles.segmentBtnActive, { backgroundColor: colors.raised }]]}
              onPress={() => onSelect(scenario)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t('freedom.scenario.a11y', {
                label: t(SCENARIO_LABELS[scenario.key]),
                percent: percent(scenario.returnPct),
              })}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.textSecondary },
                  selected && [styles.segmentTextActive, { color: colors.text }],
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t(SCENARIO_LABELS[scenario.key])}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.compareRow, stale && styles.stale]}>
        {scenarios.map((scenario) => {
          const selected = scenario.key === active;
          return (
            <View
              key={scenario.key}
              style={styles.compareCell}
              accessible
              accessibilityLabel={t('freedom.scenario.a11yBalance', {
                label: t(SCENARIO_LABELS[scenario.key]),
                percent: percent(scenario.returnPct),
                balance: fmt(scenario.finalBalance),
              })}
            >
              <SelectableText
                style={[styles.compareValue, { color: selected ? colors.accent : colors.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {fmt(scenario.finalBalance)}
              </SelectableText>
              <SelectableText style={[styles.compareSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {t('freedom.scenario.est', { percent: percent(scenario.returnPct) })}
              </SelectableText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth },
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
  // Same padding as the segmented control, so each balance sits under its segment.
  compareRow: { flexDirection: 'row', paddingHorizontal: 2, marginTop: 10 },
  stale: { opacity: 0.5 },
  compareCell: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  compareValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  compareSub: { fontSize: 11, marginTop: 2 },
});
