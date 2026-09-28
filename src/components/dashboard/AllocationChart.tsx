import { getCategoryColor } from '@/constants/colors';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { CategoryTotal, Transaction } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

interface AllocationChartProps {
  categoryData: CategoryTotal[];
  selectedBarCategory: string | null;
  selectedCategoryTransactions: Transaction[];
  loadingTransactions: boolean;
  onBarPress: (categoryName: string) => void;
  onSelectTransaction: (trx: Transaction) => void;
}

export function AllocationChart({
  categoryData,
  selectedBarCategory,
  selectedCategoryTransactions,
  loadingTransactions,
  onBarPress,
  onSelectTransaction,
}: AllocationChartProps) {
  const { colors, isDark } = useTheme();
  const { currencySymbol } = useProfile();
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending Allocation</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (selectedBarCategory) {
              onBarPress(selectedBarCategory);
            } else {
              setShowAllCategories(!showAllCategories);
            }
          }}
        >
          <Text style={[styles.resetFilterText, { color: colors.accent }]}>
            {selectedBarCategory ? 'Show All Categories' : showAllCategories ? 'Collapse' : 'Show All'}
          </Text>
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

                const isSelected = selectedBarCategory === item.category;
                const isDimmed = selectedBarCategory !== null && !isSelected;
                const color = isDimmed ? (isDark ? '#38383A' : '#E5E5EA') : getCategoryColor(item.category);

                return (
                  <Path
                    key={`${item.category}-${index}`}
                    d={`M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`}
                    fill="none"
                    stroke={color}
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
              {currencySymbol}{totalSpending.toFixed(0)}
            </Text>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total Expenses</Text>
          </View>
        </View>
      </View>

      {/* Structured Category List with Inline Item Breakdown */}
      <View style={styles.bottomLegendList}>
        {displayedCategories.map((item) => {
          const percentage = totalSpending > 0 ? (item.totalAmount / totalSpending) * 100 : 0;
          const isSelected = selectedBarCategory === item.category;
          const isDimmed = selectedBarCategory !== null && !isSelected;
          const color = getCategoryColor(item.category);

          return (
            <View key={item.category} style={styles.categoryContainer}>
              <TouchableOpacity
                style={[
                  styles.legendRow,
                  { backgroundColor: isDark ? '#2C2C2E' : '#FAF9F9' },
                  isSelected && { backgroundColor: colors.tintBackground },
                ]}
                activeOpacity={0.7}
                onPress={() => onBarPress(item.category)}
              >
                <View style={styles.legendLeft}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: isDimmed ? colors.textSecondary : color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.legendLabel,
                      { color: colors.text },
                      isDimmed && { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {item.category}
                  </Text>
                </View>

                <View style={styles.legendRight}>
                  <Text
                    style={[
                      styles.amountText,
                      { color: colors.text },
                      isDimmed && { color: colors.textSecondary },
                    ]}
                  >
                    {currencySymbol}{item.totalAmount.toFixed(0)}
                  </Text>
                  <Text
                    style={[
                      styles.percentBadge,
                      {
                        backgroundColor: isDark ? '#38383A' : '#E5E5EA',
                        color: colors.textSecondary,
                      },
                      isDimmed && { opacity: 0.5 },
                    ]}
                  >
                    {percentage.toFixed(0)}%
                  </Text>
                  <Ionicons
                    name={isSelected ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.textSecondary}
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </TouchableOpacity>

              {/* Inline Items List directly inside the Spending Allocation Card */}
              {isSelected && (
                <View
                  style={[
                    styles.inlineTrxContainer,
                    { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderColor: colors.border },
                  ]}
                >
                  {loadingTransactions ? (
                    <ActivityIndicator size="small" color={colors.accent} style={{ paddingVertical: 10 }} />
                  ) : selectedCategoryTransactions.length === 0 ? (
                    <Text style={[styles.noTrxText, { color: colors.textSecondary }]}>
                      No recorded items for this category.
                    </Text>
                  ) : (
                    selectedCategoryTransactions.map((trx, idx) => {
                      const isLast = idx === selectedCategoryTransactions.length - 1;
                      return (
                        <TouchableOpacity
                          key={trx.id}
                          style={[
                            styles.trxRow,
                            !isLast && [styles.trxRowBorder, { borderBottomColor: colors.border }],
                          ]}
                          activeOpacity={0.7}
                          onPress={() => onSelectTransaction(trx)}
                        >
                          <View style={styles.trxLeft}>
                            <Ionicons
                              name="receipt-outline"
                              size={13}
                              color={colors.textSecondary}
                              style={{ marginRight: 8 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.trxDesc, { color: colors.text }]} numberOfLines={1}>
                                {trx.merchant !== 'Unknown' ? trx.merchant : trx.rawDescription}
                              </Text>
                              <Text style={[styles.trxDate, { color: colors.textSecondary }]}>
                                {trx.date}
                              </Text>
                            </View>
                          </View>
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
                        </TouchableOpacity>
                      );
                    })
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
              View All {categoryData.length} Categories
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.accent} />
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
  categoryContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
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
    gap: 8,
  },
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

  /* Inline Item List Styling */
  inlineTrxContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -4,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
  },
  trxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  trxRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trxLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  trxDesc: { fontSize: 12, fontWeight: '500' },
  trxDate: { fontSize: 10, marginTop: 1 },
  trxAmount: { fontSize: 12, fontWeight: '600' },
  noTrxText: { fontSize: 11, fontStyle: 'italic', paddingVertical: 6 },

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