import { getCategoryColor } from '@/constants/colors';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { CategoryTotal, Transaction } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

interface AllocationChartProps {
  categoryData: CategoryTotal[];
  /** Monthly limit per category; pass an empty object when the period is not a single month. */
  budgets: Record<string, number>;
  /** Category whose transactions are shown inline, or null when all rows are collapsed. */
  expandedCategory: string | null;
  expandedTransactions: Transaction[];
  loadingTransactions: boolean;
  onCategoryPress: (categoryName: string) => void;
  onSelectTransaction: (trx: Transaction) => void;
  onOpenBudgets: () => void;
}

export function AllocationChart({
  categoryData,
  budgets,
  expandedCategory,
  expandedTransactions,
  loadingTransactions,
  onCategoryPress,
  onSelectTransaction,
  onOpenBudgets,
}: AllocationChartProps) {
  const { colors } = useTheme();
  const { currencySymbol } = useProfile();
  const { t, format, categoryName } = useI18n();
  const [showAllCategories, setShowAllCategories] = useState(false);

  if (categoryData.length === 0) return null;

  const totalSpending = categoryData.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const displayedCategories = showAllCategories ? categoryData : categoryData.slice(0, 4);

  // Geometry Setup for Hero Donut Chart
  const radius = 68;
  const strokeWidth = 18;
  const center = radius + strokeWidth;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercentage = 0;

  return (
    <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.chartHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.allocation')}</Text>
        <TouchableOpacity activeOpacity={0.7} onPress={onOpenBudgets} hitSlop={8}>
          <Text style={[styles.resetFilterText, { color: colors.accent }]}>{t('settings.budgets')}</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Donut Chart */}
      <View style={styles.centerChartWrapper}>
        <View style={styles.svgContainer}>
          <Svg width={center * 2} height={center * 2}>
            <G rotation="-90" origin={`${center}, ${center}`}>
              {displayedCategories.map((item, index) => {
                const percentage = totalSpending > 0 ? (item.totalAmount / totalSpending) * 100 : 0;
                const strokeDasharray = `${(circumference * percentage) / 100} ${circumference}`;
                const strokeDashoffset = -((circumference * accumulatedPercentage) / 100);
                accumulatedPercentage += percentage;

                const isSelected = expandedCategory === item.category;
                const isDimmed = expandedCategory !== null && !isSelected;

                return (
                  <Path
                    key={`${item.category}-${index}`}
                    d={`M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`}
                    fill="none"
                    stroke={isDimmed ? colors.track : getCategoryColor(item.category)}
                    strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                  />
                );
              })}
            </G>
          </Svg>
          <View style={styles.centerTextContainer}>
            <Text style={[styles.totalAmount, { color: colors.text }]}>
              {format.money(totalSpending, currencySymbol)}
            </Text>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>{t('home.totalExpenses')}</Text>
          </View>
        </View>
      </View>

      {/* Category list; each row expands to the transactions behind it */}
      <View style={styles.bottomLegendList}>
        {displayedCategories.map((item) => {
          const percentage = totalSpending > 0 ? (item.totalAmount / totalSpending) * 100 : 0;
          const color = getCategoryColor(item.category);
          const budget = budgets[item.category] ?? 0;
          const isOver = budget > 0 && item.totalAmount > budget;
          const isSelected = expandedCategory === item.category;

          return (
            <View key={item.category}>
              <TouchableOpacity
                style={[
                  styles.legendRow,
                  { backgroundColor: isSelected ? colors.tintBackground : colors.surface },
                ]}
                activeOpacity={0.7}
                onPress={() => onCategoryPress(item.category)}
              >
                <View style={styles.legendTop}>
                  <View style={styles.legendLeft}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    <Text style={[styles.legendLabel, { color: colors.text }]} numberOfLines={1}>
                      {categoryName(item.category)}
                    </Text>
                  </View>

                  <View style={styles.legendRight}>
                    <Text style={[styles.amountText, { color: isOver ? '#FF3B30' : colors.text }]}>
                      {format.money(item.totalAmount, currencySymbol)}
                      {budget > 0 && (
                        <Text style={[styles.budgetText, { color: colors.textSecondary }]}>
                          {' '}/ {format.money(budget, currencySymbol)}
                        </Text>
                      )}
                    </Text>
                    <Text
                      style={[
                        styles.percentBadge,
                        {
                          backgroundColor: colors.track,
                          color: colors.textSecondary,
                        },
                      ]}
                    >
                      {percentage.toFixed(0)}%
                    </Text>
                    <Ionicons
                      name={isSelected ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.textSecondary}
                    />
                  </View>
                </View>

                {budget > 0 && (
                  <View style={[styles.budgetTrack, { backgroundColor: colors.track }]}>
                    <View
                      style={[
                        styles.budgetBar,
                        {
                          width: `${Math.min(100, (item.totalAmount / budget) * 100)}%`,
                          backgroundColor: isOver ? '#FF3B30' : color,
                        },
                      ]}
                    />
                  </View>
                )}
              </TouchableOpacity>

              {isSelected && (
                <View style={[styles.inlineTrxContainer, { borderColor: colors.border }]}>
                  {loadingTransactions ? (
                    <ActivityIndicator size="small" color={colors.accent} style={styles.inlineLoader} />
                  ) : expandedTransactions.length === 0 ? (
                    <Text style={[styles.noTrxText, { color: colors.textSecondary }]}>
                      {t('home.noCategoryTransactions')}
                    </Text>
                  ) : (
                    expandedTransactions.map((trx, idx) => (
                      <TouchableOpacity
                        key={trx.id}
                        style={[
                          styles.trxRow,
                          idx < expandedTransactions.length - 1 && [
                            styles.trxRowBorder,
                            { borderBottomColor: colors.border },
                          ],
                        ]}
                        activeOpacity={0.7}
                        onPress={() => onSelectTransaction(trx)}
                      >
                        <View style={styles.trxLeft}>
                          <Text style={[styles.trxDesc, { color: colors.text }]} numberOfLines={1}>
                            {trx.merchant !== 'Unknown' ? trx.merchant : trx.rawDescription}
                          </Text>
                          <Text style={[styles.trxDate, { color: colors.textSecondary }]}>{trx.date}</Text>
                        </View>
                        <Text style={[styles.trxAmount, { color: trx.amount < 0 ? colors.text : '#34C759' }]}>
                          {trx.amount < 0
                            ? `-${format.money(Math.abs(trx.amount), currencySymbol, 2)}`
                            : `+${format.money(trx.amount, currencySymbol, 2)}`}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}

        {!showAllCategories && categoryData.length > 4 && (
          <TouchableOpacity
            style={styles.expandLegendBtn}
            activeOpacity={0.7}
            onPress={() => setShowAllCategories(true)}
          >
            <Text style={[styles.expandLegendText, { color: colors.accent }]}>
              {t('home.viewAllCategories', { count: categoryData.length })}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.accent} />
          </TouchableOpacity>
        )}

        {showAllCategories && categoryData.length > 4 && (
          <TouchableOpacity
            style={styles.expandLegendBtn}
            activeOpacity={0.7}
            onPress={() => setShowAllCategories(false)}
          >
            <Text style={[styles.expandLegendText, { color: colors.accent }]}>{t('home.showLess')}</Text>
            <Ionicons name="chevron-up" size={14} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  resetFilterText: { fontSize: 12, fontWeight: '600' },

  centerChartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  svgContainer: {
    position: 'relative',
    width: (68 + 18) * 2,
    height: (68 + 18) * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },

  bottomLegendList: {
    marginTop: 8,
    gap: 6,
  },
  legendRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  legendTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  budgetText: { fontSize: 12, fontWeight: '500' },
  budgetTrack: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  budgetBar: { height: '100%', borderRadius: 2 },
  amountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  percentBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },

  inlineTrxContainer: {
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inlineLoader: { paddingVertical: 10 },
  trxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  trxRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  trxLeft: { flex: 1, marginRight: 8 },
  trxDesc: { fontSize: 13, fontWeight: '500' },
  trxDate: { fontSize: 11, marginTop: 1 },
  trxAmount: { fontSize: 13, fontWeight: '600' },
  noTrxText: { fontSize: 12, paddingVertical: 8 },

  expandLegendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  expandLegendText: {
    fontSize: 12,
    fontWeight: '600',
  },
});