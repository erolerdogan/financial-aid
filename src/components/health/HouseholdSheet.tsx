import { DEFAULT_HOUSEHOLD, type Household, type HousingType } from '@/constants/benchmarks';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import { parseNumber } from '@/utils/debt';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface HouseholdSheetProps {
  visible: boolean;
  /** Saved answers; null on the first visit. */
  household: Household | null;
  /** Income found in the statements, shown under the income field; null when none was found. */
  detectedIncome: number | null;
  onSave: (household: Household) => void | Promise<void>;
  onClose: () => void;
}

const MAX_PEOPLE = 12;

const HOUSING_OPTIONS: { key: HousingType; label: TranslationKey }[] = [
  { key: 'rent', label: 'health.household.rent' },
  { key: 'own', label: 'health.household.own' },
];

/** Empty = not given; otherwise a number of 0 or more, or NaN when it cannot be read. */
const parseOptional = (text: string): number | null => {
  if (text.trim() === '') return null;
  const value = parseNumber(text);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
};

export function HouseholdSheet({ visible, household, detectedIncome, onSave, onClose }: HouseholdSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Mounted per opening, so the fields always start from the saved answers. */}
      {visible ? (
        <HouseholdForm household={household} detectedIncome={detectedIncome} onSave={onSave} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

function HouseholdForm({ household, detectedIncome, onSave, onClose }: Omit<HouseholdSheetProps, 'visible'>) {
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { currencySymbol } = useProfile();

  const initial = household ?? DEFAULT_HOUSEHOLD;
  const [adults, setAdults] = useState(initial.adults);
  const [children, setChildren] = useState(initial.children);
  const [housingType, setHousingType] = useState<HousingType>(initial.housingType);
  const [incomeText, setIncomeText] = useState(
    initial.netIncomeOverride !== null ? String(initial.netIncomeOverride) : ''
  );
  const [savingsText, setSavingsText] = useState(initial.safetySavings !== null ? String(initial.safetySavings) : '');
  const [saving, setSaving] = useState(false);

  const income = parseOptional(incomeText);
  const savings = parseOptional(savingsText);
  const incomeInvalid = income !== null && Number.isNaN(income);
  const savingsInvalid = savings !== null && Number.isNaN(savings);

  const handleSave = async () => {
    if (incomeInvalid || savingsInvalid || saving) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    setSaving(true);
    try {
      await onSave({
        adults,
        children,
        housingType,
        // 0 means "not given": the detected income is used.
        netIncomeOverride: income !== null && income > 0 ? income : null,
        safetySavings: savings,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const stepper = (label: string, value: number, min: number, onChange: (next: number) => void) => (
    <View style={styles.stepperRow}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
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
        <Text style={[styles.stepValue, { color: colors.text }]} accessibilityLabel={`${label}: ${value}`}>
          {value}
        </Text>
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

  const inputStyle = [styles.input, { backgroundColor: colors.field, color: colors.text, borderColor: colors.border }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.title, { color: colors.text }]}>{t('health.household.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('health.household.subtitle')}</Text>

              {stepper(t('health.household.adults'), adults, 1, setAdults)}
              {stepper(t('health.household.children'), children, 0, setChildren)}

              <View style={styles.stepperRow}>
                <Text style={[styles.label, { color: colors.text }]}>{t('health.household.housing')}</Text>
                <View style={[styles.segment, { backgroundColor: colors.track }]}>
                  {HOUSING_OPTIONS.map((option) => {
                    const selected = option.key === housingType;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.segmentItem, selected && { backgroundColor: colors.raised }]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setHousingType(option.key);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[styles.segmentText, { color: selected ? colors.text : colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {t(option.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.text }]}>{t('health.household.income')}</Text>
              <TextInput
                style={[inputStyle, incomeInvalid && styles.inputError]}
                value={incomeText}
                onChangeText={setIncomeText}
                keyboardType="decimal-pad"
                placeholder={detectedIncome !== null ? String(Math.round(detectedIncome)) : currencySymbol.trim()}
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel={t('health.household.income')}
              />
              <Text style={[styles.hint, { color: incomeInvalid ? '#FF3B30' : colors.textSecondary }]}>
                {incomeInvalid
                  ? t('health.household.invalid')
                  : detectedIncome !== null
                    ? t('health.household.incomeDetected', {
                        amount: format.money(Math.round(detectedIncome), currencySymbol),
                      })
                    : t('health.household.incomeNone')}
              </Text>

              <Text style={[styles.fieldLabel, { color: colors.text }]}>{t('health.household.savings')}</Text>
              <TextInput
                style={[inputStyle, savingsInvalid && styles.inputError]}
                value={savingsText}
                onChangeText={setSavingsText}
                keyboardType="decimal-pad"
                placeholder={currencySymbol.trim()}
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel={t('health.household.savings')}
              />
              <Text style={[styles.hint, { color: savingsInvalid ? '#FF3B30' : colors.textSecondary }]}>
                {savingsInvalid ? t('health.household.invalid') : t('health.household.savingsHint')}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.track }]} onPress={onClose}>
                  <Text style={[styles.cancelText, { color: colors.text }]}>{t('common.notNow')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.accent }, saving && styles.disabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 12 },
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
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
