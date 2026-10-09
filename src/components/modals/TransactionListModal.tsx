import { CategoryFilterBar } from '@/components/CategoryFilterBar';
import { FixedFlexibleCard } from '@/components/dashboard/FixedFlexibleCard';
import { QuickAddButton } from '@/components/QuickAddButton';
import { SelectableText } from '@/components/SelectableText';
import { getCategoryColor } from '@/constants/colors';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FixedCostSummary, Transaction } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ExpenseFilterMode = 'ALL' | 'FIXED' | 'FLEXIBLE';

interface TransactionListModalProps {
  visible: boolean;
  listType: 'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE';
  selectedMonth: string;
  monthNames: Record<string, string>;
  transactions: Transaction[];
  loading: boolean;
  fixedSummary?: FixedCostSummary;
  onClose: () => void;
  onSelectTransaction: (trx: Transaction) => void;
  profileId?: number;
  /** Uncategorised transactions the listed category can take; 0 hides the quick add button. */
  uncategorisedCount?: number;
  onAddUncategorised?: () => void;
}

export function TransactionListModal({
  visible,
  listType,
  selectedMonth,
  monthNames,
  transactions,
  loading,
  fixedSummary,
  onClose,
  onSelectTransaction,
  uncategorisedCount = 0,
  onAddUncategorised,
}: TransactionListModalProps) {
  const { colors, isDark } = useTheme();
  const { currencySymbol, currencyDecimals } = useProfile();
  const { t, format, categoryName } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<ExpenseFilterMode>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isReady, setIsReady] = useState(false);

  const [translateY] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const [overlayOpacity] = useState(() => new Animated.Value(0));

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsReady(false);
      onClose();
    });
  };

  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 250,
          }).start();
        }
      },
    })
  );

  // Opening the list, or another kind of list while it is open, starts its filters again.
  const [shown, setShown] = useState({ visible: false, listType });
  if (shown.visible !== visible || shown.listType !== listType) {
    setShown({ visible, listType });
    if (visible) {
      setSearchQuery('');
      setSelectedCategory('All');
      setFilterMode(listType === 'FIXED' ? 'FIXED' : listType === 'FLEXIBLE' ? 'FLEXIBLE' : 'ALL');
      setIsReady(false);
    }
  }

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_HEIGHT);
      overlayOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 260,
          mass: 0.8,
        }),
      ]).start();

      const task = InteractionManager.runAfterInteractions(() => {
        setIsReady(true);
      });

      return () => task.cancel();
    }
  }, [visible, listType, translateY, overlayOpacity]);

  const monthLabel = monthNames[selectedMonth] || selectedMonth;
  const isExpenseModal = listType === 'EXPENSE' || listType === 'FIXED' || listType === 'FLEXIBLE';
  const modalTitle = isExpenseModal ? t('list.expense') : t('list.income');

  const scopedTransactions = transactions.filter((tx) => {
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      const merchant = (tx.merchant || '').toLowerCase();
      const desc = (tx.rawDescription || '').toLowerCase();
      const category = (tx.category || '').toLowerCase();
      const matchesSearch = merchant.includes(query) || desc.includes(query) || category.includes(query);
      if (!matchesSearch) return false;
    }

    if (filterMode === 'ALL') return true;
    const isFixed = tx.is_fixed === 1;
    if (filterMode === 'FIXED') return isFixed;
    if (filterMode === 'FLEXIBLE') return !isFixed;
    return true;
  });

  const categoryTotals = new Map<string, number>();
  scopedTransactions.forEach((tx) => {
    const key = tx.category || 'Other';
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + Math.abs(tx.amount));
  });
  const categoryOptions = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const activeCategory = categoryOptions.includes(selectedCategory) ? selectedCategory : 'All';

  const displayedTransactions =
    activeCategory === 'All'
      ? scopedTransactions
      : scopedTransactions.filter((tx) => (tx.category || 'Other') === activeCategory);

  const totalAmount = displayedTransactions.reduce((acc, tx) => acc + Math.abs(tx.amount), 0);

  const renderTransactionItem = ({ item: trx }: { item: Transaction }) => {
    const isFixed = trx.is_fixed === 1;
    return (
      <TouchableOpacity
        style={[styles.trxRow, { borderBottomColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => onSelectTransaction(trx)}
        accessibilityRole="button"
      >
        <View style={styles.trxLeft}>
          <View
            style={[
              styles.categoryDot,
              { backgroundColor: getCategoryColor(trx.category) },
            ]}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.merchantRow}>
              <Text style={[styles.trxMerchant, { color: colors.text }]} numberOfLines={1}>
                {trx.merchant !== 'Unknown' ? trx.merchant : trx.rawDescription}
              </Text>
              {filterMode === 'ALL' && (
                <View
                  style={[
                    styles.fixedBadge,
                    isFixed ? styles.fixedBadgeActive : styles.flexibleBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.fixedBadgeText,
                      isFixed ? styles.fixedBadgeTextActive : styles.flexibleBadgeTextActive,
                    ]}
                  >
                    {isFixed ? t('fixed.badgeFixed') : t('fixed.badgeFlex')}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.trxMeta, { color: colors.textSecondary }]}>
              {trx.date} • {categoryName(trx.category)}
            </Text>
          </View>
        </View>

        <View style={styles.trxRight}>
          <Text
            style={[
              styles.trxAmount,
              { color: trx.amount < 0 ? colors.text : '#34C759' },
            ]}
          >
            {trx.amount < 0
              ? `-${format.money(Math.abs(trx.amount), currencySymbol, currencyDecimals)}`
              : `+${format.money(trx.amount, currencySymbol, currencyDecimals)}`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(0,0,0,0.5)',
                opacity: overlayOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: isDark ? colors.card : colors.background,
                borderColor: colors.border,
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Swipe Drag Bar */}
            <View style={styles.handleContainer} {...panResponder.panHandlers}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            </View>

            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <SelectableText style={[styles.sheetTitle, { color: colors.text }]}>{modalTitle}</SelectableText>
                <SelectableText style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>{monthLabel}</SelectableText>
              </View>
              <View style={[styles.totalBadge, { backgroundColor: colors.surface }]}>
                <SelectableText style={[styles.totalBadgeText, { color: colors.text }]}>
                  {format.money(totalAmount, currencySymbol, currencyDecimals)}
                </SelectableText>
              </View>
            </View>

            {!isReady || loading ? (
              <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 48 }} />
            ) : (
              <FlatList
                data={displayedTransactions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderTransactionItem}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                ListHeaderComponent={
                  <>
                    {fixedSummary && (
                      <View style={styles.summaryCardWrapper}>
                        <FixedFlexibleCard summary={fixedSummary} />
                      </View>
                    )}

                    {uncategorisedCount > 0 && onAddUncategorised && (
                      <QuickAddButton
                        count={uncategorisedCount}
                        onPress={onAddUncategorised}
                        style={styles.summaryCardWrapper}
                      />
                    )}

                    {/* Search Bar */}
                    <View
                      style={[
                        styles.searchBarContainer,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
                      <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder={t('list.searchPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                        autoCorrect={false}
                      />
                      {searchQuery.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setSearchQuery('')}
                          style={styles.clearBtn}
                          hitSlop={14}
                          accessibilityRole="button"
                          accessibilityLabel={t('a11y.clearSearch')}
                        >
                          <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Segmented Filter Control */}
                    <View style={[styles.segmentedContainer, { backgroundColor: colors.track }]}>
                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          filterMode === 'ALL' && [styles.segmentBtnActive, { backgroundColor: colors.raised }],
                        ]}
                        onPress={() => setFilterMode('ALL')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: filterMode === 'ALL' }}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: colors.textSecondary },
                            filterMode === 'ALL' && [styles.segmentTextActive, { color: colors.accent }],
                          ]}
                        >
                          {t('common.all')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          filterMode === 'FIXED' && [styles.segmentBtnActive, { backgroundColor: colors.raised }],
                        ]}
                        onPress={() => setFilterMode('FIXED')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: filterMode === 'FIXED' }}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: colors.textSecondary },
                            filterMode === 'FIXED' && [styles.segmentTextActive, { color: colors.accent }],
                          ]}
                        >
                          {t('fixed.fixed')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          filterMode === 'FLEXIBLE' && [styles.segmentBtnActive, { backgroundColor: colors.raised }],
                        ]}
                        onPress={() => setFilterMode('FLEXIBLE')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: filterMode === 'FLEXIBLE' }}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: colors.textSecondary },
                            filterMode === 'FLEXIBLE' && [styles.segmentTextActive, { color: colors.accent }],
                          ]}
                        >
                          {t('fixed.flexible')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {categoryOptions.length > 1 && (
                      <View style={styles.categoryBarWrapper}>
                        <CategoryFilterBar
                          categories={categoryOptions}
                          selected={activeCategory}
                          onSelect={setSelectedCategory}
                        />
                      </View>
                    )}
                  </>
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <SelectableText style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {searchQuery.trim().length > 0
                        ? t('list.noMatches', { query: searchQuery })
                        : t(
                            filterMode === 'FIXED'
                              ? 'list.emptyFixed'
                              : filterMode === 'FLEXIBLE'
                              ? 'list.emptyFlexible'
                              : 'list.emptyAll'
                          )}
                    </SelectableText>
                  </View>
                }
              />
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.surface }]}
              onPress={handleDismiss}
              accessibilityRole="button"
            >
              <Text style={[styles.closeBtnText, { color: colors.accent }]}>{t('common.close')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  categoryBarWrapper: {
    marginHorizontal: -20,
    marginBottom: 12,
  },
  keyboardContainer: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 34,
    maxHeight: '88%',
    borderWidth: StyleSheet.hairlineWidth,
  },
  handleContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  totalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  totalBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryCardWrapper: {
    marginBottom: 12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  trxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trxMerchant: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  fixedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fixedBadgeActive: {
    backgroundColor: '#5856D615',
  },
  flexibleBadgeActive: {
    backgroundColor: '#FF950015',
  },
  fixedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  fixedBadgeTextActive: {
    color: '#5856D6',
  },
  flexibleBadgeTextActive: {
    color: '#FF9500',
  },
  trxMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  trxRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trxAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  closeBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});