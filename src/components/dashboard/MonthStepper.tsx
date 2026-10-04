import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MonthCoverageStatus {
  status: 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'EMPTY';
  minDate?: string;
  maxDate?: string;
  label: string;
}

interface MonthStepperProps {
  selectedMonth: string;
  availableMonths: string[];
  monthNames: Record<string, string>;
  coverageStatus: MonthCoverageStatus;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenMonthPicker: () => void;
}

export function MonthStepper({
  selectedMonth,
  availableMonths,
  monthNames,
  coverageStatus,
  onPrevMonth,
  onNextMonth,
  onOpenMonthPicker,
}: MonthStepperProps) {
  const { colors, isDark } = useTheme();
  const currentIndex = availableMonths.indexOf(selectedMonth);
  const isPrevDisabled = currentIndex >= availableMonths.length - 1;
  const isNextDisabled = currentIndex <= 0;

  return (
    <View style={styles.container}>
      {/* Month Stepper Navigation */}
      <View
        style={[
          styles.monthNavRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.navButton,
            { backgroundColor: colors.surface },
            isPrevDisabled && { opacity: 0.5 },
          ]}
          onPress={onPrevMonth}
          disabled={isPrevDisabled}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={isPrevDisabled ? colors.textSecondary : colors.accent}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.monthTitleButton} onPress={onOpenMonthPicker}>
          <Text style={[styles.monthLabelText, { color: colors.text }]}>
            {monthNames[selectedMonth] || selectedMonth || 'Select Month'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={colors.textSecondary}
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton,
            { backgroundColor: colors.surface },
            isNextDisabled && { opacity: 0.5 },
          ]}
          onPress={onNextMonth}
          disabled={isNextDisabled}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={isNextDisabled ? colors.textSecondary : colors.accent}
          />
        </TouchableOpacity>
      </View>

      {/* Month Statement Coverage Status Badge */}
      {coverageStatus.status !== 'EMPTY' && (
        <View
          style={[
            styles.coverageBadgeRow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.coverageDot,
              coverageStatus.status === 'IN_PROGRESS' && { backgroundColor: '#FF9500' },
              coverageStatus.status === 'PARTIAL' && { backgroundColor: '#FF3B30' },
              coverageStatus.status === 'COMPLETE' && { backgroundColor: '#34C759' },
            ]}
          />
          <Text
            style={[
              styles.coverageText,
              coverageStatus.status === 'IN_PROGRESS' && {
                color: isDark ? '#FBBF24' : '#D97706',
              },
              coverageStatus.status === 'PARTIAL' && {
                color: isDark ? '#F87171' : '#DC2626',
              },
              coverageStatus.status === 'COMPLETE' && {
                color: isDark ? '#4ADE80' : '#16A34A',
              },
            ]}
          >
            {coverageStatus.label}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  navButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  monthLabelText: { fontSize: 16, fontWeight: '700' },
  coverageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  coverageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  coverageText: {
    fontSize: 11,
    fontWeight: '600',
  },
});