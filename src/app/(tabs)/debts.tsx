import { DebtFreeHero } from '@/components/debts/DebtFreeHero';
import { DebtProgressBar } from '@/components/debts/DebtProgressBar';
import { FreedomScreen } from '@/components/freedom/FreedomScreen';
import { HealthScreen } from '@/components/health/HealthScreen';
import { HeaderActions } from '@/components/HeaderActions';
import { DebtDetailModal } from '@/components/modals/DebtDetailModal';
import { DebtFormModal, DebtPrefill } from '@/components/modals/DebtFormModal';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SelectableText } from '@/components/SelectableText';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useInbox } from '@/contexts/InboxContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { TabSwipeBlocker, useTabSwipeInterceptor } from '@/contexts/TabSwipeContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DebtSummary,
  deleteDebt,
  dismissDebtSuggestion,
  getDebtSuggestions,
  getDebtSummaries,
  getSavedDebtPlan,
  syncDebtPayments,
} from '@/db/database';
import { usePaywall } from '@/hooks/usePaywall';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import type { TranslationKey } from '@/i18n';
import { buildDebtOutlook } from '@/services/debtPlanService';
import { getDebtTypeIcon } from '@/utils/debt';
import type { DebtPlan } from '@/utils/debtSimulator';
import { canAdd, isItemReadOnly } from '@/utils/entitlement';
import { DebtSuggestion } from '@/utils/debtSuggestion';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Swipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

const MAX_SUGGESTIONS = 3;

type PlanSegment = 'HEALTH' | 'DEBTS' | 'FREEDOM';

const SEGMENTS: { key: PlanSegment; label: TranslationKey }[] = [
  { key: 'DEBTS', label: 'home.debts.title' },
  { key: 'HEALTH', label: 'health.cardTitle' },
  { key: 'FREEDOM', label: 'freedom.name' },
];

