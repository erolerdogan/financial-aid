import { CategoryFilterBar } from '@/components/CategoryFilterBar';
import { MonthStepper } from '@/components/dashboard/MonthStepper';
import { DateRangeModal } from '@/components/modals/DateRangeModal';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SelectableText } from '@/components/SelectableText';
import { TransactionRow } from '@/components/TransactionRow';
import { useI18n } from '@/contexts/LanguageContext';
import { usePeriod } from '@/contexts/PeriodContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    FixedOverrideState,
    getAllTransactionsByDate,
    getAvailableMonths,
    getTransactionCategories,
    getTransactionDateBounds,
    getTransactionFixedExplanation,
    getUncategorisedCount,
    setMerchantFixedOverride,
    Transaction
} from '@/db/database';
import type { Message } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAGE_SIZE = 100;

interface DaySection {
  title: string;
  data: Transaction[];
}

const NO_COVERAGE = { status: 'EMPTY' as const, label: '' };
const keyExtractor = (item: Transaction): string => String(item.id);
const EMPTY_NAMES: Record<string, string> = {};
const NO_MONTHS: string[] = [];

const toKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export default function TransactionsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ focusSearch?: string }>();
  // Read once: the header search icon opens this screen with the keyboard up.
  const [focusSearchOnMount] = useState(() => params.focusSearch === '1');

  const formatDayTitle = useCallback(
    (isoDate: string): string => {
      const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
      if (isNaN(parsed.getTime())) return isoDate;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.round((today.getTime() - parsed.getTime()) / 86400000);

      if (diffDays === 0) return t('common.today');
      if (diffDays === 1) return t('common.yesterday');

      return format.date(parsed, {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    },
    [t, format]
  );
  const { activeProfile, dataVersion } = useProfile();
  const { period: filter, setPeriod: setFilter } = usePeriod();
  const activeProfileId = activeProfile?.id ?? 1;

  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = searchInput.trim();

  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [bounds, setBounds] = useState<{ minDate: string; maxDate: string } | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [rangeModalVisible, setRangeModalVisible] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [uncategorisedCount, setUncategorisedCount] = useState(0);

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [currentFixedState, setCurrentFixedState] = useState<FixedOverrideState>('AUTO');
  const [fixedAuto, setFixedAuto] = useState<{ autoIsFixed: boolean; reason: Message[] }>({ autoIsFixed: false, reason: [] });

  const listRef = useRef<SectionList<Transaction, DaySection>>(null);
  const loadedCountRef = useRef(0);
  const fetchingRef = useRef(false);
  const lastFilterKeyRef = useRef('');
  const requestRef = useRef(0);

  const { dateFrom, dateTo } = useMemo(() => {
    if (filter.kind === 'MONTH') {
      const [y, m] = filter.month.split('-').map(Number);
      return {
        dateFrom: `${filter.month}-01`,
        dateTo: toKey(new Date(y, m, 1)),
      };
    }
    if (filter.kind === 'RANGE') {
      const nextDay = parseKey(filter.to);
      nextDay.setDate(nextDay.getDate() + 1);
      return { dateFrom: filter.from, dateTo: toKey(nextDay) };
    }
    return { dateFrom: undefined, dateTo: undefined };
  }, [filter]);

  const monthNames = useMemo(() => {
    const map: Record<string, string> = {};
    availableMonths.forEach((m) => {
      map[m] = format.monthYear(m);
    });
    return map;
  }, [availableMonths, format]);

  const stepperLabel =
    filter.kind === 'MONTH'
      ? filter.month
      : filter.kind === 'RANGE'
      ? format.range(filter.from, filter.to)
      : t('transactions.all');

  useEffect(() => {
    setSelectedCategory('All');
  }, [activeProfileId]);

  useEffect(() => {
    if (focusSearchOnMount) router.setParams({ focusSearch: undefined });
  }, [focusSearchOnMount, router]);

  const handleBack = () => {
    Haptics.selectionAsync().catch(() => {});
    // Opened by a link with nothing underneath: go to Home instead of nowhere.
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const fetchFirstPage = useCallback(
    async (keepLoadedCount: boolean = false) => {
      if (!db) return;
      const requestId = ++requestRef.current;
      fetchingRef.current = true;
      try {
        const limit = keepLoadedCount
          ? Math.max(loadedCountRef.current, PAGE_SIZE)
          : PAGE_SIZE;
        const rows = await getAllTransactionsByDate(
          db,
          activeProfileId,
          searchTerm,
          limit,
          0,
          dateFrom,
          dateTo,
          selectedCategory
        );
        // A newer keystroke or filter change superseded this query.
        if (requestId !== requestRef.current) return;
        loadedCountRef.current = rows.length;
        setItems(rows);
        setHasMore(rows.length === limit);

        const filterKey = `${activeProfileId}|${searchTerm}|${dateFrom ?? ''}|${dateTo ?? ''}|${selectedCategory}`;
        if (filterKey !== lastFilterKeyRef.current) {
          lastFilterKeyRef.current = filterKey;
          requestAnimationFrame(() => {
            try {
              (listRef.current as any)?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
            } catch {
              /* list not mounted yet */
            }
          });
        }
      } catch (error) {
        console.error('Failed to load transactions:', error);
      } finally {
        if (requestId === requestRef.current) {
          fetchingRef.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [db, activeProfileId, searchTerm, dateFrom, dateTo, selectedCategory]
  );

  const fetchNextPage = useCallback(async () => {
    if (!db || fetchingRef.current || !hasMore) return;
    const requestId = requestRef.current;
    fetchingRef.current = true;
    try {
      const rows = await getAllTransactionsByDate(
        db,
        activeProfileId,
        searchTerm,
        PAGE_SIZE,
        loadedCountRef.current,
        dateFrom,
        dateTo,
        selectedCategory
      );
      if (requestId !== requestRef.current) return;
      loadedCountRef.current += rows.length;
      setItems((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (error) {
      console.error('Failed to load more transactions:', error);
    } finally {
      if (requestId === requestRef.current) fetchingRef.current = false;
    }
  }, [db, activeProfileId, searchTerm, dateFrom, dateTo, selectedCategory, hasMore]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!db) return;
        try {
          const [months, dateBounds, cats, uncategorised] = await Promise.all([
            getAvailableMonths(db, activeProfileId),
            getTransactionDateBounds(db, activeProfileId),
            getTransactionCategories(db, activeProfileId, dateFrom, dateTo),
            getUncategorisedCount(db, activeProfileId),
          ]);
          if (!active) return;
          setAvailableMonths(months);
          setBounds(dateBounds);
          setCategories(cats);
          setUncategorisedCount(uncategorised);
          setSelectedCategory((prev) => (prev === 'All' || cats.includes(prev) ? prev : 'All'));
        } catch (error) {
          console.error('Failed to load filter options:', error);
        }
      })();
      return () => {
        active = false;
      };
    }, [db, activeProfileId, dataVersion, dateFrom, dateTo])
  );

  // Separate from the filter options above so typing only re-runs the list query.
  useFocusEffect(
    useCallback(() => {
      fetchFirstPage();
    }, [fetchFirstPage, dataVersion])
  );

  const sections = useMemo<DaySection[]>(() => {
    const result: DaySection[] = [];
    let currentKey = '';
    for (const tx of items) {
      const dayKey = tx.date.slice(0, 10);
      if (dayKey !== currentKey) {
        currentKey = dayKey;
        result.push({ title: formatDayTitle(dayKey), data: [] });
      }
      result[result.length - 1].data.push(tx);
    }
    return result;
  }, [items, formatDayTitle]);

  const monthIndex = filter.kind === 'MONTH' ? availableMonths.indexOf(filter.month) : -1;

  const handlePrevMonth = () => {
    if (filter.kind !== 'MONTH') return;
    if (monthIndex >= 0 && monthIndex < availableMonths.length - 1) {
      setFilter({ kind: 'MONTH', month: availableMonths[monthIndex + 1] });
    }
  };

  const handleNextMonth = () => {
    if (filter.kind !== 'MONTH') return;
    if (monthIndex > 0) {
      setFilter({ kind: 'MONTH', month: availableMonths[monthIndex - 1] });
    }
  };

  const handleOpenPicker = () => {
    Haptics.selectionAsync().catch(() => {});
    setPickerVisible(true);
  };

  const handlePickAll = () => {
    setFilter({ kind: 'ALL' });
    setPickerVisible(false);
  };

  const handlePickMonth = (month: string) => {
    setFilter({ kind: 'MONTH', month });
    setPickerVisible(false);
  };

  const handleOpenRange = () => {
    setPickerVisible(false);
    setTimeout(() => setRangeModalVisible(true), 250);
  };

  const handleApplyRange = (from: string, to: string) => {
    setFilter({ kind: 'RANGE', from, to });
    setRangeModalVisible(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFirstPage();
  };

  const handleSelectTransaction = useCallback(
    async (trx: Transaction) => {
      Haptics.selectionAsync().catch(() => {});
      setSelectedTransaction(trx);
      if (db) {
        const explanation = await getTransactionFixedExplanation(db, trx, activeProfileId);
        setCurrentFixedState(explanation.state);
        setFixedAuto(explanation);
      }
    },
    [db, activeProfileId]
  );

  const handleSelectFixedState = async (newState: FixedOverrideState) => {
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
    await fetchFirstPage(true);
  };

  const handleCategoryChanged = async (updated: Transaction) => {
    setSelectedTransaction(updated);
    if (!db) return;
    const explanation = await getTransactionFixedExplanation(db, updated, activeProfileId);
    setCurrentFixedState(explanation.state);
    setFixedAuto(explanation);
    await fetchFirstPage(true);
  };

  // Stable, so the rows already on screen are not rendered again while typing in the search field.
  const renderItem = useCallback(
    ({ item, index, section }: { item: Transaction; index: number; section: DaySection }) => (
      <TransactionRow
        transaction={item}
        isFirst={index === 0}
        isLast={index === section.data.length - 1}
        onPress={handleSelectTransaction}
      />
    ),
    [handleSelectTransaction]
  );

  return (
    <ScreenContainer>
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
            {t('tabs.transactions')}
          </SelectableText>
        </View>

        <MonthStepper
          selectedMonth={stepperLabel}
          availableMonths={filter.kind === 'MONTH' ? availableMonths : NO_MONTHS}
          monthNames={filter.kind === 'MONTH' ? monthNames : EMPTY_NAMES}
          coverageStatus={NO_COVERAGE}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onOpenMonthPicker={handleOpenPicker}
        />

        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('transactions.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={searchInput}
            onChangeText={setSearchInput}
            autoFocus={focusSearchOnMount}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {Platform.OS === 'android' && searchInput.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchInput('')}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.clearSearch')}
            >
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {categories.length > 1 && (
          <View style={styles.categoryBarWrap}>
            <CategoryFilterBar
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
              <SelectableText style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
                {section.title}
              </SelectableText>
            </View>
          )}
          stickySectionHeadersEnabled
          ListHeaderComponent={
            uncategorisedCount > 0 ? (
              <TouchableOpacity
                style={[styles.reviewRow, { backgroundColor: colors.card }]}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  router.push('/review');
                }}
                accessibilityRole="button"
              >
                <Ionicons name="pricetags-outline" size={18} color={colors.accent} />
                <Text style={[styles.reviewRowText, { color: colors.text }]}>
                  {t('transactions.uncategorised', { count: uncategorisedCount })}
                </Text>
                <Text style={[styles.reviewRowAction, { color: colors.accent }]}>{t('transactions.review')}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: 40 + insets.bottom }]}
          onEndReached={fetchNextPage}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} />
              <SelectableText style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchTerm.length > 0
                  ? t('transactions.noMatching')
                  : filter.kind !== 'ALL' || selectedCategory !== 'All'
                  ? t('transactions.noFilterMatch')
                  : t('transactions.none')}
              </SelectableText>
            </View>
          }
          ListFooterComponent={
            hasMore && items.length > 0 ? (
              <ActivityIndicator style={styles.footerLoader} color={colors.accent} />
            ) : null
          }
        />
      )}

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          accessible={false}
          onPress={() => setPickerVisible(false)}
        >
          <TouchableWithoutFeedback accessible={false}>
            <View
              style={[styles.sheetContainer, { backgroundColor: colors.card }]}
              onAccessibilityEscape={() => setPickerVisible(false)}
            >
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                <SelectableText style={[styles.sheetTitle, { color: colors.text }]}>{t('transactions.filterByDate')}</SelectableText>
              </View>

              <ScrollView style={styles.sheetScroll}>
                <TouchableOpacity
                  style={[
                    styles.sheetItem,
                    { borderBottomColor: colors.border },
                    filter.kind === 'ALL' && [styles.sheetItemActive, { backgroundColor: colors.tintBackground }],
                  ]}
                  onPress={handlePickAll}
                  accessibilityRole="button"
                >
                  <View style={styles.sheetItemLeft}>
                    <Ionicons name="list" size={18} color={colors.accent} />
                    <Text
                      style={[
                        styles.sheetItemText,
                        { color: filter.kind === 'ALL' ? colors.accent : colors.text },
                        filter.kind === 'ALL' && styles.sheetItemTextActive,
                      ]}
                    >
                      {t('transactions.all')}
                    </Text>
                  </View>
                  {filter.kind === 'ALL' && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sheetItem,
                    { borderBottomColor: colors.border },
                    filter.kind === 'RANGE' && [styles.sheetItemActive, { backgroundColor: colors.tintBackground }],
                  ]}
                  onPress={handleOpenRange}
                  accessibilityRole="button"
                >
                  <View style={styles.sheetItemLeft}>
                    <Ionicons name="calendar-outline" size={18} color={colors.accent} />
                    <Text
                      style={[
                        styles.sheetItemText,
                        { color: filter.kind === 'RANGE' ? colors.accent : colors.text },
                        filter.kind === 'RANGE' && styles.sheetItemTextActive,
                      ]}
                    >
                      {t('period.customRange')}
                    </Text>
                  </View>
                  {filter.kind === 'RANGE' ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>

                {availableMonths.map((m) => {
                  const isSelected = filter.kind === 'MONTH' && filter.month === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.sheetItem,
                        { borderBottomColor: colors.border },
                        isSelected && [styles.sheetItemActive, { backgroundColor: colors.tintBackground }],
                      ]}
                      onPress={() => handlePickMonth(m)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.sheetItemText,
                          { color: isSelected ? colors.accent : colors.text },
                          isSelected && styles.sheetItemTextActive,
                        ]}
                      >
                        {monthNames[m] || m}
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
        minDate={bounds?.minDate ?? null}
        maxDate={bounds?.maxDate ?? null}
        initialFrom={filter.kind === 'RANGE' ? filter.from : null}
        initialTo={filter.kind === 'RANGE' ? filter.to : null}
        onApply={handleApplyRange}
        onClose={() => setRangeModalVisible(false)}
      />

      <TransactionDetailModal
        visible={selectedTransaction !== null}
        transaction={selectedTransaction}
        fixedState={currentFixedState}
        autoIsFixed={fixedAuto.autoIsFixed}
        autoReason={fixedAuto.reason}
        parentTitle={t('tabs.transactions')}
        onClose={() => setSelectedTransaction(null)}
        onDismiss={() => setSelectedTransaction(null)}
        onSelectFixedState={handleSelectFixedState}
        onCategoryChanged={handleCategoryChanged}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  categoryBarWrap: { marginHorizontal: -20, marginTop: 8, marginBottom: 4 },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  reviewRowText: { flex: 1, fontSize: 14, fontWeight: '600' },
  reviewRowAction: { fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: 20 },
  sectionHeader: { paddingTop: 16, paddingBottom: 8 },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15 },
  footerLoader: { paddingVertical: 20 },
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
  sheetScroll: { maxHeight: 360 },
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