import { MonthStepper } from '@/components/dashboard/MonthStepper';
import {
  levelKey,
  PILLAR_LABELS,
  scoreColor,
  statusColor,
  statusLabelKey,
  trimNumber,
} from '@/components/health/healthUi';
import { PillarRow } from '@/components/health/PillarRow';
import { ScoreRing } from '@/components/health/ScoreRing';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DebtSummary,
  FixedCostSummary,
  getAlerts,
  getDebtSummaries,
  getFixedVsFlexibleSummary,
  type StoredHealthAlert,
} from '@/db/database';
import { loadHealth, type HealthSnapshot } from '@/services/healthService';
import type { CategoryStatus } from '@/utils/budgetHealth';
import { alertText } from '@/utils/healthAlertText';
import { buildHealthReportHtml, type ReportSection } from '@/utils/healthReportHtml';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ReportData {
  profileId: number;
  snapshot: HealthSnapshot;
  fixed: FixedCostSummary | null;
  debts: DebtSummary[];
  alerts: StoredHealthAlert[];
}

const NO_COVERAGE = { status: 'EMPTY' as const, label: '' };

/** "+12%" / "-8%" against your normal; "–" without one. */
const changeVsNormal = (item: CategoryStatus): string => {
  if (item.normal === null || item.normal <= 0) return '–';
  const percent = Math.round((item.amount / item.normal - 1) * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
};

export default function HealthReportScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format, categoryName } = useI18n();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;
  const params = useLocalSearchParams<{ month?: string }>();

  const [pickedMonth, setPickedMonth] = useState<string | undefined>(
    typeof params.month === 'string' ? params.month : undefined
  );
  const [data, setData] = useState<ReportData | null>(null);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!db) return;
        try {
          const snapshot = await loadHealth(db, profileId, pickedMonth);
          const month = snapshot.result?.month;
          const [fixed, debts, alerts] = month
            ? await Promise.all([
                getFixedVsFlexibleSummary(db, month, profileId),
                getDebtSummaries(db, profileId),
                getAlerts(db, profileId, month),
              ])
            : [null, [], []];
          if (active) setData({ profileId, snapshot, fixed, debts, alerts });
        } catch (error) {
          console.error('Failed to load health report:', error);
        }
      })();
      return () => {
        active = false;
      };
    }, [db, profileId, pickedMonth, dataVersion])
  );

  const report = data?.profileId === profileId ? data : null;
  const snapshot = report?.snapshot ?? null;
  const result = snapshot?.result ?? null;
  const months = snapshot?.months ?? [];
  const month = result?.month ?? '';
  const monthIndex = months.indexOf(month);

  const monthNames: Record<string, string> = {};
  months.forEach((key) => {
    monthNames[key] = format.monthYear(key);
  });

  const money = (value: number) => format.money(Math.round(value), currencySymbol);
  const percent = (value: number | null) => (value === null ? '–' : `${format.number(trimNumber(value))}%`);

  const score = result?.score ?? null;
  const previous = snapshot?.previous ?? null;
  let changeText = '';
  if (score !== null) {
    if (!previous) changeText = t('report.firstScore');
    else if (score === previous.score) changeText = t('health.delta.same', { month: format.monthYear(previous.month) });
    else {
      changeText = t(score > previous.score ? 'health.delta.a11yUp' : 'health.delta.a11yDown', {
        points: Math.abs(score - previous.score),
        month: format.monthYear(previous.month),
      });
    }
  }

  const improvementText =
    result && score !== null
      ? result.improvement
        ? t(result.improvement.message.key, result.improvement.message.params)
        : t('health.allGood')
      : '';

  const incomeNote =
    result?.income.source === 'override'
      ? t('report.incomeOverride')
      : result?.income.source === 'detected'
        ? t('report.incomeDetected')
        : '';

  const summaryRows: [string, string][] = result
    ? [
        [incomeNote ? `${t('report.income')} (${incomeNote})` : t('report.income'), money(result.metrics.netIncome)],
        [t('report.expenses'), money(result.metrics.spending)],
        [t('report.saved'), result.income.source === 'none' ? '–' : money(result.metrics.saved)],
        [t('report.savingsRate'), percent(result.metrics.savingsRate)],
      ]
    : [];

  const activeDebts = (report?.debts ?? []).filter((debt) => !debt.isPaidOff);
  // Debt-free when the last debt is: only known when every open debt has a payoff month.
  const debtFreeMonth =
    activeDebts.length > 0 && activeDebts.every((debt) => debt.payoffMonth)
      ? activeDebts.reduce((latest, debt) => (debt.payoffMonth && debt.payoffMonth > latest ? debt.payoffMonth : latest), '')
      : null;

  const debtDetail = (debt: DebtSummary): string =>
    debt.isPaidOff
      ? t('report.debt.paidOff')
      : `${t('report.debt.balance', { amount: money(debt.balance) })} · ${t('report.debt.paid', {
          percent: Math.round(debt.percentPaid),
        })}`;

  const statusText = (item: CategoryStatus) => t(statusLabelKey(item.status, item.higherIsBetter));

  const handleExport = async () => {
    if (!result || exporting) return;
    Haptics.selectionAsync().catch(() => {});
    setExporting(true);
    try {
      const sections: ReportSection[] = [
        { heading: format.monthYear(month), rows: summaryRows },
        {
          heading: t('health.pillars'),
          rows: result.pillars.map((pillar) => [
            t(PILLAR_LABELS[pillar.id]),
            pillar.value === null
              ? t('health.pillar.unknown')
              : t(pillar.id === 'buffer' ? 'health.pillar.valueBuffer' : 'health.pillar.valuePct', {
                  value: format.number(trimNumber(pillar.value)),
                }),
            pillar.score === null ? '–' : String(Math.round(pillar.score)),
          ]),
        },
        {
          heading: t('health.categories'),
          columns: [
            t('report.col.category'),
            t('report.col.amount'),
            t('report.col.share'),
            t('report.col.vsNormal'),
            t('report.col.status'),
          ],
          rows: result.categories.map((item) => [
            categoryName(item.category),
            money(item.amount),
            percent(item.pct),
            changeVsNormal(item),
            statusText(item),
          ]),
          empty: t('health.category.empty'),
        },
        {
          heading: t('fixed.title'),
          rows: report?.fixed
            ? [
                [t('report.fixed'), `${money(report.fixed.fixedTotal)} (${Math.round(report.fixed.fixedPercentage)}%)`],
                [
                  t('report.flexible'),
                  `${money(report.fixed.flexibleTotal)} (${Math.round(report.fixed.flexiblePercentage)}%)`,
                ],
              ]
            : [],
        },
        {
          heading: t('report.debts'),
          rows: [
            ...(report?.debts ?? []).map((debt) => [debt.name, debtDetail(debt)]),
            ...(debtFreeMonth ? [[t('report.debt.freeBy', { month: format.monthYear(debtFreeMonth) }), '']] : []),
          ],
          empty: t('report.debt.none'),
        },
        {
          heading: t('report.alerts'),
          rows: (report?.alerts ?? []).map((alert) => [
            alertText(alert.message, t, format, currencySymbol),
            t(`health.alertStatus.${alert.status}`),
          ]),
          empty: t('report.alerts.none'),
        },
      ];

      const html = buildHealthReportHtml({
        title: `${t('health.title')} · ${t('report.title')}`,
        subtitle: [format.monthYear(month), activeProfile?.name].filter(Boolean).join(' · '),
        scoreLabel: t('report.score'),
        score: score === null ? '–' : String(score),
        scoreNote: changeText,
        improvement: improvementText,
        sections,
        disclaimer: t('health.disclaimer'),
        footer: t('report.generated'),
        lang: format.tag,
      });

      // Rendered to a PDF on the device, then handed to the system share sheet.
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: t('report.exportPdf') });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (error) {
      console.error('Failed to export health report:', error);
      Alert.alert(t('common.error'), t('report.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const cardStyle = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }];
  const ringColor = scoreColor(score, colors);

  return (
    <ScreenContainer showDemoBanner={false}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]} maxFontSizeMultiplier={1.4}>{t('report.title')}</SelectableText>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {!report ? (
          <ActivityIndicator size="small" color={colors.accent} style={styles.loading} />
        ) : !result ? (
          <View style={cardStyle}>
            <SelectableText style={[styles.empty, { color: colors.textSecondary }]}>{t('health.notEnough')}</SelectableText>
          </View>
        ) : (
          <>
            <MonthStepper
              selectedMonth={month}
              availableMonths={months}
              monthNames={monthNames}
              coverageStatus={NO_COVERAGE}
              onPrevMonth={() => monthIndex < months.length - 1 && setPickedMonth(months[monthIndex + 1])}
              onNextMonth={() => monthIndex > 0 && setPickedMonth(months[monthIndex - 1])}
              // No picker on this screen: the title jumps back to the latest month.
              onOpenMonthPicker={() => setPickedMonth(months[0])}
            />

            <View style={[cardStyle, styles.scoreCard]}>
              <ScoreRing score={score} size={76} strokeWidth={8} color={ringColor} trackColor={colors.track}>
                <SelectableText style={[styles.score, { color: colors.text }]} maxFontSizeMultiplier={1.2}>{score ?? '–'}</SelectableText>
              </ScoreRing>
              <View style={styles.scoreBody}>
                <SelectableText style={[styles.cardTitle, { color: colors.text }]}>{t('report.score')}</SelectableText>
                {score !== null ? (
                  <>
                    <SelectableText style={[styles.level, { color: ringColor }]}>{t(levelKey(score))}</SelectableText>
                    <SelectableText style={[styles.sub, { color: colors.textSecondary }]}>{changeText}</SelectableText>
                    <SelectableText style={[styles.sub, { color: colors.textSecondary }]}>{improvementText}</SelectableText>
                  </>
                ) : (
                  <SelectableText style={[styles.sub, { color: colors.textSecondary }]}>
                    {result.income.source === 'none' ? t('health.noIncome') : t('report.noData')}
                  </SelectableText>
                )}
                {result.partial ? (
                  <SelectableText style={[styles.sub, { color: colors.textSecondary }]}>{t('health.partial')}</SelectableText>
                ) : null}
              </View>
            </View>

            <View style={cardStyle}>
              {summaryRows.map(([label, value], index) => (
                <View
                  key={label}
                  style={[styles.kvRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                >
                  <SelectableText style={[styles.kvLabel, { color: colors.textSecondary }]}>{label}</SelectableText>
                  <SelectableText style={[styles.kvValue, { color: colors.text }]}>{value}</SelectableText>
                </View>
              ))}
            </View>

            {score !== null ? (
              <View style={cardStyle}>
                <SelectableText style={[styles.cardTitle, { color: colors.text }]}>{t('health.pillars')}</SelectableText>
                {result.pillars.map((pillar) => (
                  <PillarRow key={pillar.id} pillar={pillar} />
                ))}
              </View>
            ) : null}

            <View style={cardStyle}>
              <SelectableText style={[styles.cardTitle, { color: colors.text }]}>{t('health.categories')}</SelectableText>
              {result.categories.length === 0 ? (
                <SelectableText style={[styles.empty, { color: colors.textSecondary }]}>{t('health.category.empty')}</SelectableText>
              ) : (
                result.categories.map((item) => (
                  <View key={item.category} style={[styles.tableRow, { borderTopColor: colors.border }]}>
                    <View style={styles.tableMain}>
                      <SelectableText style={[styles.tableName, { color: colors.text }]} numberOfLines={1}>
                        {categoryName(item.category)}
                      </SelectableText>
                      <SelectableText style={[styles.tableAmount, { color: colors.text }]}>{money(item.amount)}</SelectableText>
                    </View>
                    <View style={styles.tableMeta}>
                      <SelectableText style={[styles.sub, { color: colors.textSecondary }]}>
                        {[
                          item.pct !== null ? t('health.category.pct', { value: format.number(trimNumber(item.pct)) }) : null,
                          item.normal !== null && item.normal > 0
                            ? `${t('report.col.vsNormal')} ${changeVsNormal(item)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </SelectableText>
                      <SelectableText style={[styles.status, { color: statusColor(item.status, colors) }]}>{statusText(item)}</SelectableText>
                    </View>
                  </View>
                ))
              )}
            </View>

            {report.fixed ? (
              <View style={cardStyle}>
                <SelectableText style={[styles.cardTitle, { color: colors.text }]}>{t('fixed.title')}</SelectableText>
                <View style={[styles.splitTrack, { backgroundColor: colors.track }]}>
                  <View
                    style={{ width: `${report.fixed.fixedPercentage}%`, backgroundColor: colors.accent, height: '100%' }}
                  />
                </View>
                <View style={styles.kvRow}>
                  <SelectableText style={[styles.kvLabel, { color: colors.textSecondary }]}>{t('report.fixed')}</SelectableText>
                  <SelectableText style={[styles.kvValue, { color: colors.text }]}>
                    {money(report.fixed.fixedTotal)} ({Math.round(report.fixed.fixedPercentage)}%)
                  </SelectableText>
                </View>
                <View style={[styles.kvRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <SelectableText style={[styles.kvLabel, { color: colors.textSecondary }]}>{t('report.flexible')}</SelectableText>
                  <SelectableText style={[styles.kvValue, { color: colors.text }]}>
                    {money(report.fixed.flexibleTotal)} ({Math.round(report.fixed.flexiblePercentage)}%)
                  </SelectableText>
                </View>
              </View>
            ) : null}

            <View style={cardStyle}>
              <SelectableText style={[styles.cardTitle, { color: colors.text }]}>{t('report.debts')}</SelectableText>
              {report.debts.length === 0 ? (
                <SelectableText style={[styles.empty, { color: colors.textSecondary }]}>{t('report.debt.none')}</SelectableText>
              ) : (
                <>
                  {report.debts.map((debt) => (
                    <View key={debt.id} style={[styles.tableRow, { borderTopColor: colors.border }]}>
                      <SelectableText style={[styles.tableName, { color: colors.text }]} numberOfLines={1}>
                        {debt.name}
                      </SelectableText>
                      <SelectableText style={[styles.sub, { color: colors.textSecondary }]}>{debtDetail(debt)}</SelectableText>
                    </View>
                  ))}
                  {debtFreeMonth ? (
                    <SelectableText style={[styles.debtFree, { color: colors.text }]}>
                      {t('report.debt.freeBy', { month: format.monthYear(debtFreeMonth) })}
                    </SelectableText>
                  ) : null}
                </>
              )}
            </View>

            <View style={cardStyle}>
              <SelectableText style={[styles.cardTitle, { color: colors.text }]}>{t('report.alerts')}</SelectableText>
              {report.alerts.length === 0 ? (
                <SelectableText style={[styles.empty, { color: colors.textSecondary }]}>{t('report.alerts.none')}</SelectableText>
              ) : (
                report.alerts.map((alert) => (
                  <View key={alert.id} style={[styles.tableRow, { borderTopColor: colors.border }]}>
                    <SelectableText style={[styles.alertText, { color: colors.text }]}>
                      {alertText(alert.message, t, format, currencySymbol)}
                    </SelectableText>
                    <SelectableText style={[styles.sub, { color: colors.textSecondary }]}>
                      {t(`health.alertStatus.${alert.status}`)}
                    </SelectableText>
                  </View>
                ))
              )}
            </View>

            {/* TODO(pro): "Export PDF" is a Pro item (flag `reportPdf`, a placeholder for now); gate it with useEntitlement().can(). */}
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: colors.accent }, exporting && styles.disabled]}
              onPress={handleExport}
              disabled={exporting}
              accessibilityRole="button"
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="share-outline" size={18} color="#FFF" />
              )}
              <Text style={styles.exportText}>{t('report.exportPdf')}</Text>
            </TouchableOpacity>

            <SelectableText style={[styles.disclaimer, { color: colors.textSecondary }]}>{t('health.disclaimer')}</SelectableText>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  loading: { marginTop: 40 },
  card: {
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
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreBody: { flex: 1 },
  score: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  level: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 12, lineHeight: 17, marginTop: 2, flexShrink: 1 },
  empty: { fontSize: 14, lineHeight: 20, paddingVertical: 8 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 40 },
  kvLabel: { fontSize: 14, flexShrink: 1 },
  kvValue: { fontSize: 15, fontWeight: '700' },
  tableRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  tableMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tableName: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  tableAmount: { fontSize: 15, fontWeight: '700' },
  tableMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  status: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  splitTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: 8 },
  debtFree: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  alertText: { fontSize: 14, lineHeight: 20 },
  exportBtn: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: 14 },
});
