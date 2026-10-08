import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { HealthHistoryPoint } from '@/utils/budgetHealth';
import { getNiceScale } from '@/utils/chartScale';
import React, { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

interface ScoreHistoryChartProps {
  /** Oldest first. */
  points: HealthHistoryPoint[];
}

const CHART_HEIGHT = 130;
const Y_AXIS_LABEL_WIDTH = 30;
const EDGE_PAD = 14;
// Screen padding (20 each side) and card padding (16 each side).
const HORIZONTAL_CHROME = 40 + 32;
const MAX_X_LABELS = 6;

export function ScoreHistoryChart({ points }: ScoreHistoryChartProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { width: windowWidth } = useWindowDimensions();

  const count = points.length;
  const labelStep = Math.max(1, Math.ceil(count / MAX_X_LABELS));

  const data = useMemo(
    () =>
      points.map((point, index) => ({
        value: point.score,
        // Every label would collide on a small screen; the last month is always named.
        label:
          index === count - 1 || (index % labelStep === 0 && count - 1 - index >= labelStep / 2)
            ? format.shortMonth(Number(point.month.slice(5, 7)) - 1)
            : '',
      })),
    [points, count, labelStep, format]
  );

  if (count < 2) {
    return <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('health.history.empty')}</Text>;
  }

  const niceScale = getNiceScale(Math.max(...points.map((point) => point.score)));
  const plotWidth = Math.max(windowWidth - HORIZONTAL_CHROME - Y_AXIS_LABEL_WIDTH - 12, 160);
  const spacing = (plotWidth - EDGE_PAD * 2) / (count - 1);
  const first = points[0];
  const last = points[count - 1];

  return (
    <View
      accessible
      accessibilityLabel={`${t('health.history')}: ${format.monthYear(first.month)} ${first.score}, ${format.monthYear(last.month)} ${last.score}`}
    >
      <LineChart
        key={`${count}-${niceScale.max}-${plotWidth}`}
        data={data}
        maxValue={niceScale.max}
        noOfSections={niceScale.sections}
        height={CHART_HEIGHT}
        color={colors.accent}
        thickness={2.5}
        dataPointsColor={colors.accent}
        dataPointsRadius={3}
        areaChart
        startFillColor={`${colors.accent}33`}
        endFillColor={`${colors.accent}00`}
        startOpacity={0.3}
        endOpacity={0}
        spacing={spacing}
        initialSpacing={EDGE_PAD}
        endSpacing={EDGE_PAD}
        disableScroll
        isAnimated={false}
        yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
        xAxisThickness={1}
        yAxisThickness={0}
        xAxisColor={colors.border}
        rulesColor={colors.border}
        yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, lineHeight: 18, paddingVertical: 8 },
});
