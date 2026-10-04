import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FixedCostSummary } from '@/db/database';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FixedFlexibleCardProps {
  summary: FixedCostSummary;
  onPressFixed?: () => void;
  onPressFlexible?: () => void;
}

export function FixedFlexibleCard({ summary, onPressFixed, onPressFlexible }: FixedFlexibleCardProps) {
  const { colors, isDark } = useTheme();
  const { currencySymbol } = useProfile();
  const { fixedTotal, flexibleTotal, fixedPercentage, flexiblePercentage, fixedItemsCount } = summary;

  const displayFixedPct = Math.round(fixedPercentage);
  const displayFlexiblePct = Math.round(flexiblePercentage);

  return (
    <View
      style={[
        styles.cardContainer,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Fixed vs. Flexible</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: isDark ? '#2A2840' : '#5856D615' },
          ]}
        >
          <Text style={[styles.badgeText, { color: '#5856D6' }]}>
            {fixedItemsCount} Fixed Items
          </Text>
        </View>
      </View>

      {/* Two-Tone Progress Bar */}
      <View
        style={[
          styles.barContainer,
          { backgroundColor: colors.track },
        ]}
      >
        <View style={[styles.fixedBar, { width: `${displayFixedPct}%` }]} />
        <View style={[styles.flexibleBar, { width: `${displayFlexiblePct}%` }]} />
      </View>

      {/* Simplified Metrics Row */}
      <View style={styles.statsRow}>
        {/* Fixed Overhead */}
        <TouchableOpacity style={styles.statCol} activeOpacity={0.7} onPress={onPressFixed} disabled={!onPressFixed}>
          <View style={styles.indicatorRow}>
            <View style={[styles.dot, { backgroundColor: '#5856D6' }]} />
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Fixed</Text>
          </View>
          <Text style={[styles.statAmount, { color: colors.text }]}>
            {currencySymbol}{fixedTotal.toFixed(0)}{' '}
            <Text style={[styles.statPercent, { color: colors.textSecondary }]}>
              ({displayFixedPct}%)
            </Text>
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.divider,
            { backgroundColor: colors.track },
          ]}
        />

        {/* Flexible Spending */}
        <TouchableOpacity style={styles.statCol} activeOpacity={0.7} onPress={onPressFlexible} disabled={!onPressFlexible}>
          <View style={styles.indicatorRow}>
            <View style={[styles.dot, { backgroundColor: '#FF9500' }]} />
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Flexible</Text>
          </View>
          <Text style={[styles.statAmount, { color: colors.text }]}>
            {currencySymbol}{flexibleTotal.toFixed(0)}{' '}
            <Text style={[styles.statPercent, { color: colors.textSecondary }]}>
              ({displayFlexiblePct}%)
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  barContainer: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 14,
  },
  fixedBar: {
    backgroundColor: '#5856D6',
    height: '100%',
  },
  flexibleBar: {
    backgroundColor: '#FF9500',
    height: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    marginHorizontal: 12,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  statPercent: {
    fontSize: 12,
    fontWeight: '500',
  },
});