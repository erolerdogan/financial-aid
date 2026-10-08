import {
  PILLAR_LABELS,
  pillarStatus,
  pillarTarget,
  pillarTargetKey,
  statusColor,
  trimNumber,
} from '@/components/health/healthUi';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { PillarScore } from '@/utils/budgetHealth';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface PillarRowProps {
  pillar: PillarScore;
  /** Shown as a link on the buffer row while the savings figure is missing. */
  onAddBuffer?: () => void;
}

export function PillarRow({ pillar, onAddBuffer }: PillarRowProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();

  const color = statusColor(pillarStatus(pillar), colors);
  const label = t(PILLAR_LABELS[pillar.id]);
  const target = t(pillarTargetKey(pillar.id), { target: pillarTarget(pillar.id) });
  const known = pillar.score !== null && pillar.value !== null;

  let valueText = t('health.pillar.unknown');
  if (known && pillar.value !== null) {
    const value = format.number(trimNumber(pillar.value));
    valueText = t(pillar.id === 'buffer' ? 'health.pillar.valueBuffer' : 'health.pillar.valuePct', { value });
  }

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${label}: ${valueText}. ${target}`}
    >
      <View style={styles.header}>
        <SelectableText style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {label}
        </SelectableText>
        <SelectableText style={[styles.score, { color: known ? color : colors.textSecondary }]}>
          {pillar.score !== null ? Math.round(pillar.score) : '–'}
        </SelectableText>
      </View>

      <View style={[styles.track, { backgroundColor: colors.track }]}>
        {pillar.score !== null && (
          <View style={[styles.fill, { width: `${Math.max(2, pillar.score)}%`, backgroundColor: color }]} />
        )}
      </View>

      <View style={styles.footer}>
        <SelectableText style={[styles.value, { color: colors.textSecondary }]}>{valueText}</SelectableText>
        <SelectableText style={[styles.value, { color: colors.textSecondary }]}>{target}</SelectableText>
      </View>

      {!known && pillar.id === 'buffer' && onAddBuffer ? (
        <TouchableOpacity style={styles.link} onPress={onAddBuffer} accessibilityRole="button">
          <Text style={[styles.linkText, { color: colors.accent }]}>{t('health.pillar.addBuffer')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  score: { fontSize: 15, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  value: { fontSize: 12 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontSize: 13, fontWeight: '600' },
});
