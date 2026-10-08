import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { type FreedomPlan } from '@/db/database';
import type { Message, TranslationKey } from '@/i18n';
import { parseNumber } from '@/utils/debt';
import { MAX_YEARS, MIN_YEARS, type GoalType } from '@/utils/freedom';
import React from 'react';
import { InputAccessoryView, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export type FreedomFieldKey = keyof FreedomPlan;

/** Keys edited as text; `goalType` is a choice and travels through the draft as it is. */
type NumericFieldKey = Exclude<FreedomFieldKey, 'goalType'>;

/** Field text as typed. Percent fields hold percents ("9"), the plan holds decimals (0.09). */
export type FreedomDraft = Record<NumericFieldKey, string> & { goalType: GoalType };

export type FreedomErrors = Partial<Record<FreedomFieldKey, Message>>;

export const MAX_RETURN_PCT = 30;
export const MAX_INFLATION_PCT = 30;

const ERROR_COLOR = '#FF3B30';

// The iOS number pads have no return key; every field shares this "Done" bar.
const ACCESSORY_ID = 'freedom-keyboard-accessory';

/** Rendered once by the screen, next to the scroll view. */
export function FreedomKeyboardAccessory() {
  const { colors } = useTheme();
  const { t } = useI18n();
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={ACCESSORY_ID}>
      <View style={[styles.accessory, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          style={styles.accessoryBtn}
          accessibilityRole="button"
          accessibilityLabel={t('freedom.keyboardDone')}
        >
          <Text style={[styles.accessoryText, { color: colors.accent }]}>{t('common.done')}</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

type FieldConfig = {
  key: NumericFieldKey;
  label: TranslationKey;
  helper: TranslationKey;
  kind: 'YEARS' | 'AMOUNT' | 'PERCENT';
  /** Highest percent accepted; unlimited when missing. */
  max?: number;
};

/** The three questions every plan starts with. */
const BASIC_FIELDS: FieldConfig[] = [
  { key: 'monthly', label: 'freedom.field.monthly', helper: 'freedom.field.monthlyHelp', kind: 'AMOUNT' },
  { key: 'years', label: 'freedom.field.years', helper: 'freedom.field.yearsHelp', kind: 'YEARS' },
  { key: 'lumpSum', label: 'freedom.field.lumpSum', helper: 'freedom.field.lumpSumHelp', kind: 'AMOUNT' },
];

/** Behind "More options"; the defaults work without touching them. */
const ADVANCED_FIELDS: FieldConfig[] = [
  {
    key: 'returnPct',
    label: 'freedom.field.returnPct',
    helper: 'freedom.field.returnPctHelp',
    kind: 'PERCENT',
    max: MAX_RETURN_PCT,
  },
  {
    key: 'annualIncreasePct',
    label: 'freedom.field.annualIncreasePct',
    helper: 'freedom.field.annualIncreasePctHelp',
    kind: 'PERCENT',
  },
  { key: 'feePct', label: 'freedom.field.feePct', helper: 'freedom.field.feePctHelp', kind: 'PERCENT' },
  {
    key: 'inflationPct',
    label: 'freedom.field.inflationPct',
    helper: 'freedom.field.inflationPctHelp',
    kind: 'PERCENT',
    max: MAX_INFLATION_PCT,
  },
];

const FIELD_SETS = { BASIC: BASIC_FIELDS, ADVANCED: ADVANCED_FIELDS };

export type FreedomFieldSet = keyof typeof FIELD_SETS;

export const ADVANCED_FIELD_KEYS: FreedomFieldKey[] = ADVANCED_FIELDS.map((field) => field.key);

/** Rendered by the Goal section, one at a time (the one of the selected goal type). */
export const GOAL_FIELDS: Record<GoalType, FieldConfig> = {
  BALANCE: {
    key: 'goalBalance',
    label: 'freedom.field.goalBalance',
    helper: 'freedom.field.goalBalanceHelp',
    kind: 'AMOUNT',
  },
  INCOME: {
    key: 'goalIncome',
    label: 'freedom.field.goalIncome',
    helper: 'freedom.field.goalIncomeHelp',
    kind: 'AMOUNT',
  },
};

const ALL_FIELDS: FieldConfig[] = [...BASIC_FIELDS, ...ADVANCED_FIELDS, GOAL_FIELDS.BALANCE, GOAL_FIELDS.INCOME];

// Trims float noise such as 0.09 * 100 = 9.000000000000002.
const tidy = (value: number, decimals: number): string => String(Number(value.toFixed(decimals)));

export const planToDraft = (plan: FreedomPlan): FreedomDraft => ({
  years: String(plan.years),
  lumpSum: tidy(plan.lumpSum, 2),
  monthly: tidy(plan.monthly, 2),
  annualIncreasePct: tidy(plan.annualIncreasePct * 100, 4),
  returnPct: tidy(plan.returnPct * 100, 4),
  feePct: tidy(plan.feePct * 100, 4),
  inflationPct: tidy(plan.inflationPct * 100, 4),
  goalType: plan.goalType,
  goalBalance: tidy(plan.goalBalance, 2),
  goalIncome: tidy(plan.goalIncome, 2),
});

const validate = (field: FieldConfig, text: string): { value: number; error: Message | null } => {
  const value = text.trim() === '' ? NaN : parseNumber(text);

  if (field.kind === 'YEARS') {
    const valid = Number.isInteger(value) && value >= MIN_YEARS && value <= MAX_YEARS;
    return {
      value,
      error: valid ? null : { key: 'freedom.error.years', params: { min: MIN_YEARS, max: MAX_YEARS } },
    };
  }

  if (!Number.isFinite(value)) {
    return { value, error: { key: field.kind === 'AMOUNT' ? 'freedom.error.amount' : 'freedom.error.percent' } };
  }
  if (value < 0) return { value, error: { key: 'freedom.error.negative' } };
  if (field.max !== undefined && value > field.max) {
    return { value, error: { key: 'freedom.error.max', params: { max: field.max } } };
  }
  return { value, error: null };
};

/** `input` is null while any field is invalid. */
export const parseDraft = (draft: FreedomDraft): { input: FreedomPlan | null; errors: FreedomErrors } => {
  const errors: FreedomErrors = {};
  const values = { goalType: draft.goalType } as FreedomPlan;

  for (const field of ALL_FIELDS) {
    const { value, error } = validate(field, draft[field.key]);
    if (error) errors[field.key] = error;
    values[field.key] = field.kind === 'PERCENT' ? value / 100 : value;
  }

  return { input: Object.keys(errors).length === 0 ? values : null, errors };
};

interface FreedomFieldProps {
  field: FieldConfig;
  value: string;
  error?: Message;
  onChange: (key: FreedomFieldKey, text: string) => void;
  currencySymbol: string;
}

export function FreedomField({ field, value, error, onChange, currencySymbol }: FreedomFieldProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const prefix = field.kind === 'AMOUNT' ? currencySymbol : null;
  const suffix = field.kind === 'YEARS' ? t('freedom.unit.years') : field.kind === 'PERCENT' ? '%' : null;
  const unit =
    field.kind === 'AMOUNT' ? currencySymbol : field.kind === 'PERCENT' ? t('freedom.unit.percent') : t('freedom.unit.years');
  const label = t(field.label);
  const hint = error ? t(error.key, error.params) : t(field.helper);

  return (
    <View>
      <SelectableText style={[styles.label, { color: colors.textSecondary }]}>{label}</SelectableText>
      <View
        style={[styles.inputWrap, { backgroundColor: colors.field, borderColor: error ? ERROR_COLOR : colors.border }]}
      >
        {prefix ? <SelectableText style={[styles.affix, { color: colors.textSecondary }]}>{prefix}</SelectableText> : null}
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={(text) => onChange(field.key, text)}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          keyboardType={field.kind === 'YEARS' ? 'number-pad' : 'decimal-pad'}
          maxLength={field.kind === 'YEARS' ? 2 : 12}
          selectTextOnFocus
          autoCorrect={false}
          returnKeyType="done"
          inputAccessoryViewID={Platform.OS === 'ios' ? ACCESSORY_ID : undefined}
          accessibilityLabel={unit ? t('freedom.field.a11y', { label, unit }) : label}
          accessibilityHint={hint}
        />
        {suffix ? <SelectableText style={[styles.affix, { color: colors.textSecondary }]}>{suffix}</SelectableText> : null}
      </View>
      <SelectableText
        style={[styles.helper, { color: error ? ERROR_COLOR : colors.textSecondary }]}
        numberOfLines={2}
        accessibilityLiveRegion={error ? 'polite' : 'none'}
      >
        {hint}
      </SelectableText>
    </View>
  );
}

interface FreedomInputsProps {
  fields: FreedomFieldSet;
  draft: FreedomDraft;
  errors: FreedomErrors;
  onChange: (key: FreedomFieldKey, text: string) => void;
  currencySymbol: string;
}

export function FreedomInputs({ fields, draft, errors, onChange, currencySymbol }: FreedomInputsProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {FIELD_SETS[fields].map((field) => (
        <FreedomField
          key={field.key}
          field={field}
          value={draft[field.key]}
          error={errors[field.key]}
          onChange={onChange}
          currencySymbol={currencySymbol}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 18, borderWidth: StyleSheet.hairlineWidth, gap: 16 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 46,
    gap: 6,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  affix: { fontSize: 16, fontWeight: '600' },
  helper: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  accessory: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth },
  accessoryBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  accessoryText: { fontSize: 16, fontWeight: '600' },
});