export default function DebtsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { segment: segmentParam } = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<PlanSegment>('DEBTS');

  // Links from Home and the inbox ask for a segment; the param is cleared so the next link fires again.
  useEffect(() => {
    if (segmentParam !== 'health' && segmentParam !== 'debts' && segmentParam !== 'freedom') return;
    setSegment(segmentParam === 'freedom' ? 'FREEDOM' : segmentParam === 'health' ? 'HEALTH' : 'DEBTS');
    router.setParams({ segment: undefined });
  }, [segmentParam, router]);

  const selectSegment = (next: PlanSegment) => {
    if (next === segment) return;
    Haptics.selectionAsync().catch(() => {});
    setSegment(next);
  };

  // A swipe steps through the segments before it leaves the tab.
  useTabSwipeInterceptor((direction) => {
    const index = SEGMENTS.findIndex((item) => item.key === segment);
    const target = SEGMENTS[index + (direction === 'next' ? 1 : -1)];
    if (!target) return false;
    selectSegment(target.key);
    return true;
  });

  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;
  const { refreshInbox } = useInbox();
  const { isPro, can, showReadOnly } = useEntitlement();
  const canPlan = can('debtSimulator');
  const { openPaywall } = usePaywall();
  const { readOnly: profileReadOnly, guardWrite } = useProfileAccess();

  const [debts, setDebts] = useState<DebtSummary[]>([]);
  const [savedPlan, setSavedPlan] = useState<DebtPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [formDebt, setFormDebt] = useState<DebtSummary | null>(null);
  const [formPrefill, setFormPrefill] = useState<DebtPrefill | null>(null);
  const [suggestions, setSuggestions] = useState<DebtSuggestion[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailDebt, setDetailDebt] = useState<DebtSummary | null>(null);
  const swipeRefs = useRef(new Map<number, SwipeableMethods>());

  // What the list was last built from; a focus with nothing changed skips the reload.
  const stampRef = useRef('');
  const changeStamp = useCallback(async () => {
    const row = await db.getFirstAsync<{ changes: number }>(`SELECT total_changes() AS changes;`);
    return `${profileId}:${dataVersion}:${row?.changes ?? -1}`;
  }, [db, profileId, dataVersion]);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      await syncDebtPayments(db, profileId);
      const rows = await getDebtSummaries(db, profileId);
      setDebts(rows);
      setSavedPlan(await getSavedDebtPlan(db, profileId));
      setSuggestions(await getDebtSuggestions(db, profileId));
      setDetailDebt((prev) => (prev ? rows.find((r) => r.id === prev.id) ?? null : null));
      // Taken after the sync, so its own writes do not count as a change.
      stampRef.current = await changeStamp();
    } catch (error) {
      console.error('Failed to load debts:', error);
    } finally {
      setLoading(false);
      refreshInbox(true);
    }
  }, [db, profileId, refreshInbox, changeStamp]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!db) return;
        try {
          if ((await changeStamp()) === stampRef.current) return;
        } catch {
          // Fall through to a full load.
        }
        if (active) load();
      })();
      return () => {
        active = false;
      };
    }, [db, load, changeStamp])
  );

  const fmt = (value: number) => format.money(value, currencySymbol, { maximumFractionDigits: 0 });

  const totalOriginal = debts.reduce((sum, d) => sum + d.originalAmount, 0);
  const totalPaid = debts.reduce((sum, d) => sum + d.paidPrincipal, 0);
  const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalInterest = debts.reduce((sum, d) => sum + d.paidInterest, 0);
  const overallPercent = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0;
  const activeCount = debts.filter((d) => !d.isPaidOff).length;

  // Free: what the current payments give. Pro: the saved payoff plan, when there is one.
  const outlook = useMemo(() => buildDebtOutlook(debts, savedPlan, canPlan), [debts, savedPlan, canPlan]);

  const openPlan = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/debt-plan');
  };

  // The list is oldest first; debts beyond the free limit stay visible and can only be deleted.
  const debtIds = debts.map((d) => d.id);
  const isOverLimit = (debt: DebtSummary) => isItemReadOnly(isPro, 'maxDebts', debtIds, debt.id);
  const isDebtLocked = (debt: DebtSummary) => profileReadOnly || isOverLimit(debt);

  // One more debt: not on a read-only profile, and not beyond the free limit.
  const guardAdd = (action: () => void) =>
    guardWrite(() => {
      if (!canAdd(isPro, 'maxDebts', debts.length)) {
        openPaywall('debts');
        return;
      }
      action();
    });

  const openCreate = () =>
    guardAdd(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setFormDebt(null);
      setFormPrefill(null);
      setFormVisible(true);
    });

  const openSuggestion = (suggestion: DebtSuggestion) =>
    guardAdd(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setFormDebt(null);
      setFormPrefill({ name: suggestion.name, type: suggestion.type, keywords: [suggestion.keyword] });
      setFormVisible(true);
    });

  const dismissSuggestion = async (suggestion: DebtSuggestion) => {
    if (!guardWrite()) return;
    Haptics.selectionAsync().catch(() => {});
    setSuggestions((prev) => prev.filter((s) => s.key !== suggestion.key));
    try {
      await dismissDebtSuggestion(db, profileId, suggestion.key);
    } catch (error) {
      console.error('Failed to dismiss debt suggestion:', error);
    }
  };

  const openDetail = (debt: DebtSummary) => {
    Haptics.selectionAsync().catch(() => {});
    setDetailDebt(debt);
    setDetailVisible(true);
  };

  const handleEditFromDetail = () => {
    setDetailVisible(false);
    setFormDebt(detailDebt);
    setFormPrefill(null);
    setTimeout(() => setFormVisible(true), 350);
  };

  const closeSwipes = (exceptId?: number) => {
    swipeRefs.current.forEach((row, id) => {
      if (id !== exceptId) row.close();
    });
  };

  const openEdit = (debt: DebtSummary) => {
    closeSwipes();
    guardWrite(() => {
      if (isOverLimit(debt)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        showReadOnly({ kind: 'debt' });
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      setFormDebt(debt);
      setFormPrefill(null);
      setFormVisible(true);
    });
  };

  const confirmDelete = (debt: DebtSummary) => {
    Alert.alert(
      t('debt.deleteTitle'),
      t('debt.deleteMessage', { name: debt.name }),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => closeSwipes() },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebt(db, debt.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              await load();
            } catch (error) {
              console.error('Failed to delete debt:', error);
              Alert.alert(t('common.error'), t('debt.deleteFailed'));
            }
          },
        },
      ]
    );
  };

  const renderSwipeActions = (debt: DebtSummary) => (
    <View style={styles.swipeActions}>
      {!isDebtLocked(debt) && (
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.swipeAction, { backgroundColor: colors.accent }]}
          onPress={() => openEdit(debt)}
          accessibilityRole="button"
          accessibilityLabel={t('debt.a11yEdit', { name: debt.name })}
        >
          <Ionicons name="pencil" size={18} color="#FFFFFF" />
          <Text style={styles.swipeActionText}>{t('common.edit')}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.swipeAction, styles.swipeDelete]}
        onPress={() => confirmDelete(debt)}
        accessibilityRole="button"
        accessibilityLabel={t('debt.a11yDelete', { name: debt.name })}
      >
        <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
        <Text style={styles.swipeActionText}>{t('common.delete')}</Text>
      </TouchableOpacity>
    </View>
  );

  const suggestionCards =
    suggestions.length === 0 ? null : (
      <View style={styles.suggestions}>
        <SelectableText style={[styles.suggestionsLabel, { color: colors.textSecondary }]}>
          {t('debt.suggestedLabel')}
        </SelectableText>
        {suggestions.slice(0, MAX_SUGGESTIONS).map((suggestion) => (
          <View
            key={suggestion.key}
            style={[styles.suggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.debtIcon, { backgroundColor: colors.tintBackground }]}>
              <Ionicons name={getDebtTypeIcon(suggestion.type)} size={18} color={colors.accent} />
            </View>
            <View style={styles.debtTitleWrap}>
              <SelectableText style={[styles.debtName, { color: colors.text }]} numberOfLines={1}>
                {suggestion.name}
              </SelectableText>
              <SelectableText style={[styles.debtSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {t('debt.suggestionSub', {
                  payment: fmt(suggestion.payment),
                  count: suggestion.count,
                  month: format.monthYear(suggestion.firstDate.slice(0, 7), 'short'),
                })}
              </SelectableText>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => openSuggestion(suggestion)}
              hitSlop={8}
              style={[styles.suggestionAdd, { backgroundColor: colors.accent }]}
              accessibilityLabel={t('debt.a11yAddSuggestion', { name: suggestion.name })}
            >
              <Text style={styles.suggestionAddText}>{t('common.add')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => dismissSuggestion(suggestion)}
              hitSlop={10}
              accessibilityLabel={t('debt.a11yDismissSuggestion', { name: suggestion.name })}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]}>{t('tabs.plan')}</SelectableText>
        <HeaderActions showSearch={false}>
          {segment === 'DEBTS' && (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.accent }]}
              onPress={openCreate}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('debt.add')}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </HeaderActions>
      </View>

      <View style={[styles.segmentedContainer, { backgroundColor: colors.track }]} accessibilityRole="tablist">
        {SEGMENTS.map(({ key, label }) => {
          const active = segment === key;
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.8}
              style={[styles.segmentBtn, active && [styles.segmentBtnActive, { backgroundColor: colors.raised }]]}
              onPress={() => selectSegment(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.textSecondary },
                  active && [styles.segmentTextActive, { color: colors.text }],
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t(label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {segment === 'HEALTH' ? (
        <HealthScreen />
      ) : segment === 'FREEDOM' ? (
        <FreedomScreen />
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : debts.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.tintBackground }]}>
            <Ionicons name="trending-down-outline" size={32} color={colors.accent} />
          </View>
          <SelectableText style={[styles.emptyTitle, { color: colors.text }]}>{t('home.debts.emptyTitle')}</SelectableText>
          <SelectableText style={[styles.emptySub, { color: colors.textSecondary }]}>
            {t('debt.emptySub')}
          </SelectableText>
          {suggestionCards}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.emptyBtn, { backgroundColor: colors.accent }]}
            onPress={openCreate}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.emptyBtnText}>{t('debt.addFirst')}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <DebtFreeHero
            month={outlook.debtFreeMonth}
            allPaid={activeCount === 0}
            fromPlan={outlook.fromPlan}
            totalBalance={totalBalance}
            percentPaid={overallPercent}
            interestPaid={totalInterest}
            activeCount={activeCount}
            currencySymbol={currencySymbol}
            onPress={openPlan}
          />

          {debts.map((debt) => (
            <TabSwipeBlocker key={debt.id}>
            <Swipeable
              ref={(row) => {
                if (row) swipeRefs.current.set(debt.id, row);
                else swipeRefs.current.delete(debt.id);
              }}
              friction={2}
              rightThreshold={40}
              overshootRight={false}
              renderRightActions={() => renderSwipeActions(debt)}
              onSwipeableWillOpen={() => closeSwipes(debt.id)}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.debtCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => openDetail(debt)}
              >
                <View style={styles.debtTop}>
                  <View style={[styles.debtIcon, { backgroundColor: `${debt.color}22` }]}>
                    <Ionicons name={getDebtTypeIcon(debt.type)} size={18} color={debt.color} />
                  </View>
                  <View style={styles.debtTitleWrap}>
                    <Text style={[styles.debtName, { color: colors.text }]} numberOfLines={1}>
                      {debt.name}
                    </Text>
                    <Text style={[styles.debtSub, { color: colors.textSecondary }]} numberOfLines={1}>
                      {isOverLimit(debt)
                        ? `${t('pro.readOnly.title')} · ${t('pro.renewToEdit')}`
                        : debt.isPaidOff
                        ? t('debt.paidOff')
                        : debt.payoffMonth
                        ? t('debt.debtFree', { month: format.monthYear(debt.payoffMonth, 'short') })
                        : t('debt.setPayment')}
                    </Text>
                  </View>
                  <View style={styles.debtAmountWrap}>
                    <Text style={[styles.debtBalance, { color: colors.text }]}>
                      {isOverLimit(debt) && <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />}
                      {isOverLimit(debt) ? ' ' : ''}
                      {fmt(debt.balance)}
                    </Text>
                    <Text style={[styles.debtOf, { color: colors.textSecondary }]}>
                      {t('debt.ofAmount', { amount: fmt(debt.originalAmount) })}
                    </Text>
                  </View>
                </View>

                <View style={styles.debtBar}>
                  <DebtProgressBar percent={debt.percentPaid} color={debt.color} height={8} />
                </View>
                <View style={styles.debtFooter}>
                  <Text style={[styles.debtFooterText, { color: colors.textSecondary }]}>
                    {t('debt.percentPaid', { percent: debt.percentPaid.toFixed(0) })}
                  </Text>
                  <Text style={[styles.debtFooterText, { color: colors.textSecondary }]}>
                    {t('debt.payments', { count: debt.paymentCount })}
                    {debt.apr > 0 ? ` • ${t('debt.apr', { apr: format.number(debt.apr) })}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            </Swipeable>
            </TabSwipeBlocker>
          ))}

          {suggestionCards}
        </ScrollView>
      )}

      <DebtDetailModal
        visible={detailVisible}
        debt={detailDebt}
        onClose={() => setDetailVisible(false)}
        onEdit={handleEditFromDetail}
        readOnly={detailDebt ? isDebtLocked(detailDebt) : false}
        onChanged={load}
      />

      <DebtFormModal
        visible={formVisible}
        debt={formDebt}
        prefill={formPrefill}
        onClose={() => setFormVisible(false)}
        onSaved={load}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  segmentBtn: { flex: 1, paddingVertical: 7, paddingHorizontal: 4, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '500' },
  segmentTextActive: { fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  debtCard: { borderRadius: 16, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  debtTop: { flexDirection: 'row', alignItems: 'center' },
  debtIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  debtTitleWrap: { flex: 1, marginRight: 8 },
  debtName: { fontSize: 16, fontWeight: '700' },
  debtSub: { fontSize: 12, marginTop: 2 },
  debtAmountWrap: { alignItems: 'flex-end' },
  debtBalance: { fontSize: 16, fontWeight: '800' },
  debtOf: { fontSize: 11, marginTop: 2 },
  debtBar: { marginTop: 12 },
  debtFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  debtFooterText: { fontSize: 11, fontWeight: '600' },
  swipeActions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, paddingLeft: 8 },
  swipeAction: { width: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4 },
  swipeDelete: { backgroundColor: '#FF3B30' },
  swipeActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  emptyWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 12,
  },
  suggestions: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
  suggestionsLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestionAdd: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  suggestionAddText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});