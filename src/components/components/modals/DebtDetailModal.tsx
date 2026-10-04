import { DebtProgressBar } from '@/components/debts/DebtProgressBar';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    addManualDebtPayment,
    DebtPayment,
    DebtSummary,
    getDebtPayments,
    removeDebtPayment
} from '@/db/database';
import { formatPayoffMonth, getDebtTypeIcon, isValidDateKey, parseNumber, todayKey } from '@/utils/debt';
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

  const fmt = (value: number, decimals = 0) =>
    `${currencySymbol}${value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;

  const fieldBg = colors.field;

  const handleAddPayment = async () => {
    const amount = parseNumber(amountInput);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Payment amount', 'Enter a payment amount greater than 0.');
      return;
    }
    if (!isValidDateKey(dateInput.trim())) {
      Alert.alert('Payment date', 'Use the format YYYY-MM-DD.');
      return;
    }
    try {
      await addManualDebtPayment(db, profileId, debt.id, amount, dateInput.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await loadPayments();
      onChanged();
    } catch (error) {
      console.error('Failed to add payment:', error);
      Alert.alert('Error', 'Failed to add this payment.');
    }
  };

  const handleRemovePayment = (payment: DebtPayment) => {
    const isAuto = payment.source === 'AUTO';
    Alert.alert(
      isAuto ? 'Unlink payment?' : 'Delete payment?',
      isAuto
        ? 'This statement transaction will no longer count toward this debt. Your transaction is not deleted.'
        : 'This payment will be removed from the debt history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isAuto ? 'Unlink' : 'Delete',
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
    { label: 'Paid off', value: fmt(debt.paidPrincipal) },
    { label: 'Interest paid (est.)', value: fmt(debt.paidInterest) },
    { label: 'Monthly payment', value: debt.paymentAmount > 0 ? fmt(debt.paymentAmount) : '—' },
    { label: 'Interest rate', value: debt.apr > 0 ? `${debt.apr}%` : '0%' },
    { label: 'Debt-free (est.)', value: debt.isPaidOff ? 'Done' : formatPayoffMonth(debt.payoffMonth) },
    {
      label: 'Future interest (est.)',
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
              <Text style={[styles.headerAction, { color: colors.accent }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {debt.name}
            </Text>
            <TouchableOpacity onPress={onEdit} hitSlop={8}>
              <Text style={[styles.headerAction, styles.bold, { color: colors.accent }]}>Edit</Text>
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
                    <Text style={styles.paidBadgeText}>Paid off</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>REMAINING</Text>
              <Text style={[styles.heroValue, { color: colors.text }]}>{fmt(debt.balance, 2)}</Text>

              <View style={styles.barWrap}>
                <DebtProgressBar percent={debt.percentPaid} color={debt.color} height={12} />
              </View>
              <View style={styles.heroFooter}>
                <Text style={[styles.heroFooterText, { color: colors.textSecondary }]}>
                  {debt.percentPaid.toFixed(0)}% paid
                </Text>
                <Text style={[styles.heroFooterText, { color: colors.textSecondary }]}>
                  of {fmt(debt.originalAmount)}
                </Text>
              </View>
            </View>

            {neverPaysOff && (
              <View style={styles.warnCard}>
                <Ionicons name="warning-outline" size={16} color="#FF9500" />
                <Text style={styles.warnText}>
                  The monthly payment doesn't cover the monthly interest, so the balance won't shrink at this rate.
                </Text>
              </View>
            )}

            <View style={styles.statsGrid}>
              {stats.map((stat) => (
                <View
                  key={stat.label}
                  style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                    {stat.label}
                  </Text>
                  <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>

            {!debt.isPaidOff && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ADD A PAYMENT</Text>
                <View style={styles.addRow}>
                  <View style={[styles.inputWrap, styles.amountInput, { backgroundColor: fieldBg, borderColor: colors.border }]}>
                    <Text style={[styles.affix, { color: colors.textSecondary }]}>{currencySymbol}</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={amountInput}
                      onChangeText={setAmountInput}
                      placeholder="Amount"
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
                  <Text style={styles.addBtnText}>Record Payment</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              PAYMENT HISTORY ({payments.length})
            </Text>
            {payments.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No payments yet. Add keywords to auto-link statement payments, or record one manually.
              </Text>
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
                      <Text style={[styles.paymentDate, { color: colors.text }]}>{payment.date}</Text>
                      <Text style={[styles.paymentSplit, { color: colors.textSecondary }]}>
                        {fmt(payment.principal, 2)} principal
                        {payment.interest > 0 ? ` • ${fmt(payment.interest, 2)} interest` : ''}
                      </Text>
                    </View>
                    <View style={styles.paymentRight}>
                      <Text style={[styles.paymentAmount, { color: colors.text }]}>
                        {fmt(payment.amount, 2)}
                      </Text>
                      <View
                        style={[
                          styles.sourceBadge,
                          { backgroundColor: payment.source === 'AUTO' ? 'rgba(52,199,89,0.14)' : 'rgba(142,142,147,0.16)' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sourceText,
                            { color: payment.source === 'AUTO' ? '#34C759' : colors.textSecondary },
                          ]}
                        >
                          {payment.source === 'AUTO' ? 'Auto' : 'Manual'}
                        </Text>
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
  paymentLeft: { flex: 1 },
  paymentDate: { fontSize: 14, fontWeight: '600' },
  paymentSplit: { fontSize: 11, marginTop: 2 },
  paymentRight: { alignItems: 'flex-end', marginRight: 8 },
  paymentAmount: { fontSize: 14, fontWeight: '700' },
  sourceBadge: { marginTop: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  sourceText: { fontSize: 10, fontWeight: '700' },
  removeBtn: { padding: 2 },
});