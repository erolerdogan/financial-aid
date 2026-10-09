import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { DebtsCard } from '@/components/dashboard/DebtsCard';
import { FreedomCard } from '@/components/dashboard/FreedomCard';
import { MonthStepper } from '@/components/dashboard/MonthStepper';
import { RecentActivityCard } from '@/components/dashboard/RecentActivityCard';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { HeaderActions } from '@/components/HeaderActions';
import { DateRangeModal } from '@/components/modals/DateRangeModal';
import { QuickCategoriseSheet } from '@/components/modals/QuickCategoriseSheet';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { TransactionListModal } from '@/components/modals/TransactionListModal';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { usePeriod } from '@/contexts/PeriodContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CategoryTotal,
  FixedCostSummary,
  FixedOverrideState,
  getAvailableMonths,
  getCategoryFixedVsFlexibleSummary,
  getCategoryGoals,
  getFilteredTransactions,
  getFixedOrFlexibleTransactions,
  getFixedVsFlexibleSummary,
  getIncomeFixedVsFlexibleSummary,
  getMonthlyCategoryTotals,
  getMonthlySummary,
  getRecentTransactions,
  getTransactionDateBounds,
  getTransactionFixedExplanation,
  getTransactionsByMonthAndCategory,
  makeRangeKey,
  MonthlySummary,
  setMerchantFixedOverride,
  Transaction
} from '@/db/database';
import { useQuickCategorise } from '@/hooks/useQuickCategorise';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import type { Message, TranslationKey } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useProfile } from '../../contexts/ProfileContext';

const NO_MONTHS: string[] = [];
const NO_BUDGETS: Record<string, number> = {};

const getCurrentMonthKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

interface MonthCoverageStatus {
  status: 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'EMPTY';
  minDate?: string;
  maxDate?: string;
}

const COVERAGE_LABELS: Record<MonthCoverageStatus['status'], TranslationKey | null> = {
  IN_PROGRESS: 'coverage.inProgress',
  PARTIAL: 'coverage.partial',
  COMPLETE: 'coverage.full',
  EMPTY: null,
};

type ListType = 'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE';

const LIST_TITLES: Record<ListType, TranslationKey> = {
  INCOME: 'list.income',
  EXPENSE: 'list.expense',
  FIXED: 'list.fixed',
  FLEXIBLE: 'list.flexible',
};

export default function DashboardScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format, categoryName } = useI18n();

  const { activeProfile, dataVersion, refreshProfiles } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;
  const { period, setPeriod } = usePeriod();

  const { importStatement, importing, importDisabled } = useStatementImporter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [rangeModalVisible, setRangeModalVisible] = useState(false);

  // Transaction list sheet (cards and categories) and the detail opened from it
  const [listModalVisible, setListModalVisible] = useState(false);
  const [listModalType, setListModalType] = useState<ListType>('EXPENSE');
  const [listModalCategory, setListModalCategory] = useState<string | null>(null);
  const [listModalTransactions, setListModalTransactions] = useState<Transaction[]>([]);
  const [listModalSummary, setListModalSummary] = useState<FixedCostSummary | undefined>(undefined);
  const [loadingListModal, setLoadingListModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [currentFixedState, setCurrentFixedState] = useState<FixedOverrideState>('AUTO');
  const [fixedAuto, setFixedAuto] = useState<{ autoIsFixed: boolean; reason: Message[] }>({ autoIsFixed: false, reason: [] });
  // False when the detail was opened from an expanded category row instead of the list sheet.
  const [detailFromList, setDetailFromList] = useState(true);

  // Category expanded inline in the allocation card; only valid for the period and profile it was opened in.
  const [expanded, setExpanded] = useState<{ scope: string; category: string } | null>(null);
  const [expandedTransactions, setExpandedTransactions] = useState<Transaction[]>([]);
  const [loadingExpanded, setLoadingExpanded] = useState(false);

  // Filters & State
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [dateBounds, setDateBounds] = useState<{ minDate: string; maxDate: string } | null>(null);
  const [coverageStatus, setCoverageStatus] = useState<MonthCoverageStatus>({
    status: 'EMPTY',
  });

  // Dashboard Data
  const [summary, setSummary] = useState<MonthlySummary>({
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
  });
  const [categoryData, setCategoryData] = useState<CategoryTotal[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>(NO_BUDGETS);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  const currentMonthKey = getCurrentMonthKey();

  // Nothing picked yet (or the picked month has no data): show the latest month.
  const rangeFilter = period.kind === 'RANGE' ? period : null;
  const selectedMonth =
    period.kind === 'MONTH' && availableMonths.includes(period.month)
      ? period.month
      : availableMonths[0] ?? '';

  // A "period" is either a month key (2026-03) or a date range key (2026-03-05..2026-04-10)
  const periodKey = rangeFilter ? makeRangeKey(rangeFilter.from, rangeFilter.to) : selectedMonth;

  const periodNames = useMemo<Record<string, string>>(() => {
    const names: Record<string, string> = {};
    availableMonths.forEach((m) => {
      names[m] = format.monthYear(m);
    });
    if (rangeFilter) {
      names[makeRangeKey(rangeFilter.from, rangeFilter.to)] = format.range(rangeFilter.from, rangeFilter.to);
    }
    return names;
  }, [availableMonths, rangeFilter, format]);

  const loadDashboardData = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);

      const [dbMonths, bounds] = await Promise.all([
        getAvailableMonths(db, activeProfileId),
        getTransactionDateBounds(db, activeProfileId),
      ]);
      setAvailableMonths(dbMonths);
      setDateBounds(bounds);

      if (dbMonths.length === 0) {
        setCoverageStatus({ status: 'EMPTY' });
        setSummary({ totalIncome: 0, totalExpenses: 0, netSavings: 0 });
        setCategoryData([]);
        setRecentTransactions([]);
        return;
      }

      const activeMonth =
        period.kind === 'MONTH' && dbMonths.includes(period.month) ? period.month : dbMonths[0];
      const activeRange = period.kind === 'RANGE' ? period : null;
      const activePeriod = activeRange ? makeRangeKey(activeRange.from, activeRange.to) : activeMonth;

      const [summaryRes, categoryRes, goalsRes, recentRes, dateRangeRes] =
        await Promise.all([
          getMonthlySummary(db, activePeriod, activeProfileId),
          getMonthlyCategoryTotals(db, activePeriod, activeProfileId),
          getCategoryGoals(db, activeProfileId),
          getRecentTransactions(db, activePeriod, activeProfileId),
          activeRange
            ? Promise.resolve(null)
            : db.getFirstAsync<{ minDate: string; maxDate: string }>(
                `SELECT MIN(date) as minDate, MAX(date) as maxDate FROM transactions WHERE monthName = ? AND profileId = ?;`,
                [activeMonth, activeProfileId]
              ),
        ]);

      setSummary(summaryRes);
      setCategoryData(categoryRes || []);
      setBudgets(goalsRes);
      setRecentTransactions(recentRes);

      if (activeRange) {
        setCoverageStatus({ status: 'EMPTY' });
      } else if (!dateRangeRes || !dateRangeRes.minDate) {
        setCoverageStatus({ status: 'EMPTY' });
      } else {
        const isCurrentMonth = activeMonth === currentMonthKey;
        const maxDay = parseInt(dateRangeRes.maxDate.slice(-2), 10);

        if (isCurrentMonth) {
          setCoverageStatus({
            status: 'IN_PROGRESS',
            minDate: dateRangeRes.minDate,
            maxDate: dateRangeRes.maxDate,
          });
        } else if (maxDay < 25) {
          setCoverageStatus({
            status: 'PARTIAL',
            minDate: dateRangeRes.minDate,
            maxDate: dateRangeRes.maxDate,
          });
        } else {
          setCoverageStatus({
            status: 'COMPLETE',
            minDate: dateRangeRes.minDate,
            maxDate: dateRangeRes.maxDate,
          });
        }
      }
    } catch (error) {
      console.error('Failed to query dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, period, activeProfileId, currentMonthKey]);

  // Execute directly on screen mount/focus without checking activeProfile?.id
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion is listed on purpose: reload when stored data changes
    }, [loadDashboardData, dataVersion])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfiles();
    await loadDashboardData();
  };

  const currentIndex = availableMonths.indexOf(selectedMonth);

  const handlePrevMonth = () => {
    if (rangeFilter) return;
    if (currentIndex < availableMonths.length - 1) {
      setPeriod({ kind: 'MONTH', month: availableMonths[currentIndex + 1] });
    }
  };

  const handleNextMonth = () => {
    if (rangeFilter) return;
    if (currentIndex > 0) {
      setPeriod({ kind: 'MONTH', month: availableMonths[currentIndex - 1] });
    }
  };

  const handlePickMonth = (month: string) => {
    setPeriod({ kind: 'MONTH', month });
    setMonthPickerVisible(false);
  };

  const handleOpenRangePicker = () => {
    setMonthPickerVisible(false);
    setTimeout(() => setRangeModalVisible(true), 250);
  };

  const handleApplyRange = (from: string, to: string) => {
    setPeriod({ kind: 'RANGE', from, to });
    setRangeModalVisible(false);
  };

  const expandedScope = `${activeProfileId}:${periodKey}`;
  const expandedCategory = expanded?.scope === expandedScope ? expanded.category : null;

  const handleCategoryPress = async (category: string) => {
    if (!db) return;
    Haptics.selectionAsync().catch(() => {});
    if (expandedCategory === category) {
      setExpanded(null);
      return;
    }
    setExpanded({ scope: expandedScope, category });
    quickAdd.reloadCount();
    setExpandedTransactions([]);
    try {
      setLoadingExpanded(true);
      const items = await getTransactionsByMonthAndCategory(db, periodKey, category, activeProfileId);
      setExpandedTransactions(items || []);
    } catch (error) {
      console.error(`Failed to load ${category} transactions:`, error);
    } finally {
      setLoadingExpanded(false);
    }
  };

  const openDetail = async (trx: Transaction) => {
    setSelectedTransaction(trx);
    if (db) {
      const explanation = await getTransactionFixedExplanation(db, trx, activeProfileId);
      setCurrentFixedState(explanation.state);
      setFixedAuto(explanation);
    }
  };

  const handleSelectFromCategory = (trx: Transaction) => {
    setDetailFromList(false);
    openDetail(trx);
  };

  const handleSeeAllTransactions = () => {
    Haptics.selectionAsync().catch(() => {});
    // With nothing picked Home shows the latest month but Transactions would list everything; pin the shown month.
    if (!rangeFilter && selectedMonth && !(period.kind === 'MONTH' && period.month === selectedMonth)) {
      setPeriod({ kind: 'MONTH', month: selectedMonth });
    }
    router.push('/transactions');
  };

  const loadListModal = async (type: ListType, category: string | null) => {
    if (!db) return;
    const byAmount = (items: Transaction[]) =>
      [...items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    if (category) {
      const [items, fixed] = await Promise.all([
        getTransactionsByMonthAndCategory(db, periodKey, category, activeProfileId),
        getCategoryFixedVsFlexibleSummary(db, periodKey, category, activeProfileId),
      ]);
      setListModalTransactions(items || []);
      setListModalSummary(fixed);
      return;
    }

    const [items, fixed] = await Promise.all([
      type === 'FIXED' || type === 'FLEXIBLE'
        ? getFixedOrFlexibleTransactions(db, periodKey, type === 'FIXED', activeProfileId)
        : getFilteredTransactions(db, periodKey, type, activeProfileId),
      type === 'INCOME'
        ? getIncomeFixedVsFlexibleSummary(db, periodKey, activeProfileId)
        : getFixedVsFlexibleSummary(db, periodKey, activeProfileId),
    ]);
    setListModalTransactions(byAmount(items || []));
    setListModalSummary(fixed);
  };

  const openListModal = async (type: ListType, category: string | null = null) => {
    Haptics.selectionAsync().catch(() => {});
    setListModalType(type);
    setListModalCategory(category);
    setListModalTransactions([]);
    setListModalVisible(true);
    try {
      setLoadingListModal(true);
      await loadListModal(type, category);
    } catch (error) {
      console.error(`Failed to load ${type} list:`, error);
    } finally {
      setLoadingListModal(false);
    }
  };

  const handleSelectFromList = (trx: Transaction) => {
    setListModalVisible(false);
    setDetailFromList(true);
    setTimeout(() => openDetail(trx), 250);
  };

  const handleBackFromDetail = () => {
    setSelectedTransaction(null);
    if (detailFromList) setTimeout(() => setListModalVisible(true), 250);
  };

  const refreshAfterDetailChange = async () => {
    if (detailFromList) await loadListModal(listModalType, listModalCategory);
    if (db && expandedCategory) {
      const items = await getTransactionsByMonthAndCategory(db, periodKey, expandedCategory, activeProfileId);
      setExpandedTransactions(items || []);
    }
    await loadDashboardData();
  };

  const quickAdd = useQuickCategorise({ onMoved: () => refreshAfterDetailChange() });

  const handleSelectFixedState = async (newState: FixedOverrideState) => {
    if (!db || !selectedTransaction) return;
    setCurrentFixedState(newState);

    const keyword =
      selectedTransaction.merchant !== 'Unknown'
        ? selectedTransaction.merchant
        : selectedTransaction.rawDescription;

    try {
      await setMerchantFixedOverride(db, keyword, selectedTransaction.category, newState, activeProfileId);

      // Back to automatic: list badges show what detection decides.
      let isFixed: number | null = fixedAuto.autoIsFixed ? 1 : 0;
      if (newState === 'FIXED') isFixed = 1;
      if (newState === 'FLEXIBLE') isFixed = 0;
      setSelectedTransaction((prev) => (prev ? { ...prev, is_fixed: isFixed } : null));

      // The override applies to every row the keyword matches, so reload instead of patching by name.
      await refreshAfterDetailChange();
    } catch (error) {
      console.error('Failed to update fixed state override:', error);
    }
  };

  const handleCategoryChanged = async (updated: Transaction) => {
    setSelectedTransaction(updated);
    if (!db) return;

    try {
      const explanation = await getTransactionFixedExplanation(db, updated, activeProfileId);
      setCurrentFixedState(explanation.state);
      setFixedAuto(explanation);
      // Category feeds the fixed score, so badges can change with it.
      await refreshAfterDetailChange();
    } catch (error) {
      console.error('Failed to refresh after category change:', error);
    }
  };

  const listModalNames = listModalCategory
    ? { ...periodNames, [periodKey]: `${categoryName(listModalCategory)} · ${periodNames[periodKey] ?? periodKey}` }
    : periodNames;

  // '2026-09-01', '2026-09-28' → '1 – 28 Sep'
  const coverageKey = COVERAGE_LABELS[coverageStatus.status];
  const coverageLabel =
    coverageKey && coverageStatus.minDate && coverageStatus.maxDate
      ? t(coverageKey, {
          range: `${Number(coverageStatus.minDate.slice(8, 10))} – ${format.day(coverageStatus.maxDate, false)}`,
        })
      : '';

  const totalTransactions = categoryData.reduce((a, b) => a + (b.count || 0), 0);

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Top Header Bar */}
        <View style={styles.headerRow}>
          <SelectableText style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>{t('tabs.home')}</SelectableText>
          <HeaderActions />
        </View>

        {/* Empty Workspace View vs Main Dashboard */}
        {availableMonths.length === 0 ? (
          loading ? null : (
            <View style={[styles.emptyHeroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="wallet-outline" size={32} color={colors.accent} />
              </View>
              <SelectableText style={[styles.emptyHeroTitle, { color: colors.text }]}>
                {t('home.emptyTitle', { name: activeProfile?.name || t('home.thisProfile') })}
              </SelectableText>
              <SelectableText style={[styles.emptyHeroSubtitle, { color: colors.textSecondary }]}>
                {t('home.emptySubtitle')}
              </SelectableText>

              <View style={styles.emptyActionStack}>
                <TouchableOpacity
                  style={[
                    styles.primaryImportBtn,
                    { backgroundColor: colors.accent },
                    importDisabled && styles.primaryImportBtnDisabled,
                  ]}
                  onPress={importStatement}
                  disabled={importing || importDisabled}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  {importing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="download-outline" size={18} color="#FFF" />
                  )}
                  <Text style={styles.primaryImportText}>
                    {importing ? t('welcome.processing') : t('welcome.import')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.guideLink}
                  onPress={() => router.push('/export-guide')}
                  disabled={importing}
                  activeOpacity={0.7}
                  accessibilityRole="link"
                >
                  <Ionicons name="help-circle-outline" size={16} color={colors.accent} />
                  <Text style={[styles.guideLinkText, { color: colors.accent }]}>{t('guide.link')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        ) : (
          <>
            <MonthStepper
              selectedMonth={periodKey}
              availableMonths={rangeFilter ? NO_MONTHS : availableMonths}
              monthNames={periodNames}
              coverageStatus={{ ...coverageStatus, label: coverageLabel }}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onOpenMonthPicker={() => setMonthPickerVisible(true)}
            />

            <SummaryCards
              summary={summary}
              totalTransactions={totalTransactions}
              categoryCount={categoryData.length}
              onPressCard={openListModal}
            />

            <AllocationChart
              categoryData={categoryData}
              budgets={rangeFilter ? NO_BUDGETS : budgets}
              expandedCategory={expandedCategory}
              expandedTransactions={expandedTransactions}
              loadingTransactions={loadingExpanded}
              onCategoryPress={handleCategoryPress}
              onSelectTransaction={handleSelectFromCategory}
              onOpenBudgets={() => router.push('/goals')}
              uncategorisedCount={quickAdd.canAdd(expandedCategory) ? quickAdd.count : 0}
              onAddUncategorised={quickAdd.open}
            />

            <RecentActivityCard
              transactions={recentTransactions}
              onSelectTransaction={handleSelectFromCategory}
              onSeeAll={handleSeeAllTransactions}
            />

            <DebtsCard />

            <FreedomCard />
          </>
        )}
      </ScrollView>

      <TransactionListModal
        visible={listModalVisible}
        listType={listModalType}
        selectedMonth={periodKey}
        monthNames={listModalNames}
        transactions={listModalTransactions}
        loading={loadingListModal}
        fixedSummary={listModalSummary}
        onClose={() => setListModalVisible(false)}
        onSelectTransaction={handleSelectFromList}
      />

      <QuickCategoriseSheet {...quickAdd.sheetProps} />

      <TransactionDetailModal
        visible={selectedTransaction !== null}
        transaction={selectedTransaction}
        fixedState={currentFixedState}
        autoIsFixed={fixedAuto.autoIsFixed}
        autoReason={fixedAuto.reason}
        parentTitle={
          detailFromList
            ? listModalCategory
              ? categoryName(listModalCategory)
              : t(LIST_TITLES[listModalType])
            : t('tabs.home')
        }
        onClose={handleBackFromDetail}
        onDismiss={() => setSelectedTransaction(null)}
        onSelectFixedState={handleSelectFixedState}
        onCategoryChanged={handleCategoryChanged}
      />

      <DateRangeModal
        visible={rangeModalVisible}
        minDate={dateBounds?.minDate ?? null}
        maxDate={dateBounds?.maxDate ?? null}
        initialFrom={rangeFilter?.from ?? null}
        initialTo={rangeFilter?.to ?? null}
        onApply={handleApplyRange}
        onClose={() => setRangeModalVisible(false)}
      />

      <Modal visible={monthPickerVisible} transparent animationType="slide" onRequestClose={() => setMonthPickerVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          accessible={false}
          onPress={() => setMonthPickerVisible(false)}
        >
          <TouchableWithoutFeedback accessible={false}>
            <View
              style={[styles.sheetContainer, { backgroundColor: colors.card }]}
              onAccessibilityEscape={() => setMonthPickerVisible(false)}
            >
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                <SelectableText style={[styles.sheetTitle, { color: colors.text }]}>{t('period.select')}</SelectableText>
              </View>
              <ScrollView style={{ maxHeight: 360 }}>
                <TouchableOpacity
                  style={[
                    styles.sheetItem,
                    { borderBottomColor: colors.border },
                    rangeFilter !== null && [
                      styles.sheetItemActive,
                      { backgroundColor: colors.tintBackground },
                    ],
                  ]}
                  onPress={handleOpenRangePicker}
                  accessibilityRole="button"
                >
                  <View style={styles.sheetItemLeft}>
                    <Ionicons name="calendar-outline" size={18} color={colors.accent} />
                    <Text
                      style={[
                        styles.sheetItemText,
                        { color: rangeFilter ? colors.accent : colors.text },
                        rangeFilter !== null && styles.sheetItemTextActive,
                      ]}
                    >
                      {t('period.customRange')}
                    </Text>
                  </View>
                  {rangeFilter ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>

                {availableMonths.map((m) => {
                  const isSelected = !rangeFilter && selectedMonth === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.sheetItem,
                        { borderBottomColor: colors.border },
                        isSelected && [
                          styles.sheetItemActive,
                          { backgroundColor: colors.tintBackground },
                        ],
                      ]}
                      onPress={() => handlePickMonth(m)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.sheetItemText,
                          { color: colors.text },
                          isSelected && [styles.sheetItemTextActive, { color: colors.accent }],
                        ]}
                      >
                        {periodNames[m] || m}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 0, paddingBottom: 100 },
  headerRow: {
    marginTop: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  sheetHeader: { alignItems: 'center', marginBottom: 16 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetItemActive: { borderRadius: 12 },
  sheetItemText: { fontSize: 16, fontWeight: '500' },
  sheetItemTextActive: { fontWeight: '700' },

  emptyHeroCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginTop: 32,
    marginHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyHeroTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHeroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  emptyActionStack: {
    width: '100%',
    gap: 12,
  },
  primaryImportBtnDisabled: { opacity: 0.4 },
  primaryImportBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryImportText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  guideLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  guideLinkText: { fontSize: 15, fontWeight: '600' },
});