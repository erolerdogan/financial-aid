import { DateRangeModal } from '@/components/modals/DateRangeModal';
import { ReadOnlySheetHost } from '@/components/pro/ReadOnlySheet';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SelectableText } from '@/components/SelectableText';
import { getCategoryColor } from '@/constants/colors';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  type CategoryRule,
  getCategoriesWithStats,
  getCustomRules,
  getLearnedCategories,
  insertManualTransaction,
} from '@/db/database';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import type { TranslationKey } from '@/i18n';
import { runHealthAlerts } from '@/services/healthService';
import {
  buildManualEntry,
  dateKey,
  isManualEntryType,
  type ManualEntryError,
  type ManualEntryType,
  parseAmountInput,
  signedAmount,
} from '@/utils/manualEntry';
import { classifyTransaction, INCOME_CATEGORY, type LearnedCategories, UNCATEGORISED } from '@/utils/parser';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const TYPES: { key: ManualEntryType; label: TranslationKey }[] = [
  { key: 'expense', label: 'manual.typeExpense' },
  { key: 'income', label: 'manual.typeIncome' },
];

const ERROR_KEYS: Record<ManualEntryError, TranslationKey> = {
  amount: 'manual.errorAmount',
  description: 'manual.errorDescription',
  date: 'manual.errorDate',
};

