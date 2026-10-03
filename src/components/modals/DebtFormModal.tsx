import { CATEGORY_COLOR_PALETTE } from '@/constants/colors';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    createDebt, DebtInput,
    DebtSummary,
    DebtType, deleteDebt, syncDebtPayments,
    updateDebt
} from '@/db/database';
import { DEBT_TYPE_OPTIONS, isValidDateKey, parseNumber } from '@/utils/debt';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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

interface DebtFormModalProps {
  visible: boolean;
  debt: DebtSummary | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}

export function DebtFormModal({ visible, debt, onClose, onSaved }: DebtFormModalProps) {
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const { activeProfile, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const [name, setName] = useState('');
  const [type, setType] = useState<DebtType>('LOAN');
  const [amount, setAmount] = useState('');
  const [apr, setApr] = useState('');
  const [payment, setPayment] = useState('');
  const [payDay, setPayDay] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [color, setColor] = useState(CATEGORY_COLOR_PALETTE[0]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSaving(false);
    setKeywordInput('');
    if (debt) {
      setName(debt.name);
      setType(debt.type);
      setAmount(String(debt.originalAmount));
      setApr(debt.apr > 0 ? String(debt.apr) : '');
      setPayment(debt.paymentAmount > 0 ? String(debt.paymentAmount) : '');
      setPayDay(String(debt.paymentDay));
      setStartDate(debt.startDate ?? '');
      setColor(debt.color);
      setKeywords(debt.keywords.map((k) => k.toUpperCase()));
    } else {
      setName('');
      setType('LOAN');
      setAmount('');
      setApr('');
      setPayment('');
      setPayDay('1');
      setStartDate('');
      setColor(CATEGORY_COLOR_PALETTE[0]);
      setKeywords([]);
    }
  }, [visible, debt]);

  const fieldBg = isDark ? '#2C2C2E' : '#FFFFFF';

  const handleAddKeyword = () => {
    const keyword = keywordInput.trim().toUpperCase();
    if (!keyword) return;
    if (!keywords.includes(keyword)) {
      Haptics.selectionAsync().catch(() => {});
      setKeywords((prev) => [...prev, keyword]);
    }
    setKeywordInput('');
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const originalAmount = parseNumber(amount);
    const aprValue = apr.trim() === '' ? 0 : parseNumber(apr);
    const paymentValue = payment.trim() === '' ? 0 : parseNumber(payment);
    const dayValue = payDay.trim() === '' ? 1 : parseInt(payDay, 10);
    const startValue = startDate.trim();

    if (!trimmedName) return Alert.alert('Name required', 'Please enter a name for this debt.');
    if (isNaN(originalAmount) || originalAmount <= 0)
      return Alert.alert('Original amount', 'Enter the original amount borrowed (greater than 0).');
    if (isNaN(aprValue) || aprValue < 0 || aprValue > 100)
      return Alert.alert('Interest rate', 'Enter an annual interest rate between 0 and 100.');
    if (isNaN(paymentValue) || paymentValue < 0)
      return Alert.alert('Monthly payment', 'Enter a valid monthly payment amount.');
    if (isNaN(dayValue) || dayValue < 1 || dayValue > 31)
      return Alert.alert('Payment day', 'Enter a day of the month between 1 and 31.');
    if (startValue !== '' && !isValidDateKey(startValue))
      return Alert.alert('Start date', 'Use the format YYYY-MM-DD, or leave it empty.');

    const input: DebtInput = {
      name: trimmedName,
      type,
      originalAmount,
      apr: aprValue,
      paymentAmount: paymentValue,
      paymentDay: dayValue,
      startDate: startValue === '' ? null : startValue,
      color,
      keywords,
    };

    setSaving(true);
    try {
      if (debt) {
        await updateDebt(db, debt.id, input);
      } else {
        await createDebt(db, profileId, input);
      }
      const linked = await syncDebtPayments(db, profileId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
      onClose();
      if (linked > 0) {
        setTimeout(() => {
          Alert.alert(
            'Payments linked',
            `${linked} payment${linked === 1 ? '' : 's'} found in your statements and added automatically.`
          );
        }, 350);
      }
    } catch (error) {
      console.error('Failed to save debt:', error);
      Alert.alert('Error', 'Failed to save this debt.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!debt) return;
    Alert.alert(
      'Delete debt?',
      `"${debt.name}" and its payment history will be removed. Your bank transactions are not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebt(db, debt.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              onSaved();
              onClose();
            } catch (error) {
              console.error('Failed to delete debt:', error);
              Alert.alert('Error', 'Failed to delete this debt.');
            }
          },
        },
      ]
    );
  };

  const renderField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    options?: { keyboard?: 'default' | 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation'; prefix?: string; suffix?: string; maxLength?: number }
  ) => (
    <>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: fieldBg, borderColor: colors.border }]}>
        {options?.prefix ? (
          <Text style={[styles.affix, { color: colors.textSecondary }]}>{options.prefix}</Text>
        ) : null}
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={options?.keyboard ?? 'default'}
          maxLength={options?.maxLength}
          autoCorrect={false}
        />
        {options?.suffix ? (
          <Text style={[styles.affix, { color: colors.textSecondary }]}>{options.suffix}</Text>
        ) : null}
      </View>
    </>
  );

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
              <Text style={[styles.headerAction, { color: colors.accent }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {debt ? 'Edit Debt' : 'New Debt'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={8}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={[styles.headerAction, styles.bold, { color: colors.accent }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {renderField('NAME', name, setName, 'e.g. Car loan', { maxLength: 40 })}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {DEBT_TYPE_OPTIONS.map((option) => {
                const isActive = option.key === type;
                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setType(option.key);
                    }}
                    style={[
                      styles.typeChip,
                      { backgroundColor: fieldBg, borderColor: colors.border },
                      isActive && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                  >
                    <Ionicons name={option.icon} size={15} color={isActive ? '#FFFFFF' : colors.textSecondary} />
                    <Text style={[styles.typeText, { color: isActive ? '#FFFFFF' : colors.text }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {renderField('ORIGINAL AMOUNT', amount, setAmount, '0.00', {
              keyboard: 'decimal-pad',
              prefix: currencySymbol,
            })}
            {renderField('INTEREST RATE (APR, OPTIONAL)', apr, setApr, '0', {
              keyboard: 'decimal-pad',
              suffix: '%',
            })}
            {renderField('MONTHLY PAYMENT', payment, setPayment, '0.00', {
              keyboard: 'decimal-pad',
              prefix: currencySymbol,
            })}
            {renderField('PAYMENT DAY OF MONTH', payDay, setPayDay, '1', {
              keyboard: 'number-pad',
              maxLength: 2,
            })}
            {renderField('START DATE (OPTIONAL)', startDate, setStartDate, 'YYYY-MM-DD', {
              keyboard: 'numbers-and-punctuation',
              maxLength: 10,
            })}
            <Text style={[styles.footnote, { color: colors.textSecondary }]}>
              Interest is estimated daily from the start date. Without a start date, interest is counted from the
              first payment.
            </Text>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>COLOR</Text>
            <View style={styles.swatchGrid}>
              {CATEGORY_COLOR_PALETTE.map((swatch) => {
                const isSelected = swatch === color;
                return (
                  <TouchableOpacity
                    key={swatch}
                    activeOpacity={0.8}
                    style={[styles.swatchRing, isSelected && { borderColor: swatch }]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setColor(swatch);
                    }}
                  >
                    <View style={[styles.swatch, { backgroundColor: swatch }]}>
                      {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              AUTO-LINK KEYWORDS
            </Text>
            <Text style={[styles.footnote, styles.footnoteTop, { color: colors.textSecondary }]}>
              Statement transactions whose merchant or description contains a keyword are added as payments
              automatically.
            </Text>
            <View style={styles.keywordInputRow}>
              <View
                style={[
                  styles.inputWrap,
                  styles.keywordInputWrap,
                  { backgroundColor: fieldBg, borderColor: colors.border },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={keywordInput}
                  onChangeText={setKeywordInput}
                  placeholder="e.g. DUO"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleAddKeyword}
                />
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleAddKeyword}
                disabled={keywordInput.trim().length === 0}
                style={[
                  styles.addKeywordBtn,
                  { backgroundColor: colors.accent },
                  keywordInput.trim().length === 0 && styles.disabled,
                ]}
              >
                <Text style={styles.addKeywordText}>Add</Text>
              </TouchableOpacity>
            </View>

            {keywords.length > 0 && (
              <View style={styles.chipWrap}>
                {keywords.map((keyword) => (
                  <View
                    key={keyword}
                    style={[styles.chip, { backgroundColor: fieldBg, borderColor: colors.border }]}
                  >
                    <Text style={[styles.chipText, { color: colors.text }]}>{keyword}</Text>
                    <TouchableOpacity
                      onPress={() => setKeywords((prev) => prev.filter((k) => k !== keyword))}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {debt && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.dangerRow, { backgroundColor: colors.card }]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                <Text style={styles.dangerText}>Delete Debt</Text>
              </TouchableOpacity>
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
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerAction: { fontSize: 16, fontWeight: '500' },
  bold: { fontWeight: '700' },
  content: { padding: 20, paddingBottom: 64 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 46,
    gap: 6,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  affix: { fontSize: 16, fontWeight: '600' },
  footnote: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  footnoteTop: { marginTop: 0, marginBottom: 10 },
  typeRow: { gap: 8 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeText: { fontSize: 13, fontWeight: '600' },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  keywordInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  keywordInputWrap: { flex: 1 },
  addKeywordBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addKeywordText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  dangerText: { color: '#FF3B30', fontSize: 16, fontWeight: '700' },
});