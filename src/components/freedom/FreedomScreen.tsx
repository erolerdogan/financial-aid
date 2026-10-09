import { CashComparison } from '@/components/freedom/CashComparison';
import { DisclosureRow } from '@/components/freedom/DisclosureRow';
import {
  ADVANCED_FIELD_KEYS,
  FreedomInputs,
  FreedomKeyboardAccessory,
  parseDraft,
  planToDraft,
  type FreedomDraft,
  type FreedomFieldKey,
} from '@/components/freedom/FreedomInputs';
import { FREEDOM_INTRO_SEEN_KEY, FreedomIntro, FreedomIntroModal } from '@/components/freedom/FreedomIntro';
import { GoalSection, type GoalResult } from '@/components/freedom/GoalSection';
import { GrowthChart } from '@/components/freedom/GrowthChart';
import { ImpactSection, type ValueMode } from '@/components/freedom/ImpactSection';
import { ResultCards } from '@/components/freedom/ResultCards';
import { ScenarioSelector } from '@/components/freedom/ScenarioSelector';
import { YearlyTable } from '@/components/freedom/YearlyTable';
import { ReadOnlyNote } from '@/components/pro/ReadOnlySheet';
import { SelectableText } from '@/components/SelectableText';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DEFAULT_FREEDOM_PLAN,
  getAppMeta,
  getFreedomPlan,
  getSavedFreedomPlan,
  saveFreedomPlan,
  setAppMeta,
  type FreedomPlan,
} from '@/db/database';
import { usePaywall } from '@/hooks/usePaywall';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import { parseNumber } from '@/utils/debt';
import {
  cashComparison,
  clampYears,
  compareScenarios,
  feeImpact,
  incomeToBalance,
  matchScenario,
  monthlyNeeded,
  projectGrowth,
  summarize,
  toReal,
  toRealRows,
  yearsToReach,
  type GoalType,
  type Scenario,
} from '@/utils/freedom';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SAVE_DELAY_MS = 500;

export function FreedomScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { activeProfile, dataVersion, currencySymbol, isDemoMode } = useProfile();
  const profileId = activeProfile?.id ?? 1;
  const { can } = useEntitlement();
  const { openPaywall } = usePaywall();
  const { readOnly, guardWrite } = useProfileAccess();
  // Future Growth is a Pro feature. Without Pro the screen is read-only: the saved plan, or the default one as an example.
  const locked = !can('futureGrowth');
  // Null until read. Without a saved plan the read-only note says the numbers are an example.
  const [hasSavedPlan, setHasSavedPlan] = useState<boolean | null>(null);

  const [draft, setDraft] = useState<FreedomDraft | null>(null);
  // The cards keep showing the last valid plan while a field is being edited into an invalid state.
  const [lastValid, setLastValid] = useState<FreedomPlan>(DEFAULT_FREEDOM_PLAN);
  // Which profile / data version `lastValid` was loaded for; the chart waits until it matches.
  const [loadedSignature, setLoadedSignature] = useState('');
  const requestSignature = `${profileId}|${dataVersion}`;
  // The profile the draft belongs to; until it matches, nothing is shown or editable.
  const [loadedProfileId, setLoadedProfileId] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const loadKey = `${requestSignature}|${retryCount}`;
  const [failedLoadKey, setFailedLoadKey] = useState<string | null>(null);
  const [mode, setMode] = useState<ValueMode>('NOMINAL');
  // Null until read; the first visit shows the introduction instead of the calculator.
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [introVisible, setIntroVisible] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const pendingSave = useRef<{ profileId: number; plan: FreedomPlan } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const job = pendingSave.current;
    if (!job) return;
    pendingSave.current = null;
    saveFreedomPlan(db, job.profileId, job.plan).catch((error) =>
      console.error('Failed to save freedom plan:', error)
    );
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    flushSave();
    Promise.all([getFreedomPlan(db, profileId), getSavedFreedomPlan(db, profileId)])
      .then(([plan, saved]) => {
        if (cancelled) return;
        setHasSavedPlan(saved !== null);
        setLastValid(plan);
        setDraft(planToDraft(plan));
        setLoadedSignature(`${profileId}|${dataVersion}`);
        setLoadedProfileId(profileId);
      })
      .catch((error) => {
        console.error('Failed to load freedom plan:', error);
        if (cancelled) return;
        // No fallback to the defaults: editing them would overwrite the saved plan.
        setFailedLoadKey(`${profileId}|${dataVersion}|${retryCount}`);
      });
    return () => {
      cancelled = true;
    };
  }, [db, profileId, dataVersion, retryCount, flushSave]);

  useEffect(() => {
    let cancelled = false;
    getAppMeta(db, FREEDOM_INTRO_SEEN_KEY)
      .then((value) => {
        if (!cancelled) setIntroSeen(value !== null);
      })
      .catch(() => {
        if (!cancelled) setIntroSeen(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  // Switching segment unmounts this screen; a pending save is written rather than dropped.
  useEffect(() => flushSave, [flushSave, profileId]);

  // Leaving the tab writes the pending save too, so the Home card reads the current plan.
  useFocusEffect(useCallback(() => flushSave, [flushSave]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushSave();
    });
    return () => subscription.remove();
  }, [flushSave]);

  const errors = useMemo(() => (draft ? parseDraft(draft).errors : {}), [draft]);
  const real = mode === 'REAL';
  const years = clampYears(lastValid.years);
  const nominalRows = useMemo(() => projectGrowth(lastValid), [lastValid]);
  // Cards, chart and table all read these, so the toggle switches them together.
  const rows = useMemo(
    () => (real ? toRealRows(nominalRows, lastValid.inflationPct) : nominalRows),
    [nominalRows, real, lastValid.inflationPct]
  );
  const summary = useMemo(() => summarize(rows, lastValid), [rows, lastValid]);
  const scenarios = useMemo(() => {
    const results = compareScenarios(lastValid);
    if (!real) return results;
    return results.map((result) => ({
      ...result,
      finalBalance: toReal(result.finalBalance, lastValid.inflationPct, years),
    }));
  }, [lastValid, real, years]);
  const fee = useMemo(() => {
    const impact = feeImpact(lastValid);
    if (!real) return impact;
    const deflate = (value: number) => toReal(value, lastValid.inflationPct, years);
    return { withoutFee: deflate(impact.withoutFee), withFee: deflate(impact.withFee), cost: deflate(impact.cost) };
  }, [lastValid, real, years]);
  // The same payments left as cash. `today` is that cash in today's money, whatever the mode.
  const cash = useMemo(() => {
    const comparison = cashComparison(lastValid);
    const deflate = (value: number) => toReal(value, lastValid.inflationPct, years);
    const today = deflate(comparison.cash);
    if (!real) return { comparison, today };
    return {
      comparison: { invested: deflate(comparison.invested), cash: today, gain: deflate(comparison.gain) },
      today,
    };
  }, [lastValid, real, years]);
  // In Real mode the goal is in today's money, like every other amount on the screen.
  const goal = useMemo<GoalResult>(() => {
    const target =
      lastValid.goalType === 'INCOME' ? incomeToBalance(lastValid.goalIncome) : Math.max(0, lastValid.goalBalance);
    const inflationPct = real ? lastValid.inflationPct : 0;
    return {
      target,
      projected: summary.finalBalance,
      yearsNeeded: yearsToReach(lastValid, target, inflationPct),
      monthlyNeeded: monthlyNeeded(lastValid, target, years, inflationPct),
    };
  }, [lastValid, real, years, summary.finalBalance]);
  // Follows the return field itself, so a manual edit to any other value selects none.
  const activeScenario = useMemo(
    () => (draft && !errors.returnPct ? matchScenario(parseNumber(draft.returnPct) / 100) : null),
    [draft, errors.returnPct]
  );
  const chartReady = loadedSignature === requestSignature;
  const stale = Object.keys(errors).length > 0;
  // An invalid field blocks saving, so it is never left hidden behind the collapsed row.
  const showOptions = optionsOpen || ADVANCED_FIELD_KEYS.some((key) => errors[key]);

  const applyDraft = (nextDraft: FreedomDraft, key?: FreedomFieldKey) => {
    // Without Pro, in the demo, or on a profile beyond the free limit: the plan is shown as saved and cannot be changed.
    if (locked || isDemoMode || !guardWrite()) return;
    const next = parseDraft(nextDraft);
    setDraft(nextDraft);

    if (key && next.errors[key] && !errors[key]) Haptics.selectionAsync().catch(() => {});

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!next.input) {
      pendingSave.current = null;
      return;
    }
    setLastValid(next.input);
    pendingSave.current = { profileId, plan: next.input };
    saveTimer.current = setTimeout(flushSave, SAVE_DELAY_MS);
  };

  const handleChange = (key: FreedomFieldKey, text: string) => {
    if (!draft) return;
    applyDraft({ ...draft, [key]: text }, key);
  };

  const handleGoalType = (type: GoalType) => {
    if (!draft || type === draft.goalType) return;
    Haptics.selectionAsync().catch(() => {});
    Keyboard.dismiss();
    // The field of the other type is hidden; an invalid text left in it would block saving unseen.
    const saved = planToDraft(lastValid);
    applyDraft({
      ...draft,
      goalType: type,
      goalBalance: errors.goalBalance ? saved.goalBalance : draft.goalBalance,
      goalIncome: errors.goalIncome ? saved.goalIncome : draft.goalIncome,
    });
  };

  const handleScenario = (scenario: Scenario) => {
    if (scenario.key === activeScenario) return;
    Haptics.selectionAsync().catch(() => {});
    Keyboard.dismiss();
    handleChange('returnPct', planToDraft({ ...lastValid, returnPct: scenario.returnPct }).returnPct);
  };

  const handleMode = (next: ValueMode) => {
    if (next === mode) return;
    Haptics.selectionAsync().catch(() => {});
    Keyboard.dismiss();
    setMode(next);
  };

  const handleRetry = () => {
    Haptics.selectionAsync().catch(() => {});
    setRetryCount((value) => value + 1);
  };

  const handleIntroDone = () => {
    Haptics.selectionAsync().catch(() => {});
    setIntroSeen(true);
    setAppMeta(db, FREEDOM_INTRO_SEEN_KEY, '1').catch((error) =>
      console.error('Failed to save freedom intro state:', error)
    );
  };

  const openIntro = () => {
    Haptics.selectionAsync().catch(() => {});
    Keyboard.dismiss();
    setIntroVisible(true);
  };

  const readOnlyNote = t(locked && hasSavedPlan === false ? 'pro.locked.examplePlan' : 'pro.readOnly.note');
  // Without Pro or on a read-only profile the inputs do not take focus; a tap on them explains why.
  const explainReadOnly = () => (locked ? openPaywall('growth') : guardWrite());
  // In the demo they are grayed out, like the rows Settings switches off there.
  const editable = (node: React.ReactNode) =>
    isDemoMode ? (
      <View pointerEvents="none" style={styles.disabled}>
        {node}
      </View>
    ) : locked || readOnly ? (
      <Pressable onPress={explainReadOnly} accessibilityRole="button" accessibilityLabel={readOnlyNote}>
        <View pointerEvents="none">{node}</View>
      </Pressable>
    ) : (
      node
    );

  if (introSeen === false && !locked) {
    return <FreedomIntro currencySymbol={currencySymbol} actionLabel={t('freedom.intro.start')} onDone={handleIntroDone} />;
  }

  if (!draft || loadedProfileId !== profileId || introSeen === null) {
    if (failedLoadKey === loadKey) {
      return (
        <View style={styles.centered}>
          <SelectableText style={[styles.errorTitle, { color: colors.text }]}>{t('freedom.loadErrorTitle')}</SelectableText>
          <SelectableText style={[styles.errorText, { color: colors.textSecondary }]}>
            {t('freedom.loadErrorBody')}
          </SelectableText>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.retryBtn, { backgroundColor: colors.accent }]}
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel={t('freedom.retryA11y')}
          >
            <Text style={styles.retryText}>{t('freedom.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {locked && (
          <Pressable onPress={() => openPaywall('growth')} accessibilityRole="button">
            {/* Nothing saved for this profile: the numbers are the default plan, not the user's. */}
            <ReadOnlyNote text={readOnlyNote} />
          </Pressable>
        )}
        {isDemoMode && (
          <View style={[styles.demoNote, { backgroundColor: colors.surface }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <SelectableText style={[styles.demoNoteText, { color: colors.textSecondary }]}>
              {t('freedom.demoNote')}
            </SelectableText>
          </View>
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.introLink}
          onPress={openIntro}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('freedom.intro.modalTitle')}
        >
          <Ionicons name="help-circle-outline" size={16} color={colors.accent} />
          <Text style={[styles.introLinkText, { color: colors.accent }]}>{t('freedom.howItWorks')}</Text>
        </TouchableOpacity>
        {editable(
          <FreedomInputs
            fields="BASIC"
            draft={draft}
            errors={errors}
            onChange={handleChange}
            currencySymbol={currencySymbol}
          />
        )}
        <CashComparison
          cash={cash.comparison}
          cashToday={cash.today}
          inflationPct={lastValid.inflationPct}
          real={real}
          currencySymbol={currencySymbol}
          stale={stale}
        />
        <ResultCards
          summary={summary}
          years={years}
          currencySymbol={currencySymbol}
          real={real}
          stale={stale}
        />
        {editable(
          <ScenarioSelector
            scenarios={scenarios}
            active={activeScenario}
            onSelect={handleScenario}
            currencySymbol={currencySymbol}
            stale={stale}
          />
        )}
        <GrowthChart rows={rows} currencySymbol={currencySymbol} ready={chartReady} real={real} stale={stale} />
        {editable(
        <GoalSection
          key={profileId}
          goalType={draft.goalType}
          onGoalTypeChange={handleGoalType}
          draft={draft}
          errors={errors}
          onChange={handleChange}
          goal={goal}
          years={years}
          monthly={lastValid.monthly}
          annualIncreasePct={lastValid.annualIncreasePct}
          currencySymbol={currencySymbol}
          real={real}
          stale={stale}
        />
        )}
        <DisclosureRow
          title={t('freedom.moreOptions')}
          subtitle={t('freedom.moreOptionsSub')}
          expanded={showOptions}
          onToggle={() => setOptionsOpen(!showOptions)}
        />
        {showOptions &&
          editable(
            <FreedomInputs
              fields="ADVANCED"
              draft={draft}
              errors={errors}
              onChange={handleChange}
              currencySymbol={currencySymbol}
            />
          )}
        <DisclosureRow
          title={t('freedom.details')}
          subtitle={t('freedom.detailsSub')}
          expanded={detailsOpen}
          onToggle={() => setDetailsOpen((value) => !value)}
        />
        {detailsOpen && (
          <>
            <ImpactSection
              mode={mode}
              onModeChange={handleMode}
              inflationPct={lastValid.inflationPct}
              fee={fee}
              feePct={lastValid.feePct}
              currencySymbol={currencySymbol}
              stale={stale}
            />
            <YearlyTable rows={rows} currencySymbol={currencySymbol} real={real} />
          </>
        )}
        <SelectableText style={[styles.disclaimer, { color: colors.textSecondary }]}>
          Projection, not guaranteed. Not financial advice.
        </SelectableText>
      </ScrollView>
      <FreedomKeyboardAccessory />
      <FreedomIntroModal
        visible={introVisible}
        onClose={() => setIntroVisible(false)}
        currencySymbol={currencySymbol}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  errorText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  retryBtn: { minHeight: 44, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 20, marginTop: 18 },
  retryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  introLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4 },
  introLinkText: { fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  demoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  demoNoteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  disclaimer: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
