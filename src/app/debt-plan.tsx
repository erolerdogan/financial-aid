import { CountUpText } from '@/components/debts/CountUpText';
import { ExtraSlider } from '@/components/debts/ExtraSlider';
import { LumpSumRows, type LumpSumDraft } from '@/components/debts/LumpSumRows';
import { PayoffChart } from '@/components/debts/PayoffChart';
import { PayoffTimeline, type PayoffTimelineRow } from '@/components/debts/PayoffTimeline';
import { DebtFormModal } from '@/components/modals/DebtFormModal';
import { ProGate } from '@/components/pro/ProGate';
import { ReadOnlySheetHost } from '@/components/pro/ReadOnlySheet';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SelectableText } from '@/components/SelectableText';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { saveDebtPlan, type DebtSummary } from '@/db/database';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import type { TranslationKey } from '@/i18n';
import { loadDebtsWithPlan } from '@/services/debtPlanService';
import { parseNumber } from '@/utils/debt';
import {
  addMonths,
  buildChartSeries,
  compareStrategies,
  currentMonthKey,
  DEFAULT_DEBT_PLAN,
  extraSliderMax,
  extraSliderStep,
  MAX_SIM_MONTHS,
  planToInput,
  toSimDebts,
  type DebtPlan,
  type PlanStrategy,
  type SimWarning,
} from '@/utils/debtSimulator';
import { isItemReadOnly } from '@/utils/entitlement';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const SAVE_DELAY_MS = 500;
// Below this the two strategies count as costing the same.
const MIN_INTEREST_DIFFERENCE = 0.5;

const STRATEGIES: { key: PlanStrategy; label: TranslationKey; tag: TranslationKey; sub: TranslationKey }[] = [
  {
    key: 'AVALANCHE',
    label: 'debt.plan.strategy.avalanche',
    tag: 'debt.plan.strategy.avalancheTag',
    sub: 'debt.plan.strategy.avalancheSub',
  },
  {
    key: 'SNOWBALL',
    label: 'debt.plan.strategy.snowball',
    tag: 'debt.plan.strategy.snowballTag',
    sub: 'debt.plan.strategy.snowballSub',
  },
];

const WARNING_TEXT: Record<Exclude<SimWarning['code'], 'OVER_LIMIT'>, TranslationKey> = {
  RATE_UNKNOWN: 'debt.plan.warn.rate',
  PAYMENT_BELOW_INTEREST: 'debt.plan.warn.belowInterest',
  NO_PAYMENT: 'debt.plan.warn.noPayment',
};

const parseAmount = (text: string): number => {
  const value = parseNumber(text);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
};

