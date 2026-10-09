import { HouseholdMoneyFields, HouseholdPeopleFields } from '@/components/health/HouseholdFields';
import { SelectableText } from '@/components/SelectableText';
import { DEFAULT_HOUSEHOLD, type Household, type HousingType } from '@/constants/benchmarks';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { parseOptionalAmount } from '@/utils/profileSetup';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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
  const { t } = useI18n();
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

  const income = parseOptionalAmount(incomeText);
  const savings = parseOptionalAmount(savingsText);
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} accessible={false} onPress={onClose}>
        <TouchableWithoutFeedback accessible={false}>
          <View
            style={[styles.sheet, { backgroundColor: colors.card }]}
            onAccessibilityEscape={onClose}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <SelectableText style={[styles.title, { color: colors.text }]}>{t('health.household.title')}</SelectableText>
              <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>{t('health.household.subtitle')}</SelectableText>

              <HouseholdPeopleFields
                adults={adults}
                childCount={children}
                housingType={housingType}
                onAdultsChange={setAdults}
                onChildrenChange={setChildren}
                onHousingTypeChange={setHousingType}
              />
              <HouseholdMoneyFields
                incomeText={incomeText}
                savingsText={savingsText}
                onIncomeChange={setIncomeText}
                onSavingsChange={setSavingsText}
                detectedIncome={detectedIncome}
                currencySymbol={currencySymbol}
              />

              <View style={styles.actions}>
                <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.track }]} onPress={onClose} accessibilityRole="button">
                  <Text style={[styles.cancelText, { color: colors.text }]}>{t('common.notNow')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.accent }, saving && styles.disabled]}
                  onPress={handleSave}
                  disabled={saving}
                  accessibilityRole="button"
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
  disabled: { opacity: 0.4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
