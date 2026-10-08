import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { addMonths, MAX_LUMP_SUMS } from '@/utils/debtSimulator';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

/** A one-off payment as it is typed: the amount stays text until it is parsed. */
export interface LumpSumDraft {
  month: string;
  amount: string;
}

interface LumpSumRowsProps {
  rows: LumpSumDraft[];
  /** First and last month that can be picked (`YYYY-MM`). */
  minMonth: string;
  maxMonth: string;
  currencySymbol: string;
  onChange: (rows: LumpSumDraft[]) => void;
}

export function LumpSumRows({ rows, minMonth, maxMonth, currencySymbol, onChange }: LumpSumRowsProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();

  const patch = (index: number, next: Partial<LumpSumDraft>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...next } : row)));

  const step = (index: number, delta: number) => {
    const month = addMonths(rows[index].month, delta);
    if (month < minMonth || month > maxMonth) return;
    Haptics.selectionAsync().catch(() => {});
    patch(index, { month });
  };

  const add = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // The month after the latest row, so two new rows do not land on the same month.
    const latest = rows.reduce((max, row) => (row.month > max ? row.month : max), '');
    const month = latest && latest < maxMonth ? addMonths(latest, 1) : minMonth;
    onChange([...rows, { month, amount: '' }]);
  };

  const remove = (index: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.wrap}>
      {rows.length === 0 && (
        <SelectableText style={[styles.empty, { color: colors.textSecondary }]}>{t('debt.plan.lump.empty')}</SelectableText>
      )}

      {rows.map((row, index) => {
        const monthLabel = format.monthYear(row.month, 'short');
        const atMin = row.month <= minMonth;
        const atMax = row.month >= maxMonth;
        return (
          <View key={index} style={styles.row}>
            <View style={[styles.stepper, { backgroundColor: colors.field, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => step(index, -1)}
                disabled={atMin}
                hitSlop={6}
                style={styles.stepBtn}
                accessibilityRole="button"
                accessibilityLabel={t('debt.plan.lump.a11yPrev')}
                accessibilityState={{ disabled: atMin }}
              >
                <Ionicons name="chevron-back" size={18} color={atMin ? colors.border : colors.accent} />
              </TouchableOpacity>
              <Text style={[styles.month, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {monthLabel}
              </Text>
              <TouchableOpacity
                onPress={() => step(index, 1)}
                disabled={atMax}
                hitSlop={6}
                style={styles.stepBtn}
                accessibilityRole="button"
                accessibilityLabel={t('debt.plan.lump.a11yNext')}
                accessibilityState={{ disabled: atMax }}
              >
                <Ionicons name="chevron-forward" size={18} color={atMax ? colors.border : colors.accent} />
              </TouchableOpacity>
            </View>

            <View style={[styles.amountWrap, { backgroundColor: colors.field, borderColor: colors.border }]}>
              <Text style={[styles.affix, { color: colors.textSecondary }]}>{currencySymbol}</Text>
              <TextInput
                style={[styles.amount, { color: colors.text }]}
                value={row.amount}
                onChangeText={(amount) => patch(index, { amount })}
                placeholder={format.number(0)}
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                maxLength={12}
                selectTextOnFocus
                accessibilityLabel={`${t('debt.plan.lump.amount')}, ${monthLabel}`}
              />
            </View>

            <TouchableOpacity
              onPress={() => remove(index)}
              hitSlop={10}
              style={styles.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('debt.plan.lump.a11yRemove', { month: monthLabel })}
            >
              <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        );
      })}

      {rows.length < MAX_LUMP_SUMS && (
        <TouchableOpacity onPress={add} activeOpacity={0.8} style={styles.addBtn} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
          <Text style={[styles.addText, { color: colors.accent }]}>{t('debt.plan.lump.add')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  empty: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepBtn: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  month: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  amountWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    gap: 6,
  },
  affix: { fontSize: 15, fontWeight: '600' },
  amount: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 0 },
  removeBtn: { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  addText: { fontSize: 15, fontWeight: '600' },
});
