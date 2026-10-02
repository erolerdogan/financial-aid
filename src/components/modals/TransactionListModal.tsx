import { CategoryFilterBar } from '@/components/CategoryFilterBar';
import { FixedFlexibleCard } from '@/components/dashboard/FixedFlexibleCard';
import { getCategoryColor } from '@/constants/colors';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FixedCostSummary, Transaction } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
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
}: TransactionListModalProps) {
  const { colors, isDark } = useTheme();
  const { currencySymbol } = useProfile();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<ExpenseFilterMode>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isReady, setIsReady] = useState(false);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

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

  const panResponder = useRef(
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
  ).current;

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSelectedCategory('All');
      setFilterMode(listType === 'FIXED' ? 'FIXED' : listType === 'FLEXIBLE' ? 'FLEXIBLE' : 'ALL');
      setIsReady(false);

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
  }, [visible, listType]);

  const monthLabel = monthNames[selectedMonth] || selectedMonth;
  const isExpenseModal = listType === 'EXPENSE' || listType === 'FIXED' || listType === 'FLEXIBLE';
  const modalTitle = isExpenseModal ? 'Expenses' : 'Income Items';

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
                    {isFixed ? 'FIXED' : 'FLEX'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.trxMeta, { color: colors.textSecondary }]}>
              {trx.date} • {trx.category}
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
              ? `-${currencySymbol}${Math.abs(trx.amount).toFixed(2)}`
              : `+${currencySymbol}${trx.amount.toFixed(2)}`}
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
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{modalTitle}</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>{monthLabel}</Text>
              </View>
              <View style={[styles.totalBadge, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                <Text style={[styles.totalBadgeText, { color: colors.text }]}>
                  {currencySymbol}{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
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

                    {/* Search Bar */}
                    <View
                      style={[
                        styles.searchBarContainer,
                        {
                          backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
                      <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search merchant, description..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                        autoCorrect={false}
                      />
                      {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                          <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Segmented Filter Control */}
                    <View style={[styles.segmentedContainer, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          filterMode === 'ALL' && [styles.segmentBtnActive, { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }],
                        ]}
                        onPress={() => setFilterMode('ALL')}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: colors.textSecondary },
                            filterMode === 'ALL' && [styles.segmentTextActive, { color: colors.accent }],
                          ]}
                        >
                          All
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          filterMode === 'FIXED' && [styles.segmentBtnActive, { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }],
                        ]}
                        onPress={() => setFilterMode('FIXED')}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: colors.textSecondary },
                            filterMode === 'FIXED' && [styles.segmentTextActive, { color: colors.accent }],
                          ]}
                        >
                          Fixed
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          filterMode === 'FLEXIBLE' && [styles.segmentBtnActive, { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }],
                        ]}
                        onPress={() => setFilterMode('FLEXIBLE')}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: colors.textSecondary },
                            filterMode === 'FLEXIBLE' && [styles.segmentTextActive, { color: colors.accent }],
                          ]}
                        >
                          Flexible
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
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {searchQuery.trim().length > 0
                        ? `No matches found for "${searchQuery}"`
                        : `No ${filterMode !== 'ALL' ? filterMode.toLowerCase() : ''} transactions found for this period.`}
                    </Text>
                  </View>
                }
              />
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
              onPress={handleDismiss}
            >
              <Text style={[styles.closeBtnText, { color: colors.accent }]}>Close</Text>
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