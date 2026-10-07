import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getNiceScale } from '@/utils/chartScale';
import { type YearRow } from '@/utils/freedom';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface GrowthChartProps {
  rows: YearRow[];
  currencySymbol: string;
  /** False while the plan for the active profile is still loading. */
  ready: boolean;
  /** Amounts are in today's money (after inflation). */
  real?: boolean;
  /** The inputs are invalid, so the bars are from the last valid plan. */
  stale?: boolean;
}

const CHART_HEIGHT = 160;
const X_LABELS_HEIGHT = 18;
const X_LABEL_WIDTH = 32;
const Y_AXIS_LABEL_WIDTH = 44;
const EDGE_PAD = 10;
const MAX_BAR_WIDTH = 28;
const MAX_X_LABELS = 6;
// Screen padding (20 each side) and card padding (16 each side).
const HORIZONTAL_CHROME = 40 + 32;
// Height of the chart plus its own axis padding, so the loading state takes the same space.
const CHART_BLOCK_HEIGHT = CHART_HEIGHT + 30;

const formatAxisValue = (label: string): string => {
  const value = Number(label);
  if (!Number.isFinite(value)) return label;
  const abs = Math.abs(value);
  const trim = (n: number) => String(Number(n.toFixed(n < 10 ? 1 : 0)));
  if (abs >= 1e9) return `${trim(value / 1e9)}B`;
  if (abs >= 1e6) return `${trim(value / 1e6)}M`;
  if (abs >= 1e3) return `${trim(value / 1e3)}k`;
  return String(Math.round(value));
};

const labelStep = (count: number): number => {
  for (const step of [1, 2, 5, 10, 20]) {
    if (Math.ceil(count / step) <= MAX_X_LABELS) return step;
  }
  return count;
};

export const GrowthChart = React.memo(function GrowthChart({
  rows,
  currencySymbol,
  ready,
  real = false,
  stale = false,
}: GrowthChartProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { width: windowWidth } = useWindowDimensions();

  const profitColor = colors.accent;
  const contributionsColor = `${colors.accent}55`;

  // Each bar is the balance at the end of that year, so the last one is the final balance.
  const stackData = useMemo(
    () =>
      rows.map((row) => {
        const invested = Math.min(row.cumulativeInvested, row.end);
        const profit = Math.max(0, row.end - row.cumulativeInvested);
        return {
          stacks: [
            { value: invested, color: contributionsColor },
            { value: profit, color: profitColor },
          ],
        };
      }),
    [rows, contributionsColor, profitColor]
  );

  const count = rows.length;
  const last = rows[count - 1];
  const niceScale = getNiceScale(last ? last.end : 0);

  const plotWidth = Math.max(windowWidth - HORIZONTAL_CHROME - Y_AXIS_LABEL_WIDTH - 12, 160);
  const slot = (plotWidth - EDGE_PAD * 2) / Math.max(count, 1);
  const barWidth = Math.min(slot * 0.72, MAX_BAR_WIDTH);
  const spacing = slot - barWidth;
  const sidePad = EDGE_PAD + spacing / 2;

  const xLabels = useMemo(() => {
    const step = labelStep(count);
    const years: number[] = [];
    for (let year = 1; year <= count; year++) {
      if (year === 1 || year % step === 0) years.push(year);
    }
    // The last year is always labelled; drop a neighbour that would collide with it.
    if (count > 1 && years[years.length - 1] !== count) {
      if (count - years[years.length - 1] < step / 2 && years.length > 1) years.pop();
      years.push(count);
    }
    // With a step above 1, year 1 sits right next to the first stepped label.
    if (step > 2 && years.length > 2 && years[1] - years[0] < step / 2) years.splice(0, 1);
    return years;
  }, [count]);

  const fmt = (value: number) => format.money(Math.round(value), currencySymbol);

  const accessibilityLabel = last
    ? t(real ? 'freedom.chart.a11yReal' : 'freedom.chart.a11y', {
        years: t('common.years', { count }),
        contributions: fmt(Math.min(last.cumulativeInvested, last.end)),
        profit: fmt(Math.max(0, last.end - last.cumulativeInvested)),
        balance: fmt(last.end),
      })
    : t('freedom.chart.a11yPlain');
  const emptyLabel = t('freedom.chart.a11yEmpty');

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, stale && styles.stale]}
      accessible
      accessibilityLabel={last && last.end <= 0 ? emptyLabel : accessibilityLabel}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>{real ? t('freedom.chart.titleReal') : t('freedom.chart.title')}</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: contributionsColor }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('freedom.chart.contributions')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: profitColor }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('freedom.chart.profit')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartBlock}>
        {!ready || !last ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : last.end <= 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {t('freedom.chart.empty')}
          </Text>
        ) : (
          <View style={styles.chartWrapper}>
            <BarChart
              key={`${count}-${niceScale.max}-${plotWidth}`}
              stackData={stackData}
              maxValue={niceScale.max}
              noOfSections={niceScale.sections}
              height={CHART_HEIGHT}
              barWidth={barWidth}
              spacing={spacing}
              initialSpacing={sidePad}
              endSpacing={sidePad}
              stackBorderTopLeftRadius={Math.min(barWidth / 2, 4)}
              stackBorderTopRightRadius={Math.min(barWidth / 2, 4)}
              disableScroll
              disablePress
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
        )}
      </View>

      <View style={styles.xLabels}>
        {ready &&
          last &&
          last.end > 0 &&
          xLabels.map((year) => (
            <Text
              key={year}
              style={[
                styles.xLabel,
                {
                  color: colors.textSecondary,
                  left: Y_AXIS_LABEL_WIDTH + EDGE_PAD + (year - 0.5) * slot - X_LABEL_WIDTH / 2,
                },
              ]}
              numberOfLines={1}
            >
              {year}
            </Text>
          ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  stale: { opacity: 0.5 },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
    marginBottom: 8,
  },
  empty: { fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 16 },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
  chartBlock: { height: CHART_BLOCK_HEIGHT, justifyContent: 'center', overflow: 'hidden' },
  chartWrapper: { alignItems: 'flex-start' },
  xLabels: { height: X_LABELS_HEIGHT },
  xLabel: { position: 'absolute', top: 2, width: X_LABEL_WIDTH, textAlign: 'center', fontSize: 10 },
});
