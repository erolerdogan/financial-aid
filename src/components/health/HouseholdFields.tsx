import { SelectableText } from '@/components/SelectableText';
import type { HousingType } from '@/constants/benchmarks';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import { parseOptionalAmount } from '@/utils/profileSetup';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const MAX_PEOPLE = 12;

const HOUSING_OPTIONS: { key: HousingType; label: TranslationKey }[] = [
  { key: 'rent', label: 'health.household.rent' },
  { key: 'own', label: 'health.household.own' },
];

interface HouseholdPeopleFieldsProps {
  adults: number;
  childCount: number;
  housingType: HousingType;
  onAdultsChange: (next: number) => void;
  onChildrenChange: (next: number) => void;
  onHousingTypeChange: (next: HousingType) => void;
}

/** Adults, children and rent / own: shared by the household sheet and the profile questionnaire. */
export function HouseholdPeopleFields({
  adults,
  childCount,
  housingType,
  onAdultsChange,
  onChildrenChange,
  onHousingTypeChange,
}: HouseholdPeopleFieldsProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const stepper = (label: string, value: number, min: number, onChange: (next: number) => void) => (
    <View style={styles.stepperRow}>
      <SelectableText style={[styles.label, { color: colors.text }]}>{label}</SelectableText>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepBtn, { backgroundColor: colors.surface }, value <= min && styles.disabled]}
          disabled={value <= min}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onChange(value - 1);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${label} −`}
        >
          <Ionicons name="remove" size={18} color={colors.text} />
        </TouchableOpacity>
        <SelectableText style={[styles.stepValue, { color: colors.text }]} accessibilityLabel={`${label}: ${value}`}>
          {value}
        </SelectableText>
        <TouchableOpacity
          style={[styles.stepBtn, { backgroundColor: colors.surface }, value >= MAX_PEOPLE && styles.disabled]}
          disabled={value >= MAX_PEOPLE}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onChange(value + 1);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${label} +`}
        >
          <Ionicons name="add" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      {stepper(t('health.household.adults'), adults, 1, onAdultsChange)}
      {stepper(t('health.household.children'), childCount, 0, onChildrenChange)}

      <View style={styles.stepperRow}>
        <SelectableText style={[styles.label, { color: colors.text }]}>{t('health.household.housing')}</SelectableText>
        <View style={[styles.segment, { backgroundColor: colors.track }]}>
          {HOUSING_OPTIONS.map((option) => {
            const selected = option.key === housingType;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.segmentItem, selected && { backgroundColor: colors.raised }]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onHousingTypeChange(option.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textSecondary }]} numberOfLines={1}>
                  {t(option.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

interface HouseholdMoneyFieldsProps {
  incomeText: string;
  savingsText: string;
  onIncomeChange: (text: string) => void;
  onSavingsChange: (text: string) => void;
  /** Income found in the statements, shown under the income field; null when none was found. */
  detectedIncome: number | null;
  currencySymbol: string;
  /** Shown under the income field while nothing is detected. */
  noIncomeHint?: TranslationKey;
}

/** Net monthly income and savings buffer: shared by the household sheet and the profile questionnaire. */
export function HouseholdMoneyFields({
  incomeText,
  savingsText,
  onIncomeChange,
  onSavingsChange,
  detectedIncome,
  currencySymbol,
  noIncomeHint = 'health.household.incomeNone',
}: HouseholdMoneyFieldsProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();

  const incomeInvalid = Number.isNaN(parseOptionalAmount(incomeText) ?? 0);
  const savingsInvalid = Number.isNaN(parseOptionalAmount(savingsText) ?? 0);
  const inputStyle = [styles.input, { backgroundColor: colors.field, color: colors.text, borderColor: colors.border }];

  return (
    <>
      <SelectableText style={[styles.fieldLabel, { color: colors.text }]}>{t('health.household.income')}</SelectableText>
      <TextInput
        style={[inputStyle, incomeInvalid && styles.inputError]}
        value={incomeText}
        onChangeText={onIncomeChange}
        keyboardType="decimal-pad"
        placeholder={detectedIncome !== null ? String(Math.round(detectedIncome)) : currencySymbol.trim()}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={t('health.household.income')}
      />
      <SelectableText style={[styles.hint, { color: incomeInvalid ? '#FF3B30' : colors.textSecondary }]}>
        {incomeInvalid
          ? t('health.household.invalid')
          : detectedIncome !== null
            ? t('health.household.incomeDetected', {
                amount: format.money(Math.round(detectedIncome), currencySymbol),
              })
            : t(noIncomeHint)}
      </SelectableText>

      <SelectableText style={[styles.fieldLabel, { color: colors.text }]}>{t('health.household.savings')}</SelectableText>
      <TextInput
        style={[inputStyle, savingsInvalid && styles.inputError]}
        value={savingsText}
        onChangeText={onSavingsChange}
        keyboardType="decimal-pad"
        placeholder={currencySymbol.trim()}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={t('health.household.savings')}
      />
      <SelectableText style={[styles.hint, { color: savingsInvalid ? '#FF3B30' : colors.textSecondary }]}>
        {savingsInvalid ? t('health.household.invalid') : t('health.household.savingsHint')}
      </SelectableText>
    </>
  );
}

const styles = StyleSheet.create({
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    gap: 12,
  },
  label: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  stepValue: { minWidth: 32, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segmentItem: { minHeight: 40, minWidth: 76, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  fieldLabel: { fontSize: 15, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 17,
    fontWeight: '600',
  },
  inputError: { borderColor: '#FF3B30', borderWidth: 1 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 6 },
});
