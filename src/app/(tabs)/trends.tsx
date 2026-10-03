import { DateRangeModal } from '@/components/modals/DateRangeModal';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { TransactionListModal } from '@/components/modals/TransactionListModal';
import { ProfileSwitcherModal } from '@/components/ProfileSwitcherModal';
import { ScreenContainer } from '@/components/ScreenContainer';
import { getCategoryColor } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import {
  FixedCostSummary,
  FixedOverrideState,
  getAnnualTrendWithBudget,
  getAvailableYears,
  getCategoryGoal,
  getDailyTrend,
  getExpenseCategoryNames,
  getFixedVsFlexibleSummary,
  getRangeTrendWithBudget,
  getTransactionDateBounds,
  getTransactionFixedExplanation,
  getTransactionsByMonthAndCategory,
  getYearCoverageStatus,
  makeRangeKey,
  setCategoryGoal,
  setMerchantFixedOverride,
  Transaction
} from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useRef, useState } from 'react';
import type { TextStyle } from 'react-native';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity, TouchableWithoutFeedback, useWindowDimensions, View
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useProfile } from '../../contexts/ProfileContext';

const getCurrentYear = (): string => {
  return String(new Date().getFullYear());
};

const getMonthNamesForYear = (year: string): Record<string, string> => {
  return {
    [`${year}-01`]: `January ${year}`,
    [`${year}-02`]: `February ${year}`,
    [`${year}-03`]: `March ${year}`,
    [`${year}-04`]: `April ${year}`,
    [`${year}-05`]: `May ${year}`,
    [`${year}-06`]: `June ${year}`,
    [`${year}-07`]: `July ${year}`,
    [`${year}-08`]: `August ${year}`,
    [`${year}-09`]: `September ${year}`,
    [`${year}-10`]: `October ${year}`,
    [`${year}-11`]: `November ${year}`,
    [`${year}-12`]: `December ${year}`,
  };
};

const formatShortMonth = (monthKey: string): string => {
  if (!monthKey || monthKey === '-') return '-';
  const [year, month] = monthKey.split('-');
  if (!year || !month) return monthKey;

  const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(month, 10) - 1;
  const shortMonth = shortMonthNames[monthIdx] || month;
  const shortYear = year.slice(-2);

  return `${shortMonth} '${shortYear}`;
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

const getMonthNamesForRange = (from: string, to: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
    Object.assign(result, getMonthNamesForYear(String(year)));
  }
  return result;
};

const RANGE_DAILY_MAX_DAYS = 62;

const getRangeDayCount = (from: string, to: string): number => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const diff = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.round(diff / 86400000) + 1;
};

const formatShortPoint = (key: string): string => {
  if (!key || key === '-') return '-';
  if (key.length === 10) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  return formatShortMonth(key);
};

const getNiceScale = (peak: number): { max: number; sections: number } => {
  const target = Math.max(peak * 1.05, 10);
  const bases = [1, 2, 2.5, 5];
  const startExponent = Math.floor(Math.log10(target / 6));

  for (let exponent = startExponent; exponent <= startExponent + 2; exponent++) {
    for (const base of bases) {
      const step = base * Math.pow(10, exponent);
      const sections = Math.ceil(target / step);
      if (sections >= 2 && sections <= 6) {
        return { max: step * sections, sections };
      }
    }
  }

  return { max: target, sections: 4 };
};

interface YearCoverageStatus {
  status: 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'EMPTY';
  label: string;
}

export default function TrendsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { activeProfile, currencySymbol, dataVersion } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Year Selection State
  const [availableYears, setAvailableYears] = useState<string[]>([getCurrentYear()]);
  const [selectedYear, setSelectedYear] = useState<string>(getCurrentYear());
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [yearCoverage, setYearCoverage] = useState<YearCoverageStatus>({
    status: 'EMPTY',
    label: '',
  });

  // Custom Range State
  const [rangeFilter, setRangeFilter] = useState<{ from: string; to: string } | null>(null);
  const [rangeModalVisible, setRangeModalVisible] = useState(false);
  const [dateBounds, setDateBounds] = useState<{ minDate: string; maxDate: string } | null>(null);

  const isDailyMode =
    rangeFilter !== null && getRangeDayCount(rangeFilter.from, rangeFilter.to) <= RANGE_DAILY_MAX_DAYS;

  const MONTH_NAMES = rangeFilter
    ? getMonthNamesForRange(rangeFilter.from, rangeFilter.to)
    : getMonthNamesForYear(selectedYear);
  const periodPrefix = rangeFilter ? 'Total' : `Total ${selectedYear}`;

  // Sorted Category Pills State
  const [sortedCategories, setSortedCategories] = useState<string[]>([]);

  // Scrub & Selection State
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const activeScrubKey = useRef<string | null>(null);
  const activeScrubVal = useRef<number | null>(null);

  const [categoryBudget, setCategoryBudget] = useState<number>(0);

  // Inline Quick-Set Budget State
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineInputVal, setInlineInputVal] = useState('');

  // Drill-down Modals State
  const [listModalVisible, setListModalVisible] = useState(false);
  const [selectedMonthForModal, setSelectedMonthForModal] = useState('');
  const [modalTransactions, setModalTransactions] = useState<Transaction[]>([]);
  const [modalFixedSummary, setModalFixedSummary] = useState<FixedCostSummary | undefined>(undefined);
  const [loadingModalTrx, setLoadingModalTrx] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [currentFixedState, setCurrentFixedState] = useState<FixedOverrideState>('AUTO');
  const [fixedAuto, setFixedAuto] = useState({ autoIsFixed: false, reason: '' });

  const [summary, setSummary] = useState({
    total: 0,
    average: 0,
    highestMonth: '-',
    lowestMonth: '-',
  });

  const activeColor = selectedCategory === 'All' ? colors.accent : getCategoryColor(selectedCategory);

  const handleScrubUpdate = useCallback((monthKey: string, amount: number) => {
    if (activeScrubKey.current !== monthKey) {
      activeScrubKey.current = monthKey;
      activeScrubVal.current = amount;
      Haptics.selectionAsync();
    }
  }, []);

  const handleScrubDrop = useCallback(() => {
    if (activeScrubKey.current) {
      setSelectedMonthKey((prev) => {
        if (prev === activeScrubKey.current) {
          setSelectedAmount(null);
          return null;
        }
        setSelectedAmount(activeScrubVal.current);
        return activeScrubKey.current;
      });
    }
  }, []);

  const [rawTrendData, setRawTrendData] = useState<any[]>([]);
  const [loadedSignature, setLoadedSignature] = useState('');
  const loadAnalyticsData = useCallback(async () => {
    if (!db) return;
    const signature = `${selectedCategory}|${selectedYear}|${
      rangeFilter ? makeRangeKey(rangeFilter.from, rangeFilter.to) : ''
    }`;
    try {
      setLoading(true);

      const dbYears = await getAvailableYears(db, activeProfileId);
      if (dbYears && dbYears.length > 0) {
        setAvailableYears(dbYears);
        if (!dbYears.includes(selectedYear)) {
          setSelectedYear(dbYears[0]);
        }
      }

      const fetchTrend = (cat: string) =>
        rangeFilter
          ? isDailyMode
            ? getDailyTrend(db, rangeFilter.from, rangeFilter.to, cat, activeProfileId)
            : getRangeTrendWithBudget(db, rangeFilter.from, rangeFilter.to, cat, activeProfileId)
          : getAnnualTrendWithBudget(db, selectedYear, cat, activeProfileId);

      const pillPeriod = rangeFilter
        ? makeRangeKey(rangeFilter.from, rangeFilter.to)
        : makeRangeKey(`${selectedYear}-01-01`, `${selectedYear}-12-31`);
      const categoryNames = await getExpenseCategoryNames(db, activeProfileId, pillPeriod);
      setSortedCategories(categoryNames);
      if (selectedCategory !== 'All' && !categoryNames.includes(selectedCategory)) {
        setSelectedCategory('All');
        return;
      }

      const [trendWithBudget, currentGoal, coverageRes, bounds] = await Promise.all([
        fetchTrend(selectedCategory),
        getCategoryGoal(db, selectedCategory, activeProfileId),
        rangeFilter
          ? Promise.resolve({ status: 'EMPTY' as const, label: '' })
          : getYearCoverageStatus(db, selectedYear, activeProfileId),
        getTransactionDateBounds(db, activeProfileId),
      ]);

      setDateBounds(bounds);
      setCategoryBudget(currentGoal);
      setRawTrendData(trendWithBudget || []);

      const values = (trendWithBudget || []).map((m) => m.totalAmount);

      const total = values.reduce((a, b) => a + b, 0);
      const activeValues = values.filter((v) => v > 0);
      const avg = isDailyMode
        ? values.length > 0
          ? total / values.length
          : 0
        : activeValues.length > 0
        ? total / activeValues.length
        : 0;

      const maxVal = Math.max(...values);
      const minVal = Math.min(...(activeValues.length > 0 ? activeValues : [0]));

      const highest = trendWithBudget.find((m) => m.totalAmount === maxVal && m.totalAmount > 0)?.monthName || '-';
      const lowest = trendWithBudget.find((m) => m.totalAmount === minVal && m.totalAmount > 0)?.monthName || '-';

      setSummary({
        total,
        average: avg,
        highestMonth: highest !== '-' ? highest : '-',
        lowestMonth: lowest !== '-' ? lowest : '-',
      });

      setYearCoverage(coverageRes);
    } catch (error) {
      console.error('Failed to query trends data for year:', error);
    } finally {
      setLoadedSignature(signature);
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, selectedYear, rangeFilter, isDailyMode, selectedCategory, activeProfileId]);

  const isDense = rawTrendData.length > 12;

  const chartData = React.useMemo(() => {
    const labelStep = isDense ? Math.ceil(rawTrendData.length / 8) : 1;

    return rawTrendData.map((item, index) => {
      const hasData = item.totalAmount > 0;
      const val = hasData ? Math.round(item.totalAmount) : 0;
      const isSelected = item.monthName === selectedMonthKey;
      let ptColor = activeColor;

      if (item.budgetLimit > 0 && hasData) {
        if (val > item.budgetLimit) ptColor = '#FF3B30';
        else if (val === item.budgetLimit) ptColor = '#FFCC00';
        else ptColor = '#34C759';
      }

      const showLabel = !isDense || index % labelStep === 0 || isSelected;
      const baseLabel = isDailyMode
        ? String(Number(item.monthName.slice(8, 10)))
        : item.monthName.split('-')[1];

      const labelStyle: TextStyle = {
        ...(isSelected
          ? { color: activeColor, fontWeight: '800', fontSize: 11 }
          : { color: colors.textSecondary, fontWeight: '400', fontSize: 10 }),
        ...(isDense ? { width: 36, marginLeft: -14, textAlign: 'center' } : {}),
      };

      const showCustomDot = hasData && (!isDense || isSelected);

      return {
        value: val,
        label: showLabel ? baseLabel : '',
        monthKey: item.monthName,
        hideDataPoint: !showCustomDot,
        labelTextStyle: labelStyle,
        customDataPoint: showCustomDot
          ? () => (
              <View
                style={{
                  width: isSelected ? 18 : 8,
                  height: isSelected ? 18 : 8,
                  borderRadius: isSelected ? 9 : 4,
                  backgroundColor: isSelected ? activeColor : ptColor,
                  borderWidth: isSelected ? 3 : 1.5,
                  borderColor: isSelected ? '#FFFFFF' : colors.card,
                  shadowColor: activeColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isSelected ? 1 : 0,
                  shadowRadius: isSelected ? 8 : 0,
                  elevation: isSelected ? 6 : 0,
                  transform: [
                    { translateX: isSelected ? -5 : 0 },
                    { translateY: isSelected ? -5 : 0 },
                  ],
                }}
              />
            )
          : undefined,
      };
    });
  }, [rawTrendData, selectedMonthKey, activeColor, colors.card, colors.textSecondary, isDailyMode, isDense]);
  useFocusEffect(
    useCallback(() => {
      if (activeProfile?.id) {
        loadAnalyticsData();
      }
    }, [activeProfile?.id, dataVersion, loadAnalyticsData])
  );
  
  const currentYearIndex = availableYears.indexOf(selectedYear);
  const canGoPrev = !rangeFilter && currentYearIndex < availableYears.length - 1;
  const canGoNext = !rangeFilter && currentYearIndex > 0;

  const handlePrevYear = () => {
    if (canGoPrev) {
      setSelectedYear(availableYears[currentYearIndex + 1]);
      setSelectedMonthKey(null);
      setSelectedAmount(null);
    }
  };

  const handleNextYear = () => {
    if (canGoNext) {
      setSelectedYear(availableYears[currentYearIndex - 1]);
      setSelectedMonthKey(null);
      setSelectedAmount(null);
    }
  };

  const handlePickYear = (yr: string) => {
    setRangeFilter(null);
    setSelectedYear(yr);
    setSelectedMonthKey(null);
    setSelectedAmount(null);
    setYearPickerVisible(false);
  };

  const handleOpenRangePicker = () => {
    setYearPickerVisible(false);
    setTimeout(() => setRangeModalVisible(true), 250);
  };

  const handleApplyRange = (from: string, to: string) => {
    setRangeFilter({ from, to });
    setSelectedMonthKey(null);
    setSelectedAmount(null);
    activeScrubKey.current = null;
    activeScrubVal.current = null;
    setRangeModalVisible(false);
  };

  const periodForMonth = (monthKey: string): string => {
    if (monthKey.length === 10) return makeRangeKey(monthKey, monthKey);
    if (!rangeFilter) return monthKey;
    const [y, m] = monthKey.split('-').map(Number);
    const monthStart = `${monthKey}-01`;
    const monthEnd = `${monthKey}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const start = monthStart > rangeFilter.from ? monthStart : rangeFilter.from;
    const end = monthEnd < rangeFilter.to ? monthEnd : rangeFilter.to;
    return makeRangeKey(start, end);
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setIsEditingInline(false);
    setSelectedMonthKey(null);
    setSelectedAmount(null);
    activeScrubKey.current = null;
    activeScrubVal.current = null;
  };

  const handleSaveInlineBudget = async () => {
    if (!db) return;
    const parsed = parseFloat(inlineInputVal);
    if (!isNaN(parsed) && parsed >= 0) {
      await setCategoryGoal(db, selectedCategory, parsed, activeProfileId);
      setCategoryBudget(parsed);
    } else if (inlineInputVal === '' || parsed === 0) {
      await setCategoryGoal(db, selectedCategory, 0, activeProfileId);
      setCategoryBudget(0);
    }
    setIsEditingInline(false);
    await loadAnalyticsData();
  };

  const handleOpenMonthDetails = async (monthKey: string) => {
    if (!db) return;
    setSelectedMonthForModal(monthKey);
    setListModalVisible(true);
    try {
      setLoadingModalTrx(true);
      const period = periodForMonth(monthKey);

      const items = await getTransactionsByMonthAndCategory(
        db,
        period,
        selectedCategory,
        activeProfileId
      );
      setModalTransactions(items || []);

      const fixedSummaryData = await getFixedVsFlexibleSummary(
        db,
        period,
        activeProfileId
      );
      setModalFixedSummary(fixedSummaryData);
    } catch (err) {
      console.error('Failed to query month transactions:', err);
    } finally {
      setLoadingModalTrx(false);
    }
  };

  const handleSelectTransactionFromModal = async (trx: Transaction) => {
    setListModalVisible(false);

    setTimeout(async () => {
      setSelectedTransaction(trx);
      if (db) {
        const explanation = await getTransactionFixedExplanation(db, trx, activeProfileId);
        setCurrentFixedState(explanation.state);
        setFixedAuto(explanation);
      }
    }, 250);
  };

  const handleCloseDetailModal = () => {
    setSelectedTransaction(null);

    if (selectedMonthForModal) {
      setTimeout(() => {
        setListModalVisible(true);
      }, 250);
    }
  };

  const handleSelectFixedStateInDetail = async (newState: FixedOverrideState) => {
    if (!db || !selectedTransaction) return;
    const keyword =
      selectedTransaction.merchant !== 'Unknown'
        ? selectedTransaction.merchant
        : selectedTransaction.rawDescription;

    await setMerchantFixedOverride(
      db,
      keyword,
      selectedTransaction.category,
      newState,
      activeProfileId
    );

    setCurrentFixedState(newState);

    if (selectedMonthForModal) {
      const period = periodForMonth(selectedMonthForModal);

      const updated = await getTransactionsByMonthAndCategory(
        db,
        period,
        selectedCategory,
        activeProfileId
      );
      setModalTransactions(updated || []);

      const updatedSummary = await getFixedVsFlexibleSummary(
        db,
        period,
        activeProfileId
      );
      setModalFixedSummary(updatedSummary);
    }
    await loadAnalyticsData();
  };

  const getBadgeColor = (status: YearCoverageStatus['status']) => {
    switch (status) {
      case 'COMPLETE': 
        return { bg: 'rgba(52, 199, 89, 0.12)', text: '#34C759' };
      case 'PARTIAL': 
      case 'IN_PROGRESS': 
        return { bg: 'rgba(255, 149, 0, 0.12)', text: '#FF9500' };
      default: 
        return { bg: 'rgba(142, 142, 147, 0.12)', text: colors.textSecondary };
    }
  };

  const badgeTheme = getBadgeColor(yearCoverage.status);

  const showBudgetLine =
    categoryBudget > 0 &&
    rawTrendData.every((p) => Math.abs(p.budgetLimit - categoryBudget) < 0.01);

  const dataPeak = Math.max(...rawTrendData.map((p) => p.totalAmount), 0);
  const goalInScale = showBudgetLine && categoryBudget <= dataPeak * 1.5;
  const niceScale = getNiceScale(Math.max(dataPeak, goalInScale ? categoryBudget : 0));
  const yAxisLabelWidthPx = 44;
  const plotWidth = Math.max(screenWidth - 40 - 32 - yAxisLabelWidthPx - 12, 160);
  const initialPad = 10;
  const endPad = 10;
  const pointSpacing =
    chartData.length > 1
      ? Math.max((plotWidth - initialPad - endPad) / (chartData.length - 1), 2)
      : 24;  const requestSignature = `${selectedCategory}|${selectedYear}|${
    rangeFilter ? makeRangeKey(rangeFilter.from, rangeFilter.to) : ''
  }`;
  const chartReady = loadedSignature === requestSignature;

  const modalMonthNames: Record<string, string> =
    selectedMonthForModal.length === 10
      ? {
          ...MONTH_NAMES,
          [selectedMonthForModal]: formatRangeLabel(selectedMonthForModal, selectedMonthForModal),
        }
      : MONTH_NAMES;

      console.log('TRENDS_SCALE', JSON.stringify({
        mode: rangeFilter ? (isDailyMode ? 'daily' : 'monthly-range') : 'year',
        range: rangeFilter,
        points: rawTrendData.length,
        values: rawTrendData.map((p) => Math.round(p.totalAmount)),
        dataPeak,
        categoryBudget,
        goalInScale,
        niceScale,
      }));     
  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={() => {
              setRefreshing(true);
              loadAnalyticsData();
            }}
          />
        }
      >
        {/* Header Bar with Active Profile Pill & Settings */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Trends</Text>

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

        {/* Unified Stepper Container */}
        <View style={[styles.stepperContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.arrowButton, !canGoPrev && styles.disabledButton]}
            onPress={handlePrevYear}
            disabled={!canGoPrev}
          >
            <Text style={[styles.arrowText, !canGoPrev && styles.disabledText, { color: colors.accent }]}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.labelContainer}
            onPress={() => setYearPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.stepperLabel, { color: colors.text }]} numberOfLines={1}>
              {rangeFilter ? formatRangeLabel(rangeFilter.from, rangeFilter.to) : selectedYear}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.arrowButton, !canGoNext && styles.disabledButton]}
            onPress={handleNextYear}
            disabled={!canGoNext}
          >
            <Text style={[styles.arrowText, !canGoNext && styles.disabledText, { color: colors.accent }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Coverage Status Badge */}
        {yearCoverage.label ? (
          <View style={styles.badgeWrapper}>
            <View style={[styles.coverageBadge, { backgroundColor: badgeTheme.bg }]}>
              <View style={[styles.coverageDot, { backgroundColor: badgeTheme.text }]} />
              <Text style={[styles.coverageText, { color: badgeTheme.text }]}>
                {yearCoverage.label}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Sticky Anchor Filter Bar */}
        <View style={styles.stickyBarContainer}>
          {/* Pinned 'All' Category Pill */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.chipPill,
              styles.pinnedPill,
              { backgroundColor: colors.card, borderColor: colors.border },
              selectedCategory === 'All' && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
            onPress={() => handleSelectCategory('All')}
          >
            <View
              style={[
                styles.miniDot,
                { backgroundColor: selectedCategory === 'All' ? '#FFF' : colors.accent },
              ]}
            />
            <Text
              style={[
                styles.chipText,
                { color: colors.text },
                selectedCategory === 'All' && styles.chipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />

          {/* Scrollable Specific Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillScrollView}
            contentContainerStyle={styles.pillContainer}
          >
            {sortedCategories
              .filter((cat) => cat !== 'All')
              .map((cat) => {
                const isActive = selectedCategory === cat;
                const color = getCategoryColor(cat);

                return (
                  <TouchableOpacity
                    key={cat}
                    activeOpacity={0.7}
                    style={[
                      styles.chipPill,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      isActive && { backgroundColor: color, borderColor: color },
                    ]}
                    onPress={() => handleSelectCategory(cat)}
                  >
                    <View style={[styles.miniDot, { backgroundColor: isActive ? '#FFF' : color }]} />
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.text },
                        isActive && styles.chipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </View>

        {/* Metric Summary Layout */}
        <View style={styles.metricsContainer}>
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.heroHeader}>
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                {selectedCategory === 'All' ? `${periodPrefix} Spending` : `${periodPrefix} ${selectedCategory}`}
              </Text>
              <View style={[styles.heroBadge, { backgroundColor: `${activeColor}18` }]}>
                <Text style={[styles.heroBadgeText, { color: activeColor }]}>
                  {rangeFilter ? 'Range' : 'Annual'}
                </Text>
              </View>
            </View>
            <Text style={[styles.heroValue, { color: activeColor }]}>
              {currencySymbol}{summary.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>

          <View style={styles.subRow}>
            <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {isDailyMode ? 'Daily Avg' : 'Monthly Avg'}
              </Text>
              <Text style={[styles.subValue, { color: colors.text }]}>
                {currencySymbol}{summary.average.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </Text>
            </View>

            <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {isDailyMode ? 'Peak Day' : 'Peak Month'}
              </Text>
              <Text style={[styles.subValue, { color: colors.text }]}>
                {formatShortPoint(summary.highestMonth)}
              </Text>
            </View>

            <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {isDailyMode ? 'Lowest Day' : 'Lowest Month'}
              </Text>
              <Text style={[styles.subValue, { color: colors.text }]}>
                {formatShortPoint(summary.lowestMonth)}
              </Text>
            </View>
          </View>
        </View>

        {/* Expenses Chart Card */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>
              {rangeFilter ? 'Expenses' : `${selectedYear} Expenses`}
            </Text>
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => {
                if (selectedMonthKey) {
                  setSelectedMonthKey(null);
                  setSelectedAmount(null);
                }
              }}
            >
              <Text style={[styles.chartHintText, { color: colors.textSecondary }]}>
                {selectedMonthKey
                  ? `${MONTH_NAMES[selectedMonthKey] || formatRangeLabel(selectedMonthKey, selectedMonthKey)} (Tap to clear)`
                  : isDailyMode
                  ? 'Drag across line to select day'
                  : 'Drag across line to select month'}
              </Text>
            </TouchableOpacity>
          </View>

          {(loading && !refreshing) || !chartReady ? (
            <ActivityIndicator size="small" color={activeColor} style={{ paddingVertical: 40 }} />
          ) : (
            <View style={styles.chartWrapper} onTouchEnd={handleScrubDrop}>
              <LineChart
                key={`${selectedCategory}-${categoryBudget}-${selectedYear}-${rangeFilter ? makeRangeKey(rangeFilter.from, rangeFilter.to) : ''}-${niceScale.max}`}
                data={chartData}
                maxValue={niceScale.max}
                noOfSections={niceScale.sections}
                color={activeColor}
                thickness={2.5}
                startFillColor={`${activeColor}33`}
                endFillColor={`${activeColor}00`}
                startOpacity={0.3}
                endOpacity={0.0}
                areaChart
                curved={!isDailyMode}
                height={140}
                yAxisLabelWidth={yAxisLabelWidthPx}
                spacing={pointSpacing}
                initialSpacing={initialPad}
                endSpacing={endPad}
                disableScroll
                xAxisThickness={1}
                yAxisThickness={0}
                xAxisColor={colors.border}
                yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                {...(goalInScale
                  ? {
                      showReferenceLine1: true,
                      referenceLine1Position: categoryBudget,
                      referenceLine1Config: {
                        color: '#FF3B30',
                        thickness: 1.5,
                        dashWidth: 4,
                        dashGap: 4,
                      },
                    }
                  : {})}
                pointerConfig={{
                  pointerStripUptoDataPoint: true,
                  pointerStripColor: activeColor,
                  pointerStripWidth: 2,
                  strokeDashArray: [4, 4],
                  pointerColor: activeColor,
                  radius: 6,
                  activatePointersOnLongPress: false,
                  pointerVanishDelay: 0,
                  persistPointer: false,
                  pointerLabelComponent: (items: any[]) => {
                    const item = items[0];
                    if (!item) return null;
                
                    requestAnimationFrame(() => {
                      handleScrubUpdate(item.monthKey, item.value);
                    });
                    return null;
                  },
                }}
              />
            </View>
          )}

          {selectedMonthKey && selectedAmount !== null && (
            <View style={styles.bannerGridContainer}>
              <View style={styles.bannerGridRow}>
                <TouchableOpacity
                  style={[
                    styles.gridCard,
                    { backgroundColor: colors.background, borderColor: colors.border, borderLeftColor: activeColor },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleOpenMonthDetails(selectedMonthKey)}
                >
                  <View style={styles.gridCardHeader}>
                    <Text style={[styles.gridCardTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {formatShortPoint(selectedMonthKey)} Spent
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                  </View>
                  <Text style={[styles.gridCardHeroValue, { color: colors.text }]}>
                    {currencySymbol}{selectedAmount.toLocaleString()}
                  </Text>
                  <Text style={[styles.gridCardSubtext, { color: colors.accent }]}>Inspect Items</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.gridCard,
                    { backgroundColor: colors.background, borderColor: colors.border, borderLeftColor: activeColor },
                  ]}
                  activeOpacity={isEditingInline ? 1 : 0.8}
                  onPress={() => {
                    if (!isEditingInline) {
                      setInlineInputVal(categoryBudget > 0 ? categoryBudget.toString() : '');
                      setIsEditingInline(true);
                    }
                  }}
                >
                  <View style={styles.gridCardHeader}>
                    <Text style={[styles.gridCardTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      Goal Target
                    </Text>
                    {!isEditingInline && (
                      <Ionicons name="pencil-outline" size={13} color={colors.accent} />
                    )}
                  </View>

                  {isEditingInline ? (
                    <View style={styles.inlineInputRow}>
                      <TextInput
                        style={[
                          styles.inlineInput,
                          {
                            backgroundColor: colors.card,
                            color: colors.text,
                            borderColor: colors.border,
                          },
                        ]}
                        placeholder="Goal"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        value={inlineInputVal}
                        onChangeText={setInlineInputVal}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={[styles.inlineSaveBtn, { backgroundColor: colors.accent }]}
                        onPress={handleSaveInlineBudget}
                      >
                        <Text style={styles.inlineSaveText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.gridCardHeroValue, { color: colors.text }]}>
                        {categoryBudget > 0 ? `${currencySymbol}${categoryBudget.toFixed(0)}` : 'Set Goal'}
                      </Text>
                      <Text style={[styles.gridCardSubtext, { color: colors.textSecondary }]}>
                        {categoryBudget > 0 ? 'Monthly Limit' : 'Tap to add limit'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.dismissBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => {
                  setSelectedMonthKey(null);
                  setSelectedAmount(null);
                  activeScrubKey.current = null;
                  activeScrubVal.current = null;
                }}
              >
                <Ionicons name="close-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.dismissBtnText, { color: colors.textSecondary }]}>
                  Deselect {MONTH_NAMES[selectedMonthKey] || formatRangeLabel(selectedMonthKey, selectedMonthKey)}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Profile Switcher Modal */}
      <ProfileSwitcherModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
      />

      {/* Period Picker Modal Sheet */}
      <Modal visible={yearPickerVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setYearPickerVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Period</Text>
              </View>
              <ScrollView style={{ maxHeight: 320 }}>
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

                {availableYears.map((yr) => {
                  const isSelected = !rangeFilter && selectedYear === yr;
                  return (
                    <TouchableOpacity
                      key={yr}
                      style={[
                        styles.sheetItem,
                        { borderBottomColor: colors.border },
                        isSelected && [
                          styles.sheetItemActive,
                          { backgroundColor: colors.tintBackground },
                        ],
                      ]}
                      onPress={() => handlePickYear(yr)}
                    >
                      <Text
                        style={[
                          styles.sheetItemText,
                          { color: colors.text },
                          isSelected && [styles.sheetItemTextActive, { color: colors.accent }],
                        ]}
                      >
                        {yr}
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

      <DateRangeModal
        visible={rangeModalVisible}
        minDate={dateBounds?.minDate ?? null}
        maxDate={dateBounds?.maxDate ?? null}
        initialFrom={rangeFilter?.from ?? null}
        initialTo={rangeFilter?.to ?? null}
        onApply={handleApplyRange}
        onClose={() => setRangeModalVisible(false)}
      />

      {/* Modals */}
      <TransactionListModal
        visible={listModalVisible}
        listType="EXPENSE"
        selectedMonth={selectedMonthForModal}
        monthNames={modalMonthNames}
        transactions={modalTransactions}
        fixedSummary={modalFixedSummary}
        loading={loadingModalTrx}
        onClose={() => setListModalVisible(false)}
        onSelectTransaction={handleSelectTransactionFromModal}
      />

      <TransactionDetailModal
        visible={selectedTransaction !== null}
        transaction={selectedTransaction}
        fixedState={currentFixedState}
        autoIsFixed={fixedAuto.autoIsFixed}
        autoReason={fixedAuto.reason}
        parentTitle={selectedCategory === 'All' ? 'Expenses' : selectedCategory}
        onClose={handleCloseDetailModal}
        onDismiss={() => setSelectedTransaction(null)}
        onSelectFixedState={handleSelectFixedStateInDetail}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 0, paddingBottom: 40 },
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

  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 6,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.4,
  },
  arrowText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: -2,
  },
  disabledText: {
    color: '#C7C7CC',
  },
  labelContainer: {
    flex: 1,
    alignItems: 'center',
  },
  stepperLabel: {
    fontSize: 16,
    fontWeight: '600',
  },

  badgeWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  coverageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  coverageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  coverageText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* Sticky Anchor Layout */
  stickyBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  pinnedPill: {
    marginRight: 8,
  },
  verticalDivider: {
    width: 1,
    height: 20,
    marginRight: 8,
  },
  pillScrollView: { flex: 1 },
  pillContainer: { gap: 8, paddingRight: 10 },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFF',
  },

  metricsContainer: {
    marginBottom: 16,
    gap: 12,
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.5,
  },

  subRow: {
    flexDirection: 'row',
    gap: 10,
  },
  subCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  subValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },

  chartCard: {
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
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: { fontSize: 15, fontWeight: '600' },
  chartHintText: { fontSize: 11 },
  chartWrapper: { alignItems: 'center', paddingTop: 8 },

  bannerGridContainer: {
    marginTop: 16,
    gap: 12,
  },
  bannerGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    padding: 12,
    justifyContent: 'space-between',
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridCardTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gridCardHeroValue: {
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  gridCardSubtext: {
    fontSize: 11,
    fontWeight: '600',
  },

  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  inlineInput: {
    flex: 1,
    height: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineSaveBtn: {
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineSaveText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dismissBtnText: {
    fontSize: 11,
    fontWeight: '600',
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
});