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
  getFixedVsFlexibleSummary,
  getTransactionFixedState,
  getTransactionsByMonthAndCategory,
  getYearCoverageStatus,
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
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useProfile } from '../../contexts/ProfileContext';

const CATEGORIES = [
  'All',
  'Housing',
  'Childcare',
  'Groceries',
  'Dining Out',
  'Transportation',
  'Utilities & Telecom',
  'Health & Care',
  'Shopping & Retail',
  'Taxes & Municipal Fees',
];

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

interface YearCoverageStatus {
  status: 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'EMPTY';
  label: string;
}

export default function TrendsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { activeProfile, currencySymbol } = useProfile();
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

  const MONTH_NAMES = getMonthNamesForYear(selectedYear);

  // Sorted Category Pills State
  const [sortedCategories, setSortedCategories] = useState<string[]>(CATEGORIES);

  // Scrub & Selection State
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const activeScrubKey = useRef<string | null>(null);
  const activeScrubVal = useRef<number | null>(null);

  const [maxChartValue, setMaxChartValue] = useState<number>(100);
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

  const loadAnalyticsData = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);

      // Safely ensure all required tables exist before firing queries
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          avatarColor TEXT NOT NULL,
          isDefault INTEGER DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'EUR'
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profileId INTEGER NOT NULL DEFAULT 1,
          date TEXT NOT NULL,
          amount REAL NOT NULL,
          rawDescription TEXT NOT NULL,
          merchant TEXT NOT NULL,
          category TEXT NOT NULL,
          monthName TEXT NOT NULL,
          userOverridden INTEGER DEFAULT 0,
          isZeroFlagged INTEGER DEFAULT 0,
          dateAmbiguous INTEGER DEFAULT 0,
          is_fixed INTEGER
        );

        CREATE TABLE IF NOT EXISTS category_goals (
          category TEXT NOT NULL,
          profileId INTEGER NOT NULL DEFAULT 1,
          monthly_limit REAL NOT NULL,
          PRIMARY KEY (category, profileId)
        );

        CREATE TABLE IF NOT EXISTS fixed_cost_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profileId INTEGER NOT NULL DEFAULT 1,
          keyword TEXT NOT NULL,
          category TEXT NOT NULL,
          overrideState TEXT NOT NULL DEFAULT 'FIXED',
          UNIQUE(keyword, profileId)
        );
      `);

      const dbYears = await getAvailableYears(db, activeProfileId);
      if (dbYears && dbYears.length > 0) {
        setAvailableYears(dbYears);
        if (!dbYears.includes(selectedYear)) {
          setSelectedYear(dbYears[0]);
        }
      }

      const categoryTotalsPromises = CATEGORIES.slice(1).map(async (cat) => {
        const trend = await getAnnualTrendWithBudget(db, selectedYear, cat, activeProfileId);
        const sum = (trend || []).reduce((acc, m) => acc + m.totalAmount, 0);
        return { category: cat, total: sum };
      });

      const categoryTotals = await Promise.all(categoryTotalsPromises);
      categoryTotals.sort((a, b) => b.total - a.total);
      setSortedCategories(['All', ...categoryTotals.map((item) => item.category)]);

      const [trendWithBudget, currentGoal, coverageRes] = await Promise.all([
        getAnnualTrendWithBudget(db, selectedYear, selectedCategory, activeProfileId),
        getCategoryGoal(db, selectedCategory, activeProfileId),
        getYearCoverageStatus(db, selectedYear, activeProfileId),
      ]);

      setCategoryBudget(currentGoal);
      setRawTrendData(trendWithBudget || []);

      const values = (trendWithBudget || []).map((m) => m.totalAmount);
      const peakVal = Math.max(...values, currentGoal, 10);
      setMaxChartValue(Math.ceil(peakVal * 1.15));

      const total = values.reduce((a, b) => a + b, 0);
      const activeValues = values.filter((v) => v > 0);
      const avg = activeValues.length > 0 ? total / activeValues.length : 0;

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
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, selectedYear, selectedCategory, activeProfileId]);

  const chartData = React.useMemo(() => {
    return rawTrendData.map((item) => {
      const hasData = item.totalAmount > 0;
      const val = hasData ? Math.round(item.totalAmount) : 0;
      const isSelected = item.monthName === selectedMonthKey;
      let ptColor = activeColor;

      if (item.budgetLimit > 0 && hasData) {
        if (val > item.budgetLimit) ptColor = '#FF3B30';
        else if (val === item.budgetLimit) ptColor = '#FFCC00';
        else ptColor = '#34C759';
      }

      const labelStyle: TextStyle = isSelected
        ? { color: activeColor, fontWeight: '800', fontSize: 11 }
        : { color: colors.textSecondary, fontWeight: '400', fontSize: 10 };

      return {
        value: val,
        label: item.monthName.split('-')[1],
        monthKey: item.monthName,
        hideDataPoint: !hasData,
        labelTextStyle: labelStyle,
        customDataPoint: hasData
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
  }, [rawTrendData, selectedMonthKey, activeColor, colors.card, colors.textSecondary]);

  useFocusEffect(
    useCallback(() => {
      loadAnalyticsData();
    }, [loadAnalyticsData])
  );
  
  const currentYearIndex = availableYears.indexOf(selectedYear);
  const canGoPrev = currentYearIndex < availableYears.length - 1;
  const canGoNext = currentYearIndex > 0;

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
      const items = await getTransactionsByMonthAndCategory(
        db,
        monthKey,
        selectedCategory,
        activeProfileId
      );
      setModalTransactions(items || []);

      const fixedSummaryData = await getFixedVsFlexibleSummary(
        db,
        monthKey,
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
        const fixedState = await getTransactionFixedState(db, trx, activeProfileId);
        setCurrentFixedState(fixedState);
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
      const updated = await getTransactionsByMonthAndCategory(
        db,
        selectedMonthForModal,
        selectedCategory,
        activeProfileId
      );
      setModalTransactions(updated || []);

      const updatedSummary = await getFixedVsFlexibleSummary(
        db,
        selectedMonthForModal,
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
            <Text style={[styles.stepperLabel, { color: colors.text }]}>{selectedYear}</Text>
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

        {/* Horizontal Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillScrollView}
          contentContainerStyle={styles.pillContainer}
        >
          {sortedCategories.map((cat) => {
            const isActive = selectedCategory === cat;
            const color = cat === 'All' ? colors.accent : getCategoryColor(cat);

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

        {/* Metric Summary Layout */}
        <View style={styles.metricsContainer}>
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.heroHeader}>
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                {selectedCategory === 'All' ? `Total ${selectedYear} Spending` : `Total ${selectedYear} ${selectedCategory}`}
              </Text>
              <View style={[styles.heroBadge, { backgroundColor: `${activeColor}18` }]}>
                <Text style={[styles.heroBadgeText, { color: activeColor }]}>Annual</Text>
              </View>
            </View>
            <Text style={[styles.heroValue, { color: activeColor }]}>
              {currencySymbol}{summary.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>

          <View style={styles.subRow}>
            <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                Monthly Avg
              </Text>
              <Text style={[styles.subValue, { color: colors.text }]}>
                {currencySymbol}{summary.average.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </Text>
            </View>

            <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                Peak Month
              </Text>
              <Text style={[styles.subValue, { color: colors.text }]}>
                {formatShortMonth(summary.highestMonth)}
              </Text>
            </View>

            <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                Lowest Month
              </Text>
              <Text style={[styles.subValue, { color: colors.text }]}>
                {formatShortMonth(summary.lowestMonth)}
              </Text>
            </View>
          </View>
        </View>

        {/* Annual Expenses Chart Card */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>{selectedYear} Expenses</Text>
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
                  ? `${MONTH_NAMES[selectedMonthKey] || selectedMonthKey} (Tap to clear)`
                  : 'Drag across line to select month'}
              </Text>
            </TouchableOpacity>
          </View>

          {loading && !refreshing ? (
            <ActivityIndicator size="small" color={activeColor} style={{ paddingVertical: 40 }} />
          ) : (
            <View style={styles.chartWrapper} onTouchEnd={handleScrubDrop}>
              <LineChart
                key={`${selectedCategory}-${categoryBudget}-${selectedYear}`}
                data={chartData}
                maxValue={maxChartValue}
                noOfSections={3}
                color={activeColor}
                thickness={2.5}
                startFillColor={`${activeColor}33`}
                endFillColor={`${activeColor}00`}
                startOpacity={0.3}
                endOpacity={0.0}
                areaChart
                curved
                height={140}
                spacing={24}
                xAxisThickness={1}
                yAxisThickness={0}
                xAxisColor={colors.border}
                yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                {...(categoryBudget > 0
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
                      {formatShortMonth(selectedMonthKey)} Spent
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
                  Deselect {MONTH_NAMES[selectedMonthKey] || selectedMonthKey}
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

      {/* Year Picker Modal Sheet */}
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
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Year</Text>
              </View>
              <ScrollView style={{ maxHeight: 240 }}>
                {availableYears.map((yr) => {
                  const isSelected = selectedYear === yr;
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
                      onPress={() => {
                        setSelectedYear(yr);
                        setSelectedMonthKey(null);
                        setSelectedAmount(null);
                        setYearPickerVisible(false);
                      }}
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

      {/* Modals */}
      <TransactionListModal
        visible={listModalVisible}
        listType="EXPENSE"
        selectedMonth={selectedMonthForModal}
        monthNames={MONTH_NAMES}
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
  content: { padding: 20, paddingBottom: 40 },
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

  pillScrollView: { marginBottom: 16, marginTop: 4 },
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
  sheetItemActive: { borderRadius: 12 },
  sheetItemText: { fontSize: 16, fontWeight: '500' },
  sheetItemTextActive: { fontWeight: '700' },
});