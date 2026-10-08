import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatAxisValue, getNiceScale } from '@/utils/chartScale';
import { addMonths, type ChartSeries } from '@/utils/debtSimulator';
import React, { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

interface PayoffChartProps {
  series: ChartSeries;
  /** `YYYY-MM` of point 0. */
  startMonth: string;
}

const CHART_HEIGHT = 170;
const Y_AXIS_LABEL_WIDTH = 40;
const EDGE_PAD = 10;
// Screen padding (20 each side) and card padding (16 each side).
const HORIZONTAL_CHROME = 40 + 32;
const X_LABEL_WIDTH = 60;
const X_LABELS_HEIGHT = 18;
const MAX_X_LABELS = 4;
const DASH = [5, 4];

/** Total balance over time: the plan as a solid line, the current payments as a dashed one. */
export const PayoffChart = React.memo(function PayoffChart({ series, startMonth }: PayoffChartProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { width: windowWidth } = useWindowDimensions();

  const count = series.indexes.length;
  const planData = useMemo(() => series.plan.map((value) => ({ value })), [series.plan]);
  const baselineData = useMemo(() => series.baseline.map((value) => ({ value })), [series.baseline]);

  const niceScale = getNiceScale(Math.max(0, ...series.plan, ...series.baseline));
  const plotWidth = Math.max(windowWidth - HORIZONTAL_CHROME - Y_AXIS_LABEL_WIDTH - 12, 160);
  const spacing = (plotWidth - EDGE_PAD * 2) / Math.max(count - 1, 1);

  // A few evenly spread points are named; the first and the last always are.
  const xLabels = useMemo(() => {
    const wanted = Math.min(MAX_X_LABELS, count);
    const points: number[] = [];
    for (let i = 0; i < wanted; i++) {
      const point = wanted === 1 ? 0 : Math.round((i * (count - 1)) / (wanted - 1));
      if (points[points.length - 1] !== point) points.push(point);
    }
    return points;
  }, [count]);

  const maxLabelLeft = Y_AXIS_LABEL_WIDTH + plotWidth + 12 - X_LABEL_WIDTH;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessible
      accessibilityLabel={t('debt.plan.chart.a11y')}
    >
      <View style={styles.header}>
        <SelectableText style={[styles.title, { color: colors.textSecondary }]}>{t('debt.plan.chart.title')}</SelectableText>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: colors.accent }]} />
            <SelectableText style={[styles.legendText, { color: colors.textSecondary }]}>{t('debt.plan.chart.plan')}</SelectableText>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendDashes}>
              <View style={[styles.legendDash, { backgroundColor: colors.textSecondary }]} />
              <View style={[styles.legendDash, { backgroundColor: colors.textSecondary }]} />
            </View>
            <SelectableText style={[styles.legendText, { color: colors.textSecondary }]}>{t('debt.plan.chart.baseline')}</SelectableText>
          </View>
        </View>
      </View>

      <View style={styles.chartWrapper}>
        <LineChart
          key={`${count}-${niceScale.max}-${plotWidth}`}
          data={planData}
          data2={baselineData}
          maxValue={niceScale.max}
          noOfSections={niceScale.sections}
          height={CHART_HEIGHT}
          color1={colors.accent}
          color2={colors.textSecondary}
          thickness1={2.5}
          thickness2={2}
          strokeDashArray2={DASH}
          // The plan is drawn on top where both paths run together.
          zIndex1={2}
          zIndex2={1}
          hideDataPoints
          spacing={spacing}
          initialSpacing={EDGE_PAD}
          endSpacing={EDGE_PAD}
          disableScroll
          isAnimated={false}
          yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
          formatYLabel={formatAxisValue}
          xAxisThickness={1}
          yAxisThickness={0}
          xAxisColor={colors.border}
          rulesColor={colors.border}
          yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
        />
      </View>

      <View style={styles.xLabels}>
        {xLabels.map((point) => (
          <Text
            key={point}
            style={[
              styles.xLabel,
              {
                color: colors.textSecondary,
                left: Math.min(
                  maxLabelLeft,
                  Math.max(0, Y_AXIS_LABEL_WIDTH + EDGE_PAD + point * spacing - X_LABEL_WIDTH / 2)
                ),
              },
            ]}
            numberOfLines={1}
          >
            {format.monthYear(addMonths(startMonth, series.indexes[point]), 'short')}
          </Text>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  // Stacked, so the Pro badge of a locked chart has the top right corner to itself.
  header: { gap: 6, marginBottom: 8 },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLine: { width: 14, height: 3, borderRadius: 1.5 },
  legendDashes: { flexDirection: 'row', gap: 3 },
  legendDash: { width: 5, height: 2, borderRadius: 1 },
  legendText: { fontSize: 11, fontWeight: '600' },
  chartWrapper: { alignItems: 'flex-start', overflow: 'hidden' },
  xLabels: { height: X_LABELS_HEIGHT },
  xLabel: { position: 'absolute', top: 2, width: X_LABEL_WIDTH, textAlign: 'center', fontSize: 10 },
});
