import { useTheme } from '@/contexts/ThemeContext';
import { type FreedomPlan } from '@/db/database';
import { parseNumber } from '@/utils/debt';
import { MAX_YEARS, MIN_YEARS, type GoalType } from '@/utils/freedom';
import React from 'react';
import { InputAccessoryView, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export type FreedomFieldKey = keyof FreedomPlan;

/** Keys edited as text; `goalType` is a choice and travels through the draft as it is. */
type NumericFieldKey = Exclude<FreedomFieldKey, 'goalType'>;

/** Field text as typed. Percent fields hold percents ("9"), the plan holds decimals (0.09). */
export type FreedomDraft = Record<NumericFieldKey, string> & { goalType: GoalType };

export type FreedomErrors = Partial<Record<FreedomFieldKey, string>>;

export const MAX_RETURN_PCT = 30;
export const MAX_INFLATION_PCT = 30;

const ERROR_COLOR = '#FF3B30';

// The iOS number pads have no return key; every field shares this "Done" bar.
const ACCESSORY_ID = 'freedom-keyboard-accessory';

/** Rendered once by the screen, next to the scroll view. */
export function FreedomKeyboardAccessory() {
  const { colors } = useTheme();
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={ACCESSORY_ID}>
      <View style={[styles.accessory, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          style={styles.accessoryBtn}
          accessibilityRole="button"
          accessibilityLabel="Done, hide keyboard"
        >
          <Text style={[styles.accessoryText, { color: colors.accent }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

type FieldConfig = {
  key: NumericFieldKey;
  label: string;
  helper: string;
  kind: 'YEARS' | 'AMOUNT' | 'PERCENT';
  /** Highest percent accepted; unlimited when missing. */
  max?: number;
};

/** The three questions every plan starts with. */
const BASIC_FIELDS: FieldConfig[] = [
  { key: 'monthly', label: 'Monthly amount', helper: 'What you add every month.', kind: 'AMOUNT' },
  { key: 'years', label: 'Years', helper: 'How long you keep investing.', kind: 'YEARS' },
  { key: 'lumpSum', label: 'Starting amount', helper: 'What you put in at the start. Can be 0.', kind: 'AMOUNT' },
];

/** Behind "More options"; the defaults work without touching them. */
const ADVANCED_FIELDS: FieldConfig[] = [
  {
    key: 'returnPct',
    label: 'Yearly return',
    helper: 'Set by the outlook above. Type your own to override it.',
    kind: 'PERCENT',
    max: MAX_RETURN_PCT,
  },
  {
    key: 'annualIncreasePct',
    label: 'Yearly increase',
    helper: 'How much your monthly amount grows each year.',
    kind: 'PERCENT',
  },
  { key: 'feePct', label: 'Fee', helper: 'Yearly fund and platform costs.', kind: 'PERCENT' },
  {
    key: 'inflationPct',
    label: 'Inflation',
    helper: "Average yearly price increase. Used for today's prices.",
    kind: 'PERCENT',
    max: MAX_INFLATION_PCT,
  },
];

const FIELD_SETS = { BASIC: BASIC_FIELDS, ADVANCED: ADVANCED_FIELDS };

export type FreedomFieldSet = keyof typeof FIELD_SETS;

export const ADVANCED_FIELD_KEYS: FreedomFieldKey[] = ADVANCED_FIELDS.map((field) => field.key);

/** Rendered by the Goal section, one at a time (the one of the selected goal type). */
export const GOAL_FIELDS: Record<GoalType, FieldConfig> = {
  BALANCE: { key: 'goalBalance', label: 'Target balance', helper: 'The balance you want to reach.', kind: 'AMOUNT' },
  INCOME: {
    key: 'goalIncome',
    label: 'Passive income per month',
    helper: 'What the balance should pay you every month.',
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

const validate = (field: FieldConfig, text: string): { value: number; error: string | null } => {
  const value = text.trim() === '' ? NaN : parseNumber(text);

  if (field.kind === 'YEARS') {
    const valid = Number.isInteger(value) && value >= MIN_YEARS && value <= MAX_YEARS;
    return { value, error: valid ? null : `Enter ${MIN_YEARS} to ${MAX_YEARS} years` };
  }

  const noun = field.kind === 'AMOUNT' ? 'an amount' : 'a percentage';
  if (!Number.isFinite(value)) return { value, error: `Enter ${noun}` };
  if (value < 0) return { value, error: "Can't be negative" };
  if (field.max !== undefined && value > field.max) return { value, error: `Enter 0 to ${field.max}%` };
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
  error?: string;
  onChange: (key: FreedomFieldKey, text: string) => void;
  currencySymbol: string;
}

export function FreedomField({ field, value, error, onChange, currencySymbol }: FreedomFieldProps) {
  const { colors } = useTheme();
  const prefix = field.kind === 'AMOUNT' ? currencySymbol : null;
  const suffix = field.kind === 'YEARS' ? 'years' : field.kind === 'PERCENT' ? '%' : null;
  const unit = field.kind === 'AMOUNT' ? currencySymbol : field.kind === 'PERCENT' ? 'percent' : 'years';

  return (
    <View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{field.label}</Text>
      <View
        style={[styles.inputWrap, { backgroundColor: colors.field, borderColor: error ? ERROR_COLOR : colors.border }]}
      >
        {prefix ? <Text style={[styles.affix, { color: colors.textSecondary }]}>{prefix}</Text> : null}
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
          accessibilityLabel={`${field.label}${unit ? `, in ${unit}` : ''}`}
          accessibilityHint={error ?? field.helper}
        />
        {suffix ? <Text style={[styles.affix, { color: colors.textSecondary }]}>{suffix}</Text> : null}
      </View>
      <Text
        style={[styles.helper, { color: error ? ERROR_COLOR : colors.textSecondary }]}
        numberOfLines={2}
        accessibilityLiveRegion={error ? 'polite' : 'none'}
      >
        {error ?? field.helper}
      </Text>
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