export default function DebtPlanScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;
  const { can, isPro, showReadOnly } = useEntitlement();
  const { readOnly, guardWrite } = useProfileAccess();
  const canPlan = can('debtSimulator');

  const [debts, setDebts] = useState<DebtSummary[] | null>(null);
  // Field text is the source of truth; the plan is parsed from it.
  const [extraText, setExtraText] = useState('');
  const [strategy, setStrategy] = useState<PlanStrategy>(DEFAULT_DEBT_PLAN.strategy);
  const [lumps, setLumps] = useState<LumpSumDraft[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [formDebt, setFormDebt] = useState<DebtSummary | null>(null);
  const [formFocusApr, setFormFocusApr] = useState(false);

  const [startMonth] = useState(() => currentMonthKey());
  const firstMonth = addMonths(startMonth, 1);
  const lastMonth = addMonths(startMonth, MAX_SIM_MONTHS);

  const plan = useMemo<DebtPlan>(
    () => ({
      extraMonthly: parseAmount(extraText),
      strategy,
      lumpSums: lumps.map((row) => ({ month: row.month, amount: parseAmount(row.amount) })),
    }),
    [extraText, strategy, lumps]
  );

  // Set by an edit, cleared by a load: a plan that was only loaded is not written back.
  const dirty = useRef(false);
  const pendingSave = useRef<{ profileId: number; plan: DebtPlan } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());

  const flushSave = useCallback((): Promise<void> => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const job = pendingSave.current;
    if (!job) return saving.current;
    pendingSave.current = null;
    saving.current = saveDebtPlan(db, job.profileId, job.plan).catch((error) =>
      console.error('Failed to save debt plan:', error)
    );
    return saving.current;
  }, [db]);

  useEffect(() => {
    if (!dirty.current) return;
    // The job carries its own profile, so a late flush still writes to the right one.
    pendingSave.current = { profileId, plan };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, SAVE_DELAY_MS);
  }, [plan, profileId, flushSave]);

  // Debt edits do not bump `dataVersion`, so every focus reads the debts again.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await flushSave();
        try {
          const loaded = await loadDebtsWithPlan(db, profileId);
          if (!active) return;
          dirty.current = false;
          setDebts(loaded.debts);
          setExtraText(loaded.plan.extraMonthly > 0 ? String(loaded.plan.extraMonthly) : '');
          setStrategy(loaded.plan.strategy);
          setLumps(
            loaded.plan.lumpSums
              .filter((lump) => lump.month > startMonth)
              .map((lump) => ({ month: lump.month, amount: lump.amount > 0 ? String(lump.amount) : '' }))
          );
        } catch (error) {
          console.error('Failed to load debt plan:', error);
          if (active) setDebts((previous) => previous ?? []);
        }
      })();
      // Leaving the screen writes the pending save, so the Debts and Home cards read the current plan.
      return () => {
        active = false;
        flushSave();
      };
    }, [db, profileId, dataVersion, flushSave, startMonth])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushSave();
    });
    return () => subscription.remove();
  }, [flushSave]);

  const reloadDebts = useCallback(async () => {
    try {
      setDebts((await loadDebtsWithPlan(db, profileId)).debts);
    } catch (error) {
      console.error('Failed to reload debts:', error);
    }
  }, [db, profileId]);

  const edit = (change: () => void) => {
    if (!guardWrite()) return;
    dirty.current = true;
    change();
  };

  const simDebts = useMemo(() => toSimDebts(debts ?? []), [debts]);
  const comparison = useMemo(
    () => compareStrategies(planToInput(simDebts, canPlan ? plan : DEFAULT_DEBT_PLAN, startMonth)),
    [simDebts, canPlan, plan, startMonth]
  );
  const { baseline } = comparison;
  const planned = strategy === 'AVALANCHE' ? comparison.avalanche : comparison.snowball;
  // Without Pro the screen shows what the current payments give.
  const shown = canPlan ? planned : baseline;
  const diff = comparison.diff[strategy];
  const chart = useMemo(() => buildChartSeries(baseline, shown), [baseline, shown]);

  const sliderMax = extraSliderMax(simDebts);
  const sliderStep = extraSliderStep(sliderMax);
  const currentPayments = simDebts.reduce((sum, debt) => sum + debt.minPayment, 0);

  const fmt = (value: number) => format.money(Math.round(value), currencySymbol);
  const monthText = (month: string | null) => (month ? format.monthYear(month) : t('debt.plan.heroNever'));

  const handleBack = () => {
    Haptics.selectionAsync().catch(() => {});
    // Opened by a link with nothing underneath: go to the Plan tab instead of nowhere.
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/debts', params: { segment: 'debts' } });
  };

  const openCreate = () =>
    guardWrite(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setFormDebt(null);
      setFormFocusApr(false);
      setFormVisible(true);
    });

  // The list is oldest first; debts beyond the free limit are read-only.
  const debtIds = (debts ?? []).map((debt) => debt.id);
  const openDebt = (debt: DebtSummary, focusApr: boolean) =>
    guardWrite(() => {
      if (isItemReadOnly(isPro, 'maxDebts', debtIds, debt.id)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        showReadOnly({ kind: 'debt' });
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      setFormDebt(debt);
      setFormFocusApr(focusApr);
      setFormVisible(true);
    });

  // On a read-only profile the controls do not take touches; a tap on them explains why.
  const editable = (node: React.ReactNode) =>
    readOnly ? (
      <Pressable onPress={() => guardWrite()} accessibilityRole="button" accessibilityLabel={t('pro.readOnly.note')}>
        <View pointerEvents="none">{node}</View>
      </Pressable>
    ) : (
      node
    );

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleBack}
          activeOpacity={0.8}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {t('debt.plan.title')}
        </SelectableText>
      </View>
    </View>
  );

  const formModal = (
    <DebtFormModal
      visible={formVisible}
      debt={formDebt}
      focusApr={formFocusApr}
      onClose={() => setFormVisible(false)}
      onSaved={reloadDebts}
    />
  );

  if (debts === null) {
    return (
      <ScreenContainer>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  if (debts.length === 0) {
    return (
      <ScreenContainer>
        {header}
        <ScrollView contentContainerStyle={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.tintBackground }]}>
            <Ionicons name="flag-outline" size={32} color={colors.accent} />
          </View>
          <SelectableText style={[styles.emptyTitle, { color: colors.text }]}>{t('debt.plan.emptyTitle')}</SelectableText>
          <SelectableText style={[styles.emptySub, { color: colors.textSecondary }]}>{t('debt.plan.emptySub')}</SelectableText>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.emptyBtn, { backgroundColor: colors.accent }]}
            onPress={openCreate}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.emptyBtnText}>{t('debt.addFirst')}</Text>
          </TouchableOpacity>
        </ScrollView>
        {formModal}
        <ReadOnlySheetHost />
      </ScreenContainer>
    );
  }

  const allPaid = simDebts.length === 0;
  const ink = colors.onGradient;
  const monthsSaved = canPlan ? diff.monthsSaved : null;
  const interestSaved = canPlan ? diff.interestSaved : null;
  const savesMonths = monthsSaved !== null && monthsSaved > 0;
  const savesInterest = interestSaved !== null && interestSaved >= MIN_INTEREST_DIFFERENCE;
  // The plan ends where the current payments never do, so there is nothing to subtract from.
  const rescued = canPlan && baseline.months === null && shown.months !== null;

  const byId = new Map(debts.map((debt) => [debt.id, debt]));
  const timeline: PayoffTimelineRow[] = [
    ...debts
      .filter((debt) => !simDebts.some((sim) => sim.id === debt.id))
      .map((debt) => ({ id: debt.id, name: debt.name, color: debt.color, month: null, paid: true })),
    ...[...shown.debts]
      .sort((a, b) => (a.payoffIndex ?? Infinity) - (b.payoffIndex ?? Infinity))
      .map((result) => {
        const debt = byId.get(result.id);
        return {
          id: result.id,
          name: debt?.name ?? '',
          color: debt?.color ?? colors.accent,
          month: result.payoffMonth,
          paid: false,
        };
      }),
  ];

  const bothEnd = comparison.avalanche.months !== null && comparison.snowball.months !== null;
  const strategyGap = comparison.snowball.totalInterest - comparison.avalanche.totalInterest;
  const firstAvalanche = comparison.diff.AVALANCHE.firstCleared;
  const firstSnowball = comparison.diff.SNOWBALL.firstCleared;
  const snowballLead = firstAvalanche && firstSnowball ? firstAvalanche.payoffIndex - firstSnowball.payoffIndex : 0;

  const debtWarnings = shown.warnings.filter(
    (warning): warning is SimWarning & { debtId: number; code: keyof typeof WARNING_TEXT } =>
      warning.debtId !== null && warning.code !== 'OVER_LIMIT'
  );
  // "Never" is already said per debt when a payment is the reason.
  const showOverLimit =
    shown.months === null && !debtWarnings.some((warning) => warning.code !== 'RATE_UNKNOWN');

  return (
    <ScreenContainer>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
          accessible
          accessibilityLabel={[
            `${t('debt.plan.heroTitle')}: ${allPaid ? t('debt.plan.heroDone') : monthText(shown.debtFreeMonth)}`,
            savesMonths ? t('debt.plan.sooner', { count: monthsSaved ?? 0 }) : null,
            savesInterest ? t('debt.plan.lessInterest', { amount: fmt(interestSaved ?? 0) }) : null,
          ]
            .filter(Boolean)
            .join(', ')}
        >
          <Text style={[styles.heroLabel, { color: ink }]}>{t('debt.plan.heroTitle')}</Text>
          <Text style={[styles.heroValue, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {allPaid ? t('debt.plan.heroDone') : monthText(shown.debtFreeMonth)}
          </Text>

          {!allPaid && (savesMonths || savesInterest) && (
            <View style={styles.heroGains}>
              {savesMonths && (
                <View style={[styles.gain, { backgroundColor: `${ink}22` }]}>
                  <CountUpText
                    style={[styles.gainText, { color: ink }]}
                    value={monthsSaved ?? 0}
                    formatValue={(value) => t('debt.plan.sooner', { count: Math.round(value) })}
                  />
                </View>
              )}
              {savesInterest && (
                <View style={[styles.gain, { backgroundColor: `${ink}22` }]}>
                  <CountUpText
                    style={[styles.gainText, { color: ink }]}
                    value={interestSaved ?? 0}
                    formatValue={(value) => t('debt.plan.lessInterest', { amount: fmt(value) })}
                  />
                </View>
              )}
            </View>
          )}

          {!allPaid && (
            <Text style={[styles.heroSub, { color: ink }]}>
              {savesMonths || savesInterest || rescued
                ? t('debt.plan.currentDate', { month: monthText(baseline.debtFreeMonth) })
                : shown.months === null
                ? t('debt.plan.heroNeverSub')
                : t(canPlan ? 'debt.plan.sameAsCurrent' : 'debt.plan.withCurrent')}
            </Text>
          )}
          {!allPaid && shown.months !== null && (
            <Text style={[styles.heroSub, { color: ink }]}>
              {t('debt.plan.interestLeft', { amount: fmt(shown.totalInterest) })}
            </Text>
          )}
        </LinearGradient>

        {!allPaid && (
          <ProGate feature="debtSimulator" paywall="debtSimulator" label={t('debt.plan.extra.title')}>
            {editable(
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SelectableText style={[styles.cardTitle, { color: colors.textSecondary }]}>
                  {t('debt.plan.extra.title')}
                </SelectableText>
                <View style={[styles.inputWrap, { backgroundColor: colors.field, borderColor: colors.border }]}>
                  <Text style={[styles.affix, { color: colors.textSecondary }]}>{currencySymbol}</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={extraText}
                    onChangeText={(text) => edit(() => setExtraText(text))}
                    placeholder={format.number(0)}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    maxLength={12}
                    selectTextOnFocus
                    autoCorrect={false}
                    accessibilityLabel={t('debt.plan.extra.title')}
                  />
                </View>
                <ExtraSlider
                  value={plan.extraMonthly}
                  max={sliderMax}
                  step={sliderStep}
                  onChange={(value) => edit(() => setExtraText(value > 0 ? String(value) : ''))}
                  accessibilityLabel={t('debt.plan.extra.title')}
                  valueText={fmt(plan.extraMonthly)}
                />
                <View style={styles.sliderEnds}>
                  <Text style={[styles.sliderEnd, { color: colors.textSecondary }]}>{fmt(0)}</Text>
                  <Text style={[styles.sliderEnd, { color: colors.textSecondary }]}>{fmt(sliderMax)}</Text>
                </View>
                <SelectableText style={[styles.helper, { color: colors.textSecondary }]}>
                  {t('debt.plan.extra.helper', { amount: fmt(currentPayments) })}
                </SelectableText>
              </View>
            )}
          </ProGate>
        )}

        {!allPaid && (
          <ProGate feature="debtSimulator" paywall="debtSimulator" label={t('debt.plan.strategy.title')}>
            {editable(
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SelectableText style={[styles.cardTitle, { color: colors.textSecondary }]}>
                  {t('debt.plan.strategy.title')}
                </SelectableText>
                <View style={[styles.segmentedContainer, { backgroundColor: colors.track }]} accessibilityRole="radiogroup">
                  {STRATEGIES.map((option) => {
                    const selected = option.key === strategy;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        activeOpacity={0.8}
                        style={[styles.segmentBtn, selected && [styles.segmentBtnActive, { backgroundColor: colors.raised }]]}
                        onPress={() => {
                          if (selected) return;
                          Haptics.selectionAsync().catch(() => {});
                          edit(() => setStrategy(option.key));
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${t(option.label)}, ${t(option.tag)}`}
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
                          {t(option.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {STRATEGIES.map((option) => (
                  <View key={option.key} style={option.key !== strategy && styles.dimmed}>
                    <SelectableText style={[styles.strategyTag, { color: colors.text }]}>
                      {t(option.label)} · {t(option.tag)}
                    </SelectableText>
                    <SelectableText style={[styles.helper, styles.strategySub, { color: colors.textSecondary }]}>
                      {t(option.sub)}
                    </SelectableText>
                  </View>
                ))}
              </View>
            )}
          </ProGate>
        )}

        {!allPaid && (
          <ProGate feature="debtSimulator" paywall="debtSimulator" label={t('debt.plan.lump.title')}>
            {editable(
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SelectableText style={[styles.cardTitle, { color: colors.textSecondary }]}>
                  {t('debt.plan.lump.title')}
                </SelectableText>
                <LumpSumRows
                  rows={lumps}
                  minMonth={firstMonth}
                  maxMonth={lastMonth}
                  currencySymbol={currencySymbol}
                  onChange={(rows) => edit(() => setLumps(rows))}
                />
              </View>
            )}
          </ProGate>
        )}

        <PayoffTimeline rows={timeline} />

        {!allPaid && (
          <ProGate feature="debtSimulator" paywall="debtSimulator" label={t('debt.plan.chart.title')}>
            <PayoffChart series={chart} startMonth={startMonth} />
          </ProGate>
        )}

        {!allPaid && bothEnd && simDebts.length > 1 && (
          <ProGate feature="debtSimulator" paywall="debtSimulator" label={t('debt.plan.strategy.title')} compact>
            <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.accent} />
              <SelectableText style={[styles.noteText, { color: colors.text }]}>
                {strategyGap >= MIN_INTEREST_DIFFERENCE
                  ? t('debt.plan.compare.interest', { amount: fmt(strategyGap) })
                  : t('debt.plan.compare.same')}
                {snowballLead > 0 ? ` ${t('debt.plan.compare.first', { count: snowballLead })}` : ''}
              </SelectableText>
            </View>
          </ProGate>
        )}

        {debtWarnings.map((warning) => {
          const debt = byId.get(warning.debtId);
          if (!debt) return null;
          const text = t(WARNING_TEXT[warning.code], { name: debt.name });
          // Every warning is fixed in the debt form; the rate hint lands on its field.
          return (
            <TouchableOpacity
              key={`${warning.code}-${warning.debtId}`}
              activeOpacity={0.8}
              style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => openDebt(debt, warning.code === 'RATE_UNKNOWN')}
              accessibilityRole="button"
              accessibilityLabel={text}
            >
              <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
              <Text style={[styles.noteText, { color: colors.text }]}>{text}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
        {showOverLimit && (
          <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
            <SelectableText style={[styles.noteText, { color: colors.text }]}>{t('debt.plan.warn.overLimit')}</SelectableText>
          </View>
        )}

        <SelectableText style={[styles.disclaimer, { color: colors.textSecondary }]}>
          {t('debt.plan.disclaimer')}
        </SelectableText>
      </ScrollView>

      {formModal}
      <ReadOnlySheetHost />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  hero: { borderRadius: 18, padding: 18 },
  heroLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, opacity: 0.85 },
  heroValue: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  heroGains: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  gain: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  gainText: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: 13, opacity: 0.85, marginTop: 8 },
  card: { borderRadius: 18, padding: 18, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  cardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
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
  sliderEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  sliderEnd: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  helper: { fontSize: 12, lineHeight: 17 },
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
  dimmed: { opacity: 0.5 },
  strategyTag: { fontSize: 14, fontWeight: '600' },
  strategySub: { marginTop: 2 },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteText: { flex: 1, fontSize: 14, lineHeight: 19 },
  disclaimer: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  emptyWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 12,
  },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
