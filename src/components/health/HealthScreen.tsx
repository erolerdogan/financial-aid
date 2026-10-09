import { AlertsStrip } from '@/components/health/AlertsStrip';
import { BenchmarkGroupSheet } from '@/components/health/BenchmarkGroupSheet';
import { CategoryRangeRow } from '@/components/health/CategoryRangeRow';
import { ForecastCard } from '@/components/health/ForecastCard';
import { HEALTH_INTRO_SEEN_KEY, HealthIntro, HealthIntroModal } from '@/components/health/HealthIntro';
import { HealthOptionsSheet } from '@/components/health/HealthOptions';
import { levelKey, scoreColor } from '@/components/health/healthUi';
import { HouseholdSheet } from '@/components/health/HouseholdSheet';
import { PillarRow } from '@/components/health/PillarRow';
import { ScoreHistoryChart } from '@/components/health/ScoreHistoryChart';
import { ScoreRing } from '@/components/health/ScoreRing';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { TransactionListModal } from '@/components/modals/TransactionListModal';
import { ReadOnlyNote } from '@/components/pro/ReadOnlySheet';
import { SelectableText } from '@/components/SelectableText';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { usePaywall } from '@/hooks/usePaywall';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import type { BenchmarkGroupId, Household } from '@/constants/benchmarks';
import { useI18n } from '@/contexts/LanguageContext';
import { usePeriod } from '@/contexts/PeriodContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  clearRangeOverride,
  FixedCostSummary,
  FixedOverrideState,
  getAppMeta,
  getCategoryFixedVsFlexibleSummary,
  getTransactionFixedExplanation,
  getTransactionsByMonthAndCategory,
  saveHousehold,
  setAppMeta,
  setCategoryBenchmarkGroup,
  setMerchantFixedOverride,
  setRangeOverride,
  Transaction,
} from '@/db/database';
import type { Message } from '@/i18n';
import { loadHealth, type HealthSnapshot } from '@/services/healthService';
import type { CategoryStatus } from '@/utils/budgetHealth';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  AlertButton,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

/** "This is fine for us": the accepted range reaches this far to either side of the current share. */
const FINE_MARGIN = 0.2;

const groupPromptKey = (profileId: number): string => `health_group_prompt:${profileId}`;

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** The Health segment of the Plan tab. Rendered inside that screen's `ScreenContainer` (do not wrap it again). */
export function HealthScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format, categoryName } = useI18n();
  const { activeProfile, dataVersion } = useProfile();
  const { can } = useEntitlement();
  const { openPaywall } = usePaywall();
  const { readOnly: profileReadOnly, guardWrite: guardProfileWrite } = useProfileAccess();
  // Budget Health is a Pro feature. Without Pro the screen is shown read-only.
  const locked = !can('budgetHealth');
  const readOnly = locked || profileReadOnly;
  const guardWrite = (action?: () => void): boolean => {
    if (locked) {
      openPaywall('health');
      return false;
    }
    return guardProfileWrite(action);
  };
  const profileId = activeProfile?.id ?? 1;
  // Follows the month picked on Home and Transactions; the latest month with data otherwise.
  const { period } = usePeriod();
  const requestedMonth = period.kind === 'MONTH' ? period.month : undefined;

  // Null until read; the first visit shows the introduction instead of the score.
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [introVisible, setIntroVisible] = useState(false);

  useEffect(() => {
    let active = true;
    getAppMeta(db, HEALTH_INTRO_SEEN_KEY)
      .then((value) => active && setIntroSeen(value === '1'))
      .catch(() => active && setIntroSeen(true));
    return () => {
      active = false;
    };
  }, [db]);

  const handleIntroDone = () => {
    Haptics.selectionAsync().catch(() => {});
    setIntroSeen(true);
    setAppMeta(db, HEALTH_INTRO_SEEN_KEY, '1').catch((error) => console.error('Failed to save intro state:', error));
  };

  // Tagged with its profile, so a switch never shows the previous profile's figures.
  const [loaded, setLoaded] = useState<{ profileId: number; snapshot: HealthSnapshot } | null>(null);
  const [householdVisible, setHouseholdVisible] = useState(false);
  // Household, alert switches and range reset, behind the ⋯ button.
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [groupCategory, setGroupCategory] = useState<string | null>(null);

  // Transaction list sheet for a category and the detail opened from it
  const [listVisible, setListVisible] = useState(false);
  const [listCategory, setListCategory] = useState<string | null>(null);
  const [listTransactions, setListTransactions] = useState<Transaction[]>([]);
  const [listSummary, setListSummary] = useState<FixedCostSummary | undefined>(undefined);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [fixedState, setFixedState] = useState<FixedOverrideState>('AUTO');
  const [fixedAuto, setFixedAuto] = useState<{ autoIsFixed: boolean; reason: Message[] }>({ autoIsFixed: false, reason: [] });

  // The group prompt is raised once per visit.
  const promptedGroupRef = useRef(false);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      const snapshot = await loadHealth(db, profileId, requestedMonth);
      setLoaded({ profileId, snapshot });
    } catch (error) {
      console.error('Failed to load budget health:', error);
    }
  }, [db, profileId, requestedMonth]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, dataVersion])
  );

  const snapshot = loaded?.profileId === profileId ? loaded.snapshot : null;
  const result = snapshot?.result ?? null;
  const household = snapshot?.input.household ?? null;
  const month = result?.month ?? '';

  // A custom category that was never given a group: ask once, ever, per category.
  useEffect(() => {
    if (introSeen !== true || !db || !snapshot?.result || householdVisible || promptedGroupRef.current) return;

    const ungrouped = snapshot.result.categories
      .filter((item) => item.amount > 0 && !(item.category in snapshot.input.categoryGroups))
      .map((item) => item.category);
    if (ungrouped.length === 0) return;

    promptedGroupRef.current = true;
    let active = true;
    (async () => {
      let prompted: string[] = [];
      try {
        const parsed: unknown = JSON.parse((await getAppMeta(db, groupPromptKey(profileId))) ?? '[]');
        if (Array.isArray(parsed)) prompted = parsed.filter((name): name is string => typeof name === 'string');
      } catch {}

      const category = ungrouped.find((name) => !prompted.includes(name));
      if (!category) return;
      if (!active) {
        // The screen reloaded while reading; let the next pass ask instead of losing the prompt.
        promptedGroupRef.current = false;
        return;
      }

      // Shown first, recorded after: a category is only marked as asked once the question was on screen.
      Alert.alert(t('health.groupPrompt.title'), t('health.groupPrompt.message', { category: categoryName(category) }), [
        { text: t('common.notNow'), style: 'cancel' },
        { text: t('health.groupPrompt.pick'), onPress: () => setGroupCategory(category) },
      ]);
      await setAppMeta(db, groupPromptKey(profileId), JSON.stringify([...prompted, category]));
    })().catch((error) => console.error('Failed to prompt for a benchmark group:', error));

    return () => {
      active = false;
    };
  }, [introSeen, db, snapshot, householdVisible, profileId, t, categoryName]);

  const handleSaveHousehold = async (next: Household) => {
    if (readOnly) return;
    try {
      await saveHousehold(db, profileId, next);
      setHouseholdVisible(false);
      await load();
    } catch (error) {
      console.error('Failed to save household:', error);
      Alert.alert(t('common.error'));
    }
  };

  const handleSelectGroup = async (group: BenchmarkGroupId) => {
    const category = groupCategory;
    setGroupCategory(null);
    if (!category) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      await setCategoryBenchmarkGroup(db, profileId, category, group);
      await load();
    } catch (error) {
      console.error('Failed to set benchmark group:', error);
    }
  };

  const handleFine = async (item: CategoryStatus) => {
    if (item.pct === null) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await setRangeOverride(db, profileId, item.category, {
        min: round1(item.pct * (1 - FINE_MARGIN)),
        max: round1(item.pct * (1 + FINE_MARGIN)),
      });
      await load();
    } catch (error) {
      console.error('Failed to save range override:', error);
    }
  };

  const handleResetRange = async (item: CategoryStatus) => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await clearRangeOverride(db, profileId, item.category);
      await load();
    } catch (error) {
      console.error('Failed to reset range override:', error);
    }
  };

  const handleCategoryLongPress = (item: CategoryStatus) => {
    // Ranges and groups are settings of the profile: not on a read-only one.
    if (!guardWrite()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const actions: { label: string; run: () => void }[] = [];
    if (item.pct !== null && item.amount > 0) actions.push({ label: t('health.action.fine'), run: () => handleFine(item) });
    if (item.overridden) actions.push({ label: t('health.action.reset'), run: () => handleResetRange(item) });
    actions.push({ label: t('health.action.changeGroup'), run: () => setGroupCategory(item.category) });

    const title = categoryName(item.category);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, options: [...actions.map((action) => action.label), t('common.cancel')], cancelButtonIndex: actions.length },
        (index) => actions[index]?.run()
      );
      return;
    }
    // Android alerts take three buttons at most, so there is no Cancel button: a tap outside closes it.
    const buttons: AlertButton[] = actions.map((action) => ({ text: action.label, onPress: action.run }));
    Alert.alert(title, undefined, buttons, { cancelable: true });
  };

  const loadList = async (category: string) => {
    const [items, fixed] = await Promise.all([
      getTransactionsByMonthAndCategory(db, month, category, profileId),
      getCategoryFixedVsFlexibleSummary(db, month, category, profileId),
    ]);
    setListTransactions(items || []);
    setListSummary(fixed);
  };

  const handleCategoryPress = async (item: CategoryStatus) => {
    if (!db || !month) return;
    Haptics.selectionAsync().catch(() => {});
    setListCategory(item.category);
    setListTransactions([]);
    setListVisible(true);
    try {
      setLoadingList(true);
      await loadList(item.category);
    } catch (error) {
      console.error(`Failed to load ${item.category} transactions:`, error);
    } finally {
      setLoadingList(false);
    }
  };

  const openDetail = async (trx: Transaction) => {
    setSelectedTransaction(trx);
    const explanation = await getTransactionFixedExplanation(db, trx, profileId);
    setFixedState(explanation.state);
    setFixedAuto(explanation);
  };

  const handleSelectFromList = (trx: Transaction) => {
    setListVisible(false);
    setTimeout(() => openDetail(trx), 250);
  };

  const handleBackFromDetail = () => {
    setSelectedTransaction(null);
    setTimeout(() => setListVisible(true), 250);
  };

  const refreshAfterDetailChange = async () => {
    if (listCategory) await loadList(listCategory);
    await load();
  };

  const handleSelectFixedState = async (newState: FixedOverrideState) => {
    if (!selectedTransaction) return;
    setFixedState(newState);
    const keyword =
      selectedTransaction.merchant !== 'Unknown' ? selectedTransaction.merchant : selectedTransaction.rawDescription;

    try {
      await setMerchantFixedOverride(db, keyword, selectedTransaction.category, newState, profileId);
      let isFixed: number | null = fixedAuto.autoIsFixed ? 1 : 0;
      if (newState === 'FIXED') isFixed = 1;
      if (newState === 'FLEXIBLE') isFixed = 0;
      setSelectedTransaction((prev) => (prev ? { ...prev, is_fixed: isFixed } : null));
      await refreshAfterDetailChange();
    } catch (error) {
      console.error('Failed to update fixed state override:', error);
    }
  };

  const handleCategoryChanged = async (updated: Transaction) => {
    setSelectedTransaction(updated);
    try {
      const explanation = await getTransactionFixedExplanation(db, updated, profileId);
      setFixedState(explanation.state);
      setFixedAuto(explanation);
      await refreshAfterDetailChange();
    } catch (error) {
      console.error('Failed to refresh after category change:', error);
    }
  };

  const openReport = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: '/health-report', params: month ? { month } : {} });
  };

  const cardStyle = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }];
  const monthLabel = month ? format.monthYear(month) : '';
  const score = result?.score ?? null;
  const ringColor = scoreColor(score, colors);
  const detectedIncome = result && result.income.source === 'detected' ? result.income.value : null;
  const spendingRows = result ? result.categories : [];

  if (introSeen === false && !locked) {
    return <HealthIntro actionLabel={t('health.intro.start')} onDone={handleIntroDone} />;
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.introLink}
            onPress={() => setIntroVisible(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('health.intro.modalTitle')}
          >
            <Ionicons name="help-circle-outline" size={16} color={colors.accent} />
            <Text style={[styles.introLinkText, { color: colors.accent }]}>{t('freedom.howItWorks')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.optionsBtn, { backgroundColor: colors.surface }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setOptionsVisible(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('freedom.moreOptions')}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {locked && (
          <Pressable onPress={() => openPaywall('health')} accessibilityRole="button">
            {/* "Renew" only fits someone who set the feature up before. */}
            <ReadOnlyNote text={snapshot && !household ? t('pro.locked.note') : undefined} />
          </Pressable>
        )}

        <AlertsStrip />

        {!snapshot || introSeen === null ? (
          <ActivityIndicator size="small" color={colors.accent} style={styles.loading} />
        ) : !result ? (
          <View style={cardStyle}>
            <SelectableText style={[styles.emptyText, { color: colors.textSecondary }]}>{t('health.notEnough')}</SelectableText>
          </View>
        ) : (
          <>
            <View style={[cardStyle, styles.hero]}>
              <SelectableText style={[styles.month, { color: colors.textSecondary }]}>{monthLabel}</SelectableText>

              {score !== null ? (
                <>
                  <ScoreRing score={score} size={156} strokeWidth={12} color={ringColor} trackColor={colors.track} animated>
                    <SelectableText
                      style={[styles.score, { color: colors.text }]}
                      accessibilityLabel={t('health.scoreOf', { score })}
                      maxFontSizeMultiplier={1.4}
                    >
                      {score}
                    </SelectableText>
                  </ScoreRing>
                  <SelectableText style={[styles.level, { color: ringColor }]}>{t(levelKey(score))}</SelectableText>
                  {snapshot.previous ? (
                    <SelectableText style={[styles.delta, { color: colors.textSecondary }]}>
                      {score === snapshot.previous.score
                        ? t('health.delta.same', { month: format.monthYear(snapshot.previous.month) })
                        : t(score > snapshot.previous.score ? 'health.delta.a11yUp' : 'health.delta.a11yDown', {
                            points: Math.abs(score - snapshot.previous.score),
                            month: format.monthYear(snapshot.previous.month),
                          })}
                    </SelectableText>
                  ) : null}
                  {result.partial ? (
                    <SelectableText style={[styles.note, { color: colors.textSecondary }]}>{t('health.partial')}</SelectableText>
                  ) : null}

                  <View style={[styles.improveBox, { backgroundColor: colors.tintBackground }]}>
                    <SelectableText style={[styles.improveLabel, { color: colors.accent }]}>{t('health.biggest')}</SelectableText>
                    <SelectableText style={[styles.improveText, { color: colors.text }]}>
                      {result.improvement
                        ? t(result.improvement.message.key, result.improvement.message.params)
                        : t('health.allGood')}
                    </SelectableText>
                  </View>

                  <SelectableText style={[styles.explain, { color: colors.textSecondary }]}>{t('health.explain')}</SelectableText>
                </>
              ) : (
                <>
                  <SelectableText style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {result.income.source === 'none' ? t('health.noIncome') : t('health.notEnough')}
                  </SelectableText>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
                    onPress={() => guardWrite(() => setHouseholdVisible(true))}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>{t('health.addIncome')}</Text>
                  </TouchableOpacity>
                </>
              )}

              <SelectableText style={[styles.disclaimer, { color: colors.textSecondary }]}>{t('health.disclaimer')}</SelectableText>
            </View>

            {snapshot.forecast ? (
              <View style={cardStyle}>
                <ForecastCard forecast={snapshot.forecast} />
              </View>
            ) : null}

            {score !== null ? (
              <View style={cardStyle}>
                <SelectableText style={[styles.sectionTitle, { color: colors.text }]}>{t('health.pillars')}</SelectableText>
                {result.pillars.map((pillar) => (
                  <PillarRow key={pillar.id} pillar={pillar} onAddBuffer={() => guardWrite(() => setHouseholdVisible(true))} />
                ))}
              </View>
            ) : null}

            <View style={cardStyle}>
              <SelectableText style={[styles.sectionTitle, { color: colors.text }]}>{t('health.categories')}</SelectableText>
              <SelectableText style={[styles.hint, { color: colors.textSecondary }]}>{t('health.categories.hint')}</SelectableText>
              {spendingRows.length === 0 ? (
                <SelectableText style={[styles.emptyText, { color: colors.textSecondary }]}>{t('health.category.empty')}</SelectableText>
              ) : (
                spendingRows.map((item) => (
                  <CategoryRangeRow
                    key={item.category}
                    item={item}
                    onPress={handleCategoryPress}
                    onLongPress={handleCategoryLongPress}
                  />
                ))
              )}
            </View>

            {/* TODO(pro): score history is a Pro item (flag `healthFull`, a placeholder for now); gate it with useEntitlement().can(). */}
            <View style={cardStyle}>
              <SelectableText style={[styles.sectionTitle, { color: colors.text }]}>{t('health.history')}</SelectableText>
              <ScoreHistoryChart points={snapshot.history} />
            </View>

            <TouchableOpacity
              style={[cardStyle, styles.linkRow]}
              activeOpacity={0.8}
              onPress={openReport}
              accessibilityRole="button"
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="document-text-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.linkText, { color: colors.text }]}>{t('health.openReport')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <HealthOptionsSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        household={household}
        onEditHousehold={() => {
          // Let the sheet go before the household sheet is presented.
          setOptionsVisible(false);
          setTimeout(() => setHouseholdVisible(true), 250);
        }}
        onRangesReset={load}
      />

      <HouseholdSheet
        visible={householdVisible}
        household={household}
        detectedIncome={detectedIncome}
        onSave={handleSaveHousehold}
        onClose={() => setHouseholdVisible(false)}
      />

      <BenchmarkGroupSheet
        category={groupCategory}
        selected={groupCategory ? snapshot?.input.categoryGroups[groupCategory] ?? null : null}
        household={household}
        onSelect={handleSelectGroup}
        onClose={() => setGroupCategory(null)}
      />

      <TransactionListModal
        visible={listVisible}
        listType="EXPENSE"
        selectedMonth={month}
        monthNames={{ [month]: listCategory ? `${categoryName(listCategory)} · ${monthLabel}` : monthLabel }}
        transactions={listTransactions}
        loading={loadingList}
        fixedSummary={listSummary}
        onClose={() => setListVisible(false)}
        onSelectTransaction={handleSelectFromList}
      />

      <TransactionDetailModal
        visible={selectedTransaction !== null}
        transaction={selectedTransaction}
        fixedState={fixedState}
        autoIsFixed={fixedAuto.autoIsFixed}
        autoReason={fixedAuto.reason}
        parentTitle={listCategory ? categoryName(listCategory) : t('health.title')}
        onClose={handleBackFromDetail}
        onDismiss={() => setSelectedTransaction(null)}
        onSelectFixedState={handleSelectFixedState}
        onCategoryChanged={handleCategoryChanged}
      />

      <HealthIntroModal visible={introVisible} onClose={() => setIntroVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  // On the right, like the Future Growth segment; the ⋯ button closes the row.
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 12 },
  introLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  optionsBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  introLinkText: { fontSize: 13, fontWeight: '600' },
  loading: { marginTop: 40 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  hero: { alignItems: 'center' },
  month: { fontSize: 13, fontWeight: '600', marginBottom: 12 },
  score: { fontSize: 48, fontWeight: '800', letterSpacing: -1.5 },
  level: { fontSize: 17, fontWeight: '700', marginTop: 12 },
  delta: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  note: { fontSize: 12, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  improveBox: { alignSelf: 'stretch', borderRadius: 12, padding: 12, marginTop: 16 },
  improveLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 4 },
  improveText: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  explain: { fontSize: 13, lineHeight: 19, marginTop: 14, alignSelf: 'stretch' },
  disclaimer: { fontSize: 11, marginTop: 12, textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: 8 },
  primaryBtn: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  linkText: { flex: 1, fontSize: 15, fontWeight: '600' },
});