/** A transaction typed in by hand, opened from the add button of the tab bar with `type` preselected. */
export default function AddTransactionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, format, categoryName } = useI18n();
  const { activeProfile, currencySymbol, currencyDecimals, refreshProfiles, isDemoMode } = useProfile();
  const { can } = useEntitlement();
  const { guardWrite } = useProfileAccess();
  const profileId = activeProfile?.id ?? 1;
  const params = useLocalSearchParams<{ type?: string }>();

  const [type, setType] = useState<ManualEntryType>(isManualEntryType(params.type) ? params.type : 'expense');
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [today] = useState(() => dateKey(new Date()));
  const [date, setDate] = useState(today);
  // Null until a chip is tapped: until then the category follows the description.
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [learned, setLearned] = useState<LearnedCategories | undefined>(undefined);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [error, setError] = useState<ManualEntryError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCategoriesWithStats(db, profileId), getCustomRules(db, profileId), getLearnedCategories(db, profileId)])
      .then(([categories, customRules, learnedCategories]) => {
        if (cancelled) return;
        setCategoryNames(categories.map((category) => category.name));
        setRules(customRules);
        setLearned(learnedCategories);
      })
      .catch((loadError) => console.warn('Failed to load categories:', loadError));
    return () => {
      cancelled = true;
    };
  }, [db, profileId]);

  // The same classifier an imported row goes through: the user's rules, what they chose before, the keywords.
  const typedAmount = parseAmountInput(amountText, currencyDecimals);
  const suggested = classifyTransaction({ merchant: description, rawDescription: description }, rules, {
    amount: signedAmount(type, typedAmount ?? 1),
    learned,
  });
  const category = pickedCategory ?? suggested;
  const fallback = type === 'income' ? INCOME_CATEGORY : UNCATEGORISED;
  const options = Array.from(new Set([fallback, ...categoryNames, category]));

  const handleType = (next: ManualEntryType) => {
    if (next === type) return;
    Haptics.selectionAsync().catch(() => {});
    setType(next);
    setPickedCategory(null);
  };

  const handleSave = async () => {
    if (saving || isDemoMode) return;
    // A profile beyond the free limit takes no new transactions.
    if (!guardWrite()) return;

    const entry = buildManualEntry({ type, amountText, description, date }, currencyDecimals, today);
    if (!entry.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setError(entry.error);
      return;
    }

    setSaving(true);
    try {
      const result = await insertManualTransaction(db, profileId, { ...entry, category });
      if (result === 'duplicate') {
        Alert.alert(t('manual.duplicateTitle'), t('manual.duplicateMessage'));
        return;
      }
      try {
        // Budget Health and its alerts are a Pro feature.
        if (can('budgetHealth')) await runHealthAlerts(db, profileId);
      } catch (alertError) {
        console.error('Failed to run health alerts after a manual entry:', alertError);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await refreshProfiles();
      router.back();
    } catch (saveError) {
      console.error('Failed to save the transaction:', saveError);
      Alert.alert(t('common.error'), t('manual.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = [styles.field, { backgroundColor: colors.field, borderColor: colors.border }];

  return (
    <ScreenContainer showDemoBanner={false}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SelectableText
          style={[styles.headerTitle, { color: colors.text }]}
          maxFontSizeMultiplier={1.4}
          accessibilityRole="header"
        >
          {t(type === 'income' ? 'manual.titleIncome' : 'manual.titleExpense')}
        </SelectableText>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.segmented, { backgroundColor: colors.track }]} accessibilityRole="tablist">
          {TYPES.map(({ key, label }) => {
            const active = type === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.segment, active && { backgroundColor: colors.raised }]}
                onPress={() => handleType(key)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, { color: active ? colors.text : colors.textSecondary }]} numberOfLines={1}>
                  {t(label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <SelectableText style={[styles.label, { color: colors.textSecondary }]}>{t('manual.amount')}</SelectableText>
        <View style={[fieldStyle, styles.amountField, error === 'amount' && styles.fieldError]}>
          <Text style={[styles.symbol, { color: colors.textSecondary }]}>{currencySymbol.trim()}</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.text }]}
            value={amountText}
            onChangeText={(text) => {
              setAmountText(text);
              if (error === 'amount') setError(null);
            }}
            placeholder={format.number(0, { minimumFractionDigits: currencyDecimals, maximumFractionDigits: currencyDecimals })}
            placeholderTextColor={colors.textSecondary}
            keyboardType={currencyDecimals === 0 ? 'number-pad' : 'decimal-pad'}
            autoFocus
            accessibilityLabel={t('manual.amount')}
          />
        </View>

        <SelectableText style={[styles.label, { color: colors.textSecondary }]}>{t('manual.description')}</SelectableText>
        <TextInput
          style={[fieldStyle, styles.textInput, { color: colors.text }, error === 'description' && styles.fieldError]}
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            if (error === 'description') setError(null);
          }}
          placeholder={t('manual.descriptionPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          maxLength={120}
          returnKeyType="done"
          accessibilityLabel={t('manual.description')}
        />

        <SelectableText style={[styles.label, { color: colors.textSecondary }]}>{t('manual.date')}</SelectableText>
        <TouchableOpacity
          style={[fieldStyle, styles.dateField, error === 'date' && styles.fieldError]}
          onPress={() => setCalendarVisible(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${t('manual.date')}: ${format.day(date)}`}
        >
          <Text style={[styles.dateText, { color: colors.text }]}>{format.day(date)}</Text>
          <Ionicons name="calendar-outline" size={18} color={colors.accent} />
        </TouchableOpacity>

        <SelectableText style={[styles.label, { color: colors.textSecondary }]}>{t('manual.category')}</SelectableText>
        <View style={styles.chips}>
          {options.map((name) => {
            const selected = name === category;
            const color = getCategoryColor(name);
            return (
              <TouchableOpacity
                key={name}
                style={[
                  styles.chip,
                  { backgroundColor: selected ? color + '20' : colors.card, borderColor: selected ? color : colors.border },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setPickedCategory(name);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={[styles.chipText, { color: colors.text }, selected && styles.chipTextSelected]}>
                  {categoryName(name)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error && (
          <SelectableText style={styles.errorText} accessibilityLiveRegion="polite">
            {t(ERROR_KEYS[error])}
          </SelectableText>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.accent }, (saving || isDemoMode) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || isDemoMode}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || isDemoMode }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>
              {t(type === 'income' ? 'add.income' : 'add.expense')}
            </Text>
          )}
        </TouchableOpacity>

        <SelectableText style={[styles.note, { color: colors.textSecondary }]}>
          {t(isDemoMode ? 'add.demoNote' : 'manual.note')}
        </SelectableText>
      </ScrollView>

      <DateRangeModal
        single
        visible={calendarVisible}
        minDate={null}
        maxDate={today}
        initialFrom={date}
        initialTo={date}
        onApply={(picked) => {
          setDate(picked);
          if (error === 'date') setError(null);
          setCalendarVisible(false);
        }}
        onClose={() => setCalendarVisible(false)}
      />
      <ReadOnlySheetHost />
    </ScreenContainer>
  );
}

// The system red the app uses for errors in both modes.
const DANGER = '#FF3B30';

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segment: { flex: 1, minHeight: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentText: { fontSize: 14, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', marginTop: 20, marginBottom: 8, marginLeft: 4 },
  field: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, minHeight: 48 },
  fieldError: { borderColor: DANGER, borderWidth: 1 },
  amountField: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol: { fontSize: 22, fontWeight: '600' },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', paddingVertical: 10 },
  textInput: { fontSize: 16, paddingVertical: 12 },
  dateField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dateText: { fontSize: 16, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipTextSelected: { fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  errorText: { color: DANGER, fontSize: 13, marginTop: 16, marginLeft: 4 },
  saveBtn: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24, paddingHorizontal: 16 },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 16, marginTop: 12, marginHorizontal: 4, textAlign: 'center' },
});
