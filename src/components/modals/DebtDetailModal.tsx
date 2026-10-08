import { DebtProgressBar } from '@/components/debts/DebtProgressBar';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    addManualDebtPayment,
    DebtPayment,
    DebtSummary,
    getDebtPayments,
    removeDebtPayment
} from '@/db/database';
import { getDebtTypeIcon, isValidDateKey, parseNumber, todayKey } from '@/utils/debt';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DebtDetailModalProps {
  visible: boolean;
  debt: DebtSummary | null;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
}

export function DebtDetailModal({ visible, debt, onClose, onEdit, onChanged }: DebtDetailModalProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { activeProfile, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [amountInput, setAmountInput] = useState('');
  const [dateInput, setDateInput] = useState(todayKey());

  const loadPayments = useCallback(async () => {
    if (!db || !debt) return;
    try {
      setPayments(await getDebtPayments(db, debt.id));
    } catch (error) {
      console.error('Failed to load debt payments:', error);
    }
  }, [db, debt?.id]);

  useEffect(() => {
    if (visible) {
      loadPayments();
    }
  }, [visible, loadPayments, debt?.paymentCount, debt?.paidPrincipal]);

  useEffect(() => {
    if (visible) {
      setAmountInput(debt && debt.paymentAmount > 0 ? String(debt.paymentAmount) : '');
      setDateInput(todayKey());
    }
  }, [visible, debt?.id]);

  if (!debt) return null;

  const fmt = (value: number, decimals = 0) => format.money(value, currencySymbol, decimals);

  const fieldBg = colors.field;

  const handleAddPayment = async () => {
    const amount = parseNumber(amountInput);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('debt.detail.amountTitle'), t('debt.detail.amountMessage'));
      return;
    }
    if (!isValidDateKey(dateInput.trim())) {
      Alert.alert(t('debt.detail.dateTitle'), t('debt.detail.dateMessage'));
      return;
    }
    try {
      await addManualDebtPayment(db, profileId, debt.id, amount, dateInput.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await loadPayments();
      onChanged();
    } catch (error) {
      console.error('Failed to add payment:', error);
      Alert.alert(t('common.error'), t('debt.detail.addFailed'));
    }
  };

  const handleRemovePayment = (payment: DebtPayment) => {
    const isAuto = payment.source === 'AUTO';
    Alert.alert(
      isAuto ? t('debt.detail.unlinkTitle') : t('debt.detail.deleteTitle'),
      isAuto ? t('debt.detail.unlinkMessage') : t('debt.detail.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isAuto ? t('debt.unlink') : t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeDebtPayment(db, payment.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              await loadPayments();
              onChanged();
            } catch (error) {
              console.error('Failed to remove payment:', error);
            }
          },
        },
      ]
    );
  };

  const stats: { label: string; value: string }[] = [
    { label: t('debt.paidOff'), value: fmt(debt.paidPrincipal) },
    { label: t('debt.detail.interestPaid'), value: fmt(debt.paidInterest) },
    { label: t('debt.detail.monthlyPayment'), value: debt.paymentAmount > 0 ? fmt(debt.paymentAmount) : '—' },
    { label: t('debt.detail.interestRate'), value: debt.apr > 0 ? `${format.number(debt.apr)}%` : '0%' },
    {
      label: t('debt.detail.debtFree'),
      value: debt.isPaidOff
        ? t('common.done')
        : debt.payoffMonth
        ? format.monthYear(debt.payoffMonth, 'short')
        : '—',
    },
    {
      label: t('debt.detail.futureInterest'),
      value: debt.projectedInterest !== null && !debt.isPaidOff ? fmt(debt.projectedInterest) : '—',
    },
  ];

  const neverPaysOff =
    !debt.isPaidOff && debt.paymentAmount > 0 && debt.monthsRemaining === null && debt.apr > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background }]}
        edges={Platform.OS === 'ios' ? [] : ['top']}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={[styles.headerAction, { color: colors.accent }]}>{t('common.done')}</Text>
            </TouchableOpacity>
            <SelectableText style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {debt.name}
            </SelectableText>
            <TouchableOpacity onPress={onEdit} hitSlop={8}>
              <Text style={[styles.headerAction, styles.bold, { color: colors.accent }]}>{t('common.edit')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.heroTop}>
                <View style={[styles.heroIcon, { backgroundColor: `${debt.color}22` }]}>
                  <Ionicons name={getDebtTypeIcon(debt.type)} size={20} color={debt.color} />
                </View>
                {debt.isPaidOff && (
                  <View style={styles.paidBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                    <SelectableText style={styles.paidBadgeText}>{t('debt.paidOff')}</SelectableText>
                  </View>
                )}
              </View>

              <SelectableText style={[styles.heroLabel, { color: colors.textSecondary }]}>{t('debt.detail.remaining')}</SelectableText>
              <SelectableText style={[styles.heroValue, { color: colors.text }]}>{fmt(debt.balance, 2)}</SelectableText>

              <View style={styles.barWrap}>
                <DebtProgressBar percent={debt.percentPaid} color={debt.color} height={12} />
              </View>
              <View style={styles.heroFooter}>
                <SelectableText style={[styles.heroFooterText, { color: colors.textSecondary }]}>
                  {t('debt.percentPaid', { percent: debt.percentPaid.toFixed(0) })}
                </SelectableText>
                <SelectableText style={[styles.heroFooterText, { color: colors.textSecondary }]}>
                  {t('debt.ofAmount', { amount: fmt(debt.originalAmount) })}
                </SelectableText>
              </View>
            </View>

            {neverPaysOff && (
              <View style={styles.warnCard}>
                <Ionicons name="warning-outline" size={16} color="#FF9500" />
                <SelectableText style={styles.warnText}>
                  {t('debt.detail.neverPaysOff')}
                </SelectableText>
              </View>
            )}

            <View style={styles.statsGrid}>
              {stats.map((stat) => (
                <View
                  key={stat.label}
                  style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <SelectableText style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                    {stat.label}
                  </SelectableText>
                  <SelectableText style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                    {stat.value}
                  </SelectableText>
                </View>
              ))}
            </View>

            {!debt.isPaidOff && (
              <>
                <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('debt.detail.addPayment')}</SelectableText>
                <View style={styles.addRow}>
                  <View style={[styles.inputWrap, styles.amountInput, { backgroundColor: fieldBg, borderColor: colors.border }]}>
                    <SelectableText style={[styles.affix, { color: colors.textSecondary }]}>{currencySymbol}</SelectableText>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={amountInput}
                      onChangeText={setAmountInput}
                      placeholder={t('debt.detail.amountPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={[styles.inputWrap, styles.dateInput, { backgroundColor: fieldBg, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={dateInput}
                      onChangeText={setDateInput}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.addBtn, { backgroundColor: colors.accent }]}
                  onPress={handleAddPayment}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.addBtnText}>{t('debt.detail.record')}</Text>
                </TouchableOpacity>
              </>
            )}

            <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('debt.detail.history', { count: payments.length })}
            </SelectableText>
            {payments.length === 0 ? (
              <SelectableText style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('debt.detail.noPayments')}
              </SelectableText>
            ) : (
              <View style={[styles.listCard, { backgroundColor: colors.card }]}>
                {payments.map((payment, index) => (
                  <View
                    key={payment.id}
                    style={[
                      styles.paymentRow,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    ]}
                  >
                    <View style={styles.paymentLeft}>
                      <SelectableText style={[styles.paymentDate, { color: colors.text }]} numberOfLines={1}>
                        {payment.source === 'MANUAL'
                          ? t('debt.detail.manualPayment')
                          : (payment.merchant && payment.merchant !== 'Unknown'
                              ? payment.merchant
                              : payment.rawDescription) || t('debt.detail.statementPayment')}
                      </SelectableText>
                      <SelectableText style={[styles.paymentSplit, { color: colors.textSecondary }]} numberOfLines={1}>
                        {payment.date}
                        {payment.source === 'AUTO' && payment.keyword ? ` • ${t('debt.detail.via', { keyword: payment.keyword })}` : ''}
                      </SelectableText>
                      <SelectableText style={[styles.paymentSplit, { color: colors.textSecondary }]}>
                        {t('debt.detail.principal', { amount: fmt(payment.principal, 2) })}
                        {payment.interest > 0 ? ` • ${t('debt.detail.interest', { amount: fmt(payment.interest, 2) })}` : ''}
                      </SelectableText>
                    </View>
                    <View style={styles.paymentRight}>
                      <SelectableText style={[styles.paymentAmount, { color: colors.text }]}>
                        {fmt(payment.amount, 2)}
                      </SelectableText>
                      <View
                        style={[
                          styles.sourceBadge,
                          { backgroundColor: payment.source === 'AUTO' ? 'rgba(52,199,89,0.14)' : 'rgba(142,142,147,0.16)' },
                        ]}
                      >
                        <SelectableText
                          style={[
                            styles.sourceText,
                            { color: payment.source === 'AUTO' ? '#34C759' : colors.textSecondary },
                          ]}
                        >
                          {payment.source === 'AUTO' ? t('debt.detail.auto') : t('debt.detail.manual')}
                        </SelectableText>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleRemovePayment(payment)} hitSlop={10} style={styles.removeBtn}>
                      <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  headerAction: { fontSize: 16, fontWeight: '500' },
  bold: { fontWeight: '700' },
  content: { padding: 20, paddingBottom: 64 },
  heroCard: { borderRadius: 18, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heroIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,199,89,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  paidBadgeText: { color: '#34C759', fontSize: 12, fontWeight: '700' },
  heroLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroValue: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  barWrap: { marginTop: 14 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  heroFooterText: { fontSize: 12, fontWeight: '600' },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  warnText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#FF9500', fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statCard: { width: '48%', flexGrow: 1, borderRadius: 14, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statValue: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 24, marginBottom: 8 },
  addRow: { flexDirection: 'row', gap: 10 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    height: 44,
    gap: 6,
  },
  amountInput: { flex: 1 },
  dateInput: { flex: 1 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  affix: { fontSize: 15, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    marginTop: 10,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 13, lineHeight: 19 },
  listCard: { borderRadius: 14, overflow: 'hidden' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  paymentLeft: { flex: 1, marginRight: 10 },
  paymentDate: { fontSize: 14, fontWeight: '600' },
  paymentSplit: { fontSize: 11, marginTop: 2 },
  paymentRight: { alignItems: 'flex-end', marginRight: 8 },
  paymentAmount: { fontSize: 14, fontWeight: '700' },
  sourceBadge: { marginTop: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  sourceText: { fontSize: 10, fontWeight: '700' },
  removeBtn: { padding: 2 },
});