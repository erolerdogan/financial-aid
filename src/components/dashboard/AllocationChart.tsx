import { getCategoryColor } from '@/constants/colors';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { CategoryTotal } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

interface AllocationChartProps {
  categoryData: CategoryTotal[];
  /** Monthly limit per category; pass an empty object when the period is not a single month. */
  budgets: Record<string, number>;
  onCategoryPress: (categoryName: string) => void;
  onOpenBudgets: () => void;
}

export function AllocationChart({
  categoryData,
  budgets,
  onCategoryPress,
  onOpenBudgets,
}: AllocationChartProps) {
  const { colors } = useTheme();
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
        <TouchableOpacity activeOpacity={0.7} onPress={onOpenBudgets} hitSlop={8}>
          <Text style={[styles.resetFilterText, { color: colors.accent }]}>Budgets</Text>
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

                return (
                  <Path
                    key={`${item.category}-${index}`}
                    d={`M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`}
                    fill="none"
                    stroke={getCategoryColor(item.category)}
                    strokeWidth={strokeWidth}
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

      {/* Category list; each row opens the transactions behind it */}
      <View style={styles.bottomLegendList}>
        {displayedCategories.map((item) => {
          const percentage = totalSpending > 0 ? (item.totalAmount / totalSpending) * 100 : 0;
          const color = getCategoryColor(item.category);
          const budget = budgets[item.category] ?? 0;
          const isOver = budget > 0 && item.totalAmount > budget;

          return (
            <TouchableOpacity
              key={item.category}
              style={[styles.legendRow, { backgroundColor: colors.surface }]}
              activeOpacity={0.7}
              onPress={() => onCategoryPress(item.category)}
            >
              <View style={styles.legendTop}>
                <View style={styles.legendLeft}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={[styles.legendLabel, { color: colors.text }]} numberOfLines={1}>
                    {item.category}
                  </Text>
                </View>

                <View style={styles.legendRight}>
                  <Text style={[styles.amountText, { color: isOver ? '#FF3B30' : colors.text }]}>
                    {currencySymbol}{item.totalAmount.toFixed(0)}
                    {budget > 0 && (
                      <Text style={[styles.budgetText, { color: colors.textSecondary }]}>
                        {' '}/ {currencySymbol}{budget.toFixed(0)}
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
                  <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
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

        {showAllCategories && categoryData.length > 4 && (
          <TouchableOpacity
            style={styles.expandLegendBtn}
            activeOpacity={0.7}
            onPress={() => setShowAllCategories(false)}
          >
            <Text style={[styles.expandLegendText, { color: colors.accent }]}>Show Less</Text>
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