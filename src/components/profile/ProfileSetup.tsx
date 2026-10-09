import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import { HouseholdMoneyFields, HouseholdPeopleFields } from '@/components/health/HouseholdFields';
import { PasscodeModal } from '@/components/modals/PasscodeModal';
import { SelectableText } from '@/components/SelectableText';
import { ThemeSwatches } from '@/components/ThemeSwatches';
import { DEFAULT_HOUSEHOLD, type HousingType } from '@/constants/benchmarks';
import { currencyInfo } from '@/constants/currencies';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { usePasscode } from '@/contexts/PasscodeContext';
import { THEMES, useTheme } from '@/contexts/ThemeContext';
import { usePaywall } from '@/hooks/usePaywall';
import type { TranslationKey } from '@/i18n';
import { isThemeLocked } from '@/utils/entitlement';
import { AVATAR_COLORS, parseOptionalAmount, setupSteps, type SetupAnswers, type SetupStep } from '@/utils/profileSetup';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ProfileSetupProps {
  initialName: string;
  initialColor: string;
  initialCurrency: string;
  /** The profile step cannot be skipped and needs a name (a profile that does not exist yet). */
  nameRequired?: boolean;
  /** Also asks the app-wide settings, theme and passcode lock (first launch only). */
  appSteps?: boolean;
  /** Label of the button on the last step. */
  submitLabel: string;
  /** Takes the whole height of its parent (a screen) instead of its content's (a sheet). */
  fill?: boolean;
  /** Steps the host shows after these, counted in the progress dots. */
  extraSteps?: number;
  /** A later step of the host is in front: the hardware back button is left to it. */
  paused?: boolean;
  onSubmit: (answers: SetupAnswers) => void | Promise<void>;
  onCancel: () => void;
}

/** The progress dots at the top of a step; `current` starts at 1. */
export function SetupProgress({ current, total }: { current: number; total: number }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.dots} accessible accessibilityLabel={t('setup.progress', { current, total })}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.dot, { backgroundColor: index < current ? colors.accent : colors.track }]} />
      ))}
    </View>
  );
}

const STEP_TEXT: Record<SetupStep, { title: TranslationKey; subtitle: TranslationKey }> = {
  profile: { title: 'setup.profile.title', subtitle: 'setup.profile.subtitle' },
  household: { title: 'health.household.title', subtitle: 'health.household.subtitle' },
  money: { title: 'setup.money.title', subtitle: 'setup.money.subtitle' },
  appearance: { title: 'setup.appearance.title', subtitle: 'setup.appearance.subtitle' },
  security: { title: 'setup.security.title', subtitle: 'setup.security.subtitle' },
};

/**
 * The questions asked once per profile: name, colour, currency, household, income and savings buffer.
 * With `appSteps` the theme and the passcode lock follow; both are saved as they are picked, not by `onSubmit`.
 */
export function ProfileSetup({
  initialName,
  initialColor,
  initialCurrency,
  nameRequired = false,
  appSteps = false,
  submitLabel,
  fill = false,
  extraSteps = 0,
  paused = false,
  onSubmit,
  onCancel,
}: ProfileSetupProps) {
  const { colors, isDark, toggleTheme, themeName, setThemeName, previewThemeName, setPreviewTheme } = useTheme();
  const { t, currencyName } = useI18n();
  const { isPro } = useEntitlement();
  const { openPaywall } = usePaywall();
  const { enabled: passcodeEnabled } = usePasscode();

  const steps = setupSteps(appSteps);
  // What was active when the questions opened: skipping the appearance step or closing the questions goes back to it.
  const [initialLook] = useState({ themeName, isDark });
  const [passcodeVisible, setPasscodeVisible] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [skipped, setSkipped] = useState<ReadonlySet<SetupStep>>(new Set());
  const [name, setName] = useState(nameRequired ? initialName : '');
  const [color, setColor] = useState(initialColor);
  const [currency, setCurrency] = useState(initialCurrency);
  const [adults, setAdults] = useState(DEFAULT_HOUSEHOLD.adults);
  const [children, setChildren] = useState(DEFAULT_HOUSEHOLD.children);
  const [housingType, setHousingType] = useState<HousingType>(DEFAULT_HOUSEHOLD.housingType);
  const [incomeText, setIncomeText] = useState('');
  const [savingsText, setSavingsText] = useState('');
  const [saving, setSaving] = useState(false);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  // A passcode that is set leaves nothing to skip.
  const canSkip = !(step === 'profile' && nameRequired) && !(step === 'security' && passcodeEnabled);
  const passcodeMissing = step === 'security' && !passcodeEnabled;
  // A Pro theme can be tried out, but the step is only left with it once Pro is active.
  const themeNeedsPro =
    step === 'appearance' && previewThemeName !== null && isThemeLocked(isPro, previewThemeName);
  const nameMissing = nameRequired && name.trim() === '';
  const moneyInvalid =
    Number.isNaN(parseOptionalAmount(incomeText) ?? 0) || Number.isNaN(parseOptionalAmount(savingsText) ?? 0);
  const stepInvalid = (step === 'profile' && nameMissing) || (step === 'money' && moneyInvalid);
  // The amounts are typed in the currency picked on the first step, unless that step was skipped.
  const shownCurrency = skipped.has('profile') ? initialCurrency : currency;
  const currencySymbol = currencyInfo(shownCurrency).symbol;

  const finish = async (skippedSteps: ReadonlySet<SetupStep>) => {
    if (saving) return;
    const profileSkipped = skippedSteps.has('profile');
    const answers: SetupAnswers = {
      name: profileSkipped || name.trim() === '' ? initialName : name.trim(),
      color: profileSkipped ? initialColor : color,
      currency: profileSkipped ? initialCurrency : currency,
    };
    if (!skippedSteps.has('household')) {
      answers.adults = adults;
      answers.children = children;
      answers.housingType = housingType;
    }
    if (!skippedSteps.has('money')) {
      answers.incomeText = incomeText;
      answers.savingsText = savingsText;
    }
    setSaving(true);
    try {
      await onSubmit(answers);
    } finally {
      setSaving(false);
    }
  };

  // A preview never outlives the questions.
  useEffect(() => () => setPreviewTheme(null), [setPreviewTheme]);

  const restoreLook = () => {
    setPreviewTheme(null);
    if (themeName !== initialLook.themeName) setThemeName(initialLook.themeName);
    if (isDark !== initialLook.isDark) toggleTheme();
  };

  const advance = (skipStep: boolean) => {
    if (!skipStep && passcodeMissing) {
      Haptics.selectionAsync().catch(() => {});
      setPasscodeVisible(true);
      return;
    }
    if (!skipStep && themeNeedsPro) {
      openPaywall('themes');
      return;
    }
    if (!skipStep && stepInvalid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    const next = new Set(skipped);
    if (skipStep) next.add(step);
    else next.delete(step);
    if (skipStep && step === 'appearance') restoreLook();
    else if (step === 'appearance' && previewThemeName !== null) {
      // Pro was bought while the theme was tried out: now it is saved.
      setThemeName(previewThemeName);
      setPreviewTheme(null);
    }
    setSkipped(next);
    if (isLast) finish(next);
    else setStepIndex(stepIndex + 1);
  };

  const handleBack = () => {
    Haptics.selectionAsync().catch(() => {});
    if (stepIndex === 0) {
      restoreLook();
      onCancel();
    } else setStepIndex(stepIndex - 1);
  };

  // Android back goes one step back, like the button at the top. Inside a `Modal` (the profile sheet) it never fires.
  const backRef = useRef(handleBack);
  useEffect(() => {
    backRef.current = handleBack;
  });
  useEffect(() => {
    if (paused) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!saving) backRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [paused, saving]);

  const inputStyle = [styles.input, { backgroundColor: colors.field, color: colors.text, borderColor: colors.border }];

  return (
    <View style={fill && styles.fill}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.topBtn}
          onPress={handleBack}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={stepIndex === 0 ? t('common.close') : t('common.back')}
        >
          <Ionicons name={stepIndex === 0 ? 'close' : 'chevron-back'} size={24} color={colors.text} />
        </TouchableOpacity>

        <SetupProgress current={stepIndex + 1} total={steps.length + extraSteps} />

        {canSkip ? (
          <TouchableOpacity
            style={[styles.topBtn, styles.skipBtn]}
            onPress={() => advance(true)}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={[styles.skipText, { color: colors.accent }]} numberOfLines={1}>
              {t('welcome.intro.skip')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.topBtn} />
        )}
      </View>

      <ScrollView
        style={fill ? styles.fill : styles.sheetScroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {step === 'profile' && nameRequired ? t('profile.new') : t(STEP_TEXT[step].title)}
        </SelectableText>
        <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t(STEP_TEXT[step].subtitle)}
        </SelectableText>

        {step === 'profile' && (
          <>
            <TextInput
              style={inputStyle}
              value={name}
              onChangeText={setName}
              placeholder={nameRequired ? t('profile.namePlaceholder') : initialName}
              placeholderTextColor={colors.textSecondary}
              maxLength={40}
              returnKeyType="done"
              accessibilityLabel={t('profile.namePlaceholder')}
            />

            <SelectableText style={[styles.fieldLabel, { color: colors.text }]}>{t('profile.avatarColor')}</SelectableText>
            <View style={styles.colorRow}>
              {AVATAR_COLORS.map((item, index) => {
                const selected = item === color;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.colorRing, selected && { borderColor: colors.text }]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setColor(item);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11y.colorOption', { number: index + 1, total: AVATAR_COLORS.length })}
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.colorCircle, { backgroundColor: item }]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <SelectableText style={[styles.fieldLabel, { color: colors.text }]}>{t('settings.currency')}</SelectableText>
            <TouchableOpacity
              style={[styles.pickerRow, { backgroundColor: colors.field, borderColor: colors.border }]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setCurrencyPickerVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t('settings.currency')}: ${currencyName(currency)}, ${currency}`}
            >
              <Text style={[styles.pickerCode, { color: colors.text }]}>{currency}</Text>
              <Text style={[styles.pickerName, { color: colors.textSecondary }]} numberOfLines={1}>
                {currencyName(currency)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <CurrencyPickerSheet
              visible={currencyPickerVisible}
              selected={currency}
              onSelect={(code) => {
                setCurrency(code);
                setCurrencyPickerVisible(false);
              }}
              onClose={() => setCurrencyPickerVisible(false)}
            />
          </>
        )}

        {step === 'household' && (
          <HouseholdPeopleFields
            adults={adults}
            childCount={children}
            housingType={housingType}
            onAdultsChange={setAdults}
            onChildrenChange={setChildren}
            onHousingTypeChange={setHousingType}
          />
        )}

        {step === 'money' && (
          <HouseholdMoneyFields
            incomeText={incomeText}
            savingsText={savingsText}
            onIncomeChange={setIncomeText}
            onSavingsChange={setSavingsText}
            detectedIncome={null}
            currencySymbol={currencySymbol}
            noIncomeHint="setup.incomeHint"
          />
        )}

        {step === 'appearance' && (
          <>
            <ThemeSwatches wrap previewLocked />
            {themeNeedsPro && (
              <View style={[styles.note, styles.proNote, { backgroundColor: colors.surface }]}>
                <Ionicons name="lock-closed" size={18} color={colors.accent} />
                <SelectableText style={[styles.noteText, { color: colors.text }]}>
                  {t('setup.appearance.proNote', {
                    name: THEMES.find((theme) => theme.name === previewThemeName)?.label ?? '',
                  })}
                </SelectableText>
              </View>
            )}
            <View style={[styles.switchRow, { backgroundColor: colors.card }]}>
              <View style={styles.switchLeft}>
                <View style={[styles.switchIcon, { backgroundColor: colors.tintBackground }]}>
                  <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={colors.accent} />
                </View>
                <Text style={[styles.switchLabel, { color: colors.text }]}>{t('settings.darkMode')}</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.track, true: colors.accent }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.track}
              />
            </View>
          </>
        )}

        {step === 'security' && (
          <View style={[styles.note, { backgroundColor: colors.surface }]}>
            <Ionicons
              name={passcodeEnabled ? 'checkmark-circle' : 'information-circle-outline'}
              size={20}
              color={passcodeEnabled ? colors.accent : colors.textSecondary}
            />
            <SelectableText style={[styles.noteText, { color: colors.text }]}>
              {passcodeEnabled ? t('setup.security.on') : t('passcode.hint')}
            </SelectableText>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.accent }, (saving || stepInvalid) && styles.disabled]}
        onPress={() => advance(false)}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving || stepInvalid }}
      >
        <Text style={styles.primaryText}>
          {themeNeedsPro
            ? t('pro.seePro')
            : passcodeMissing
              ? t('setup.security.set')
              : isLast
                ? submitLabel
                : t('setup.next')}
        </Text>
      </TouchableOpacity>

      {appSteps && <PasscodeModal visible={passcodeVisible} mode="set" onClose={() => setPasscodeVisible(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheetScroll: { maxHeight: 400 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  topBtn: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  skipBtn: { alignItems: 'flex-end' },
  skipText: { fontSize: 15, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 22, height: 4, borderRadius: 2 },
  content: { paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 18 },
  fieldLabel: { fontSize: 15, fontWeight: '600', marginTop: 18, marginBottom: 8 },
  input: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 17,
    fontWeight: '600',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  colorRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircle: { width: 32, height: 32, borderRadius: 16 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  pickerCode: { fontSize: 17, fontWeight: '700' },
  pickerName: { flex: 1, fontSize: 15 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  // The same row as Dark Mode in Settings.
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 24,
  },
  switchLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  proNote: { marginTop: 20 },
  note: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 14 },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  primaryBtn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.4 },
});
