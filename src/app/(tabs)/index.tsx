import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { MonthStepper } from '@/components/dashboard/MonthStepper';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { DateRangeModal } from '@/components/modals/DateRangeModal';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { TransactionListModal } from '@/components/modals/TransactionListModal';
import { ProfileSwitcherModal } from '@/components/ProfileSwitcherModal';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ImportSummaryHost } from '@/contexts/ImportResultContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CategoryTotal,
  FixedCostSummary,
  FixedOverrideState,
  getAvailableMonths,
  getFilteredTransactions,
  getFixedOrFlexibleTransactions,
  getFixedVsFlexibleSummary,
  getIncomeFixedVsFlexibleSummary,
  getMonthlyCategoryTotals,
  getMonthlySummary,
  getTransactionDateBounds,
  getTransactionFixedExplanation,
  getTransactionsByMonthAndCategory,
  makeRangeKey,
  MonthlySummary,
  setMerchantFixedOverride,
  Transaction
} from '@/db/database';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import { Ionicons } from '@expo/vector-icons';
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

const MONTH_NAMES: Record<string, string> = {
  '2026-01': 'January 2026',
  '2026-02': 'February 2026',
  '2026-03': 'March 2026',
  '2026-04': 'April 2026',
  '2026-05': 'May 2026',
  '2026-06': 'June 2026',
  '2026-07': 'July 2026',
  '2026-08': 'August 2026',
  '2026-09': 'September 2026',
  '2026-10': 'October 2026',
  '2026-11': 'November 2026',
  '2026-12': 'December 2026',
};

const NO_MONTHS: string[] = [];

const getCurrentMonthKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatRangeLabel = (from: string, to: string): string => {
  const fmt = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-09-01', '2026-09-28' → '1 – 28 Sep'
const formatCoverageDays = (minDate: string, maxDate: string): string => {
  const month = SHORT_MONTHS[Number(maxDate.slice(5, 7)) - 1] ?? '';
  return `${Number(minDate.slice(8, 10))} – ${Number(maxDate.slice(8, 10))} ${month}`;
};

interface MonthCoverageStatus {
  status: 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'EMPTY';
  minDate?: string;
  maxDate?: string;
  label: string;
}

interface DateRangeFilter {
  from: string;
  to: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  
  const { activeProfile, dataVersion, refreshProfiles } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

  const { importStatement, importing } = useStatementImporter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals & Selection State
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [rangeModalVisible, setRangeModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [currentFixedState, setCurrentFixedState] = useState<FixedOverrideState>('AUTO');
  const [fixedAuto, setFixedAuto] = useState({ autoIsFixed: false, reason: '' });
  const [detailParentTitle, setDetailParentTitle] = useState<string>('Back');
  const [wasOpenedFromList, setWasOpenedFromList] = useState(false);

  // Card Modal State
  const [listModalVisible, setListModalVisible] = useState(false);
  const [listModalType, setListModalType] = useState<'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE'>('EXPENSE');
  const [listModalTransactions, setListModalTransactions] = useState<Transaction[]>([]);
  const [loadingListModal, setLoadingListModal] = useState(false);

  // Filters & State
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [rangeFilter, setRangeFilter] = useState<DateRangeFilter | null>(null);
  const [dateBounds, setDateBounds] = useState<{ minDate: string; maxDate: string } | null>(null);
  const [coverageStatus, setCoverageStatus] = useState<MonthCoverageStatus>({
    status: 'EMPTY',
    label: '',
  });

  // Dashboard Data
  const [incomeSummary, setIncomeSummary] = useState<FixedCostSummary>({
    fixedTotal: 0,
    flexibleTotal: 0,
    fixedPercentage: 0,
    flexiblePercentage: 0,
    fixedItemsCount: 0,
  });
  
  const [summary, setSummary] = useState<MonthlySummary>({
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
  });
  const [fixedSummary, setFixedSummary] = useState<FixedCostSummary>({
    fixedTotal: 0,
    flexibleTotal: 0,
    fixedPercentage: 0,
    flexiblePercentage: 0,
    fixedItemsCount: 0,
  });
  const [categoryData, setCategoryData] = useState<CategoryTotal[]>([]);
  const [selectedBarCategory, setSelectedBarCategory] = useState<string | null>(null);

  const [selectedCategoryTransactions, setSelectedCategoryTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const currentMonthKey = getCurrentMonthKey();

  // A "period" is either a month key (2026-03) or a date range key (2026-03-05..2026-04-10)
  const periodKey = rangeFilter ? makeRangeKey(rangeFilter.from, rangeFilter.to) : selectedMonth;

  const periodNames = useMemo<Record<string, string>>(() => {
    if (!rangeFilter) return MONTH_NAMES;
    return {
      ...MONTH_NAMES,
      [makeRangeKey(rangeFilter.from, rangeFilter.to)]: formatRangeLabel(
        rangeFilter.from,
        rangeFilter.to
      ),
    };
  }, [rangeFilter]);

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
        setCoverageStatus({ status: 'EMPTY', label: 'Statement Pending' });
        setSummary({ totalIncome: 0, totalExpenses: 0, netSavings: 0 });
        setCategoryData([]);
        setFixedSummary({
          fixedTotal: 0,
          flexibleTotal: 0,
          fixedPercentage: 0,
          flexiblePercentage: 0,
          fixedItemsCount: 0,
        });
        return;
      }

      const activeMonth = selectedMonth && dbMonths.includes(selectedMonth)
        ? selectedMonth
        : dbMonths[0];

      if (activeMonth !== selectedMonth) {
        setSelectedMonth(activeMonth);
      }

      const activePeriod = rangeFilter
        ? makeRangeKey(rangeFilter.from, rangeFilter.to)
        : activeMonth;

      const [summaryRes, categoryRes, fixedRes, incomeFixedRes, dateRangeRes] = await Promise.all([
        getMonthlySummary(db, activePeriod, activeProfileId),
        getMonthlyCategoryTotals(db, activePeriod, activeProfileId),
        getFixedVsFlexibleSummary(db, activePeriod, activeProfileId),
        getIncomeFixedVsFlexibleSummary(db, activePeriod, activeProfileId),
        rangeFilter
          ? Promise.resolve(null)
          : db.getFirstAsync<{ minDate: string; maxDate: string }>(
              `SELECT MIN(date) as minDate, MAX(date) as maxDate FROM transactions WHERE monthName = ? AND profileId = ?;`,
              [activeMonth, activeProfileId]
            ),
      ]);
      
      setSummary(summaryRes);
      setCategoryData(categoryRes || []);
      setFixedSummary(fixedRes);
      setIncomeSummary(incomeFixedRes);

      if (rangeFilter) {
        setCoverageStatus({ status: 'EMPTY', label: '' });
      } else if (!dateRangeRes || !dateRangeRes.minDate) {
        setCoverageStatus({ status: 'EMPTY', label: 'Statement Pending' });
      } else {
        const isCurrentMonth = activeMonth === currentMonthKey;
        const maxDay = parseInt(dateRangeRes.maxDate.slice(-2), 10);

        if (isCurrentMonth) {
          setCoverageStatus({
            status: 'IN_PROGRESS',
            minDate: dateRangeRes.minDate,
            maxDate: dateRangeRes.maxDate,
            label: `In Progress (${formatCoverageDays(dateRangeRes.minDate, dateRangeRes.maxDate)})`,
          });
        } else if (maxDay < 25) {
          setCoverageStatus({
            status: 'PARTIAL',
            minDate: dateRangeRes.minDate,
            maxDate: dateRangeRes.maxDate,
            label: `Partial Statement (${formatCoverageDays(dateRangeRes.minDate, dateRangeRes.maxDate)})`,
          });
        } else {
          setCoverageStatus({
            status: 'COMPLETE',
            minDate: dateRangeRes.minDate,
            maxDate: dateRangeRes.maxDate,
            label: `Full Statement (${formatCoverageDays(dateRangeRes.minDate, dateRangeRes.maxDate)})`,
          });
        }
      }
    } catch (error) {
      console.error('Failed to query dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, selectedMonth, rangeFilter, activeProfileId, currentMonthKey]);

  // Execute directly on screen mount/focus without checking activeProfile?.id
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData, dataVersion])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfiles();
    await loadDashboardData();
  };

  const resetCategorySelection = () => {
    setSelectedBarCategory(null);
    setSelectedCategoryTransactions([]);
  };

  const currentIndex = availableMonths.indexOf(selectedMonth);

  const handlePrevMonth = () => {
    if (rangeFilter) return;
    if (currentIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentIndex + 1]);
      resetCategorySelection();
    }
  };

  const handleNextMonth = () => {
    if (rangeFilter) return;
    if (currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1]);
      resetCategorySelection();
    }
  };

  const handlePickMonth = (month: string) => {
    setRangeFilter(null);
    setSelectedMonth(month);
    resetCategorySelection();
    setMonthPickerVisible(false);
  };

  const handleOpenRangePicker = () => {
    setMonthPickerVisible(false);
    setTimeout(() => setRangeModalVisible(true), 250);
  };

  const handleApplyRange = (from: string, to: string) => {
    setRangeFilter({ from, to });
    resetCategorySelection();
    setRangeModalVisible(false);
  };

  const handleSelectTransaction = async (trx: Transaction, customParentTitle?: string) => {
    setSelectedTransaction(trx);

    if (customParentTitle) {
      setDetailParentTitle(customParentTitle);
    } else if (selectedBarCategory) {
      setDetailParentTitle(selectedBarCategory);
    } else {
      setDetailParentTitle(trx.amount > 0 ? 'Income Items' : 'Expenses');
    }

    if (db && trx) {
      const explanation = await getTransactionFixedExplanation(db, trx, activeProfileId);
      setCurrentFixedState(explanation.state);
      setFixedAuto(explanation);
    }
  };

  const handleSelectFromFlatList = (trx: Transaction) => {
    const parentTitleMap: Record<string, string> = {
      INCOME: 'Income Items',
      EXPENSE: 'Expenses',
      FIXED: 'Fixed Transactions',
      FLEXIBLE: 'Flexible Transactions',
    };

    const parentTitle = parentTitleMap[listModalType] || 'Back';
    setWasOpenedFromList(true);
    setListModalVisible(false);

    setTimeout(() => {
      handleSelectTransaction(trx, parentTitle);
    }, 250);
  };

  const handleGoBackFromDetail = () => {
    setSelectedTransaction(null);
    if (wasOpenedFromList) {
      setWasOpenedFromList(false);
      setTimeout(() => {
        setListModalVisible(true);
      }, 250);
    }
  };

  const handleDismissDetailDirectly = () => {
    setWasOpenedFromList(false);
    setSelectedTransaction(null);
  };

  const fetchListModalItems = async (
    database: NonNullable<typeof db>,
    type: 'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE'
  ): Promise<Transaction[]> => {
    const items =
      type === 'FIXED' || type === 'FLEXIBLE'
        ? await getFixedOrFlexibleTransactions(database, periodKey, type === 'FIXED', activeProfileId)
        : await getFilteredTransactions(database, periodKey, type, activeProfileId);

    return [...(items || [])].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  };

  const handleSelectFixedState = async (newState: FixedOverrideState) => {
    if (!db || !selectedTransaction) return;
  
    setCurrentFixedState(newState);
  
    const keyword =
      selectedTransaction.merchant !== 'Unknown'
        ? selectedTransaction.merchant
        : selectedTransaction.rawDescription;
  
    try {
      await setMerchantFixedOverride(
        db,
        keyword,
        selectedTransaction.category,
        newState,
        activeProfileId
      );
  
      // Back to automatic: list badges show what detection decides.
      let updatedIsFixedVal: number | null = fixedAuto.autoIsFixed ? 1 : 0;
      if (newState === 'FIXED') updatedIsFixedVal = 1;
      if (newState === 'FLEXIBLE') updatedIsFixedVal = 0;
  
      setSelectedTransaction((prev) =>
        prev
          ? {
              ...prev,
              is_fixed: updatedIsFixedVal,
            }
          : null
      );
  
      // The override applies to every row the keyword matches, so reload instead of patching by name.
      if (wasOpenedFromList) {
        setListModalTransactions(await fetchListModalItems(db, listModalType));
      }
  
      if (selectedBarCategory) {
        const updatedItems = await getTransactionsByMonthAndCategory(
          db,
          periodKey,
          selectedBarCategory,
          activeProfileId
        );
        setSelectedCategoryTransactions(updatedItems || []);
      }
  
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to update fixed state override:', error);
    }
  };

  const handleCategoryChanged = async (updated: Transaction) => {
    setSelectedTransaction(updated);
    setListModalTransactions((prevList) => prevList.map((tx) => (tx.id === updated.id ? updated : tx)));
    if (!db) return;

    try {
      const explanation = await getTransactionFixedExplanation(db, updated, activeProfileId);
      setCurrentFixedState(explanation.state);
      setFixedAuto(explanation);

      // Category feeds the fixed score, so badges can change with it.
      if (wasOpenedFromList) {
        setListModalTransactions(await fetchListModalItems(db, listModalType));
      }

      if (selectedBarCategory) {
        const updatedItems = await getTransactionsByMonthAndCategory(
          db,
          periodKey,
          selectedBarCategory,
          activeProfileId
        );
        setSelectedCategoryTransactions(updatedItems || []);
      }

      await loadDashboardData();
    } catch (error) {
      console.error('Failed to refresh after category change:', error);
    }
  };

  const handleOpenCardModal = async (type: 'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE') => {
    setListModalType(type);
    setListModalVisible(true);
    if (!db) return;

    try {
      setLoadingListModal(true);

      setListModalTransactions(await fetchListModalItems(db, type));
    } catch (error) {
      console.error(`Failed to load ${type} list:`, error);
    } finally {
      setLoadingListModal(false);
    }
  };

  const handleBarPress = async (categoryName: string) => {
    if (selectedBarCategory === categoryName) {
      resetCategorySelection();
    } else {
      setSelectedBarCategory(categoryName);
      if (db) {
        try {
          setLoadingTransactions(true);
          const items = await getTransactionsByMonthAndCategory(db, periodKey, categoryName, activeProfileId);
          setSelectedCategoryTransactions(items || []);
        } catch (error) {
          console.error(`Failed to load transactions for ${categoryName}:`, error);
        } finally {
          setLoadingTransactions(false);
        }
      }
    }
  };

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Home</Text>

          <View style={styles.headerRightGroup}>
            <TouchableOpacity
              style={[styles.profilePill, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setProfileModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.miniAvatar, { backgroundColor: activeProfile?.avatarColor || '#007AFF' }]}>
                <Text style={styles.miniAvatarText}>
                  {activeProfile?.name?.substring(0, 1) || 'P'}
                </Text>
              </View>
              <Text style={[styles.profilePillText, { color: colors.text }]}>
                {activeProfile?.name || 'Personal'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.settingsHeaderBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              activeOpacity={0.8}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Empty Workspace View vs Main Dashboard */}
        {availableMonths.length === 0 ? (
          <View style={[styles.emptyHeroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.tintBackground }]}>
              <Ionicons name="wallet-outline" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.emptyHeroTitle, { color: colors.text }]}>
              No Transactions in {activeProfile?.name || 'this profile'}
            </Text>
            <Text style={[styles.emptyHeroSubtitle, { color: colors.textSecondary }]}>
              Your financial data stays 100% private on this device. Import a statement to start tracking your finances.
            </Text>

            <View style={styles.emptyActionStack}>
              <TouchableOpacity
                style={[styles.primaryImportBtn, { backgroundColor: colors.accent }]}
                onPress={importStatement}
                disabled={importing}
                activeOpacity={0.85}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
                )}
                <Text style={styles.primaryImportText}>
                  {importing ? 'Processing Statement...' : 'Import Bank Statement'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <MonthStepper
              selectedMonth={periodKey}
              availableMonths={rangeFilter ? NO_MONTHS : availableMonths}
              monthNames={periodNames}
              coverageStatus={coverageStatus}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onOpenMonthPicker={() => setMonthPickerVisible(true)}
            />

            <SummaryCards
              summary={summary}
              totalTransactions={totalTransactions}
              categoryCount={categoryData.length}
              onOpenCardModal={handleOpenCardModal}
            />

            <AllocationChart
              categoryData={categoryData}
              selectedBarCategory={selectedBarCategory}
              selectedCategoryTransactions={selectedCategoryTransactions}
              loadingTransactions={loadingTransactions}
              onBarPress={handleBarPress}
              onSelectTransaction={(trx) => {
                setWasOpenedFromList(false);
                handleSelectTransaction(trx, selectedBarCategory ?? 'Category');
              }}
            />
          </>
        )}
      </ScrollView>

      <TransactionListModal
        visible={listModalVisible}
        listType={listModalType}
        selectedMonth={periodKey}
        monthNames={periodNames}
        transactions={listModalTransactions}
        loading={loadingListModal}
        fixedSummary={listModalType === 'INCOME' ? incomeSummary : fixedSummary}
        onClose={() => setListModalVisible(false)}
        onSelectTransaction={handleSelectFromFlatList}
      />

      <TransactionDetailModal
        visible={selectedTransaction !== null}
        transaction={selectedTransaction}
        fixedState={currentFixedState}
        autoIsFixed={fixedAuto.autoIsFixed}
        autoReason={fixedAuto.reason}
        parentTitle={detailParentTitle}
        onClose={handleGoBackFromDetail}
        onDismiss={handleDismissDetailDirectly}
        onSelectFixedState={handleSelectFixedState}
        onCategoryChanged={handleCategoryChanged}
      />

      <ImportSummaryHost />

      <ProfileSwitcherModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
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

      <Modal visible={monthPickerVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMonthPickerVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Period</Text>
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
                      Custom Range…
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
                    >
                      <Text
                        style={[
                          styles.sheetItemText,
                          { color: colors.text },
                          isSelected && [styles.sheetItemTextActive, { color: colors.accent }],
                        ]}
                      >
                        {MONTH_NAMES[m] || m}
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
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  profilePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  settingsHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
});