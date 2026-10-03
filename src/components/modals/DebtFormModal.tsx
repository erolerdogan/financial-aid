import { CATEGORY_COLOR_PALETTE } from '@/constants/colors';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    createDebt, DebtInput,
    DebtKeywordMatch,
    DebtSummary,
    DebtType, deleteDebt, getDebtKeywordMatches, linkDebtTransaction, syncDebtPayments,
    unlinkDebtTransaction,
    updateDebt
} from '@/db/database';
import {
    DEBT_TYPE_OPTIONS,
    debtKeywordLength,
    isValidDateKey,
    MIN_DEBT_KEYWORD_LENGTH,
    suggestDebtTerms,
    normalizeMatchText,
    parseNumber
} from '@/utils/debt';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null);
  const keywordInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const keywordSectionY = useRef(0);

  // Bring the keyword section above the keyboard once it has finished opening.
  const scrollToKeywords = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, keywordSectionY.current - 8), animated: true });
    }, 300);
  };
  const [saving, setSaving] = useState(false);
  const [loadedMatches, setLoadedMatches] = useState<DebtKeywordMatch[]>([]);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [excludedIds, setExcludedIds] = useState<number[]>([]);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [autoFilledFrom, setAutoFilledFrom] = useState(0);
  // Last values filled in from statements; a field still holding one counts as untouched.
  const autoFill = useRef({ payment: '', payDay: '', startDate: '' });
  // Keyword set the fields were last filled for, so clearing a field does not refill it.
  const autoFillKey = useRef('');

  useEffect(() => {
    if (!visible) return;
    setSaving(false);
    setKeywordInput('');
    setEditingKeyword(null);
    setAddedIds([]);
    setExcludedIds([]);
    setShowAllMatches(false);
    setAutoFilledFrom(0);
    autoFill.current = { payment: '', payDay: '', startDate: '' };
    autoFillKey.current = debt ? debt.keywords.map((k) => k.toUpperCase()).join('|') : '';
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

  const debtId = debt?.id ?? null;

  useEffect(() => {
    if (!visible || keywords.length === 0) return;
    const startValue = startDate.trim();
    if (startValue !== '' && !isValidDateKey(startValue)) return;

    const paymentValue = parseNumber(payment);

    let cancelled = false;
    getDebtKeywordMatches(
      db,
      profileId,
      keywords,
      startValue === '' ? null : startValue,
      isNaN(paymentValue) ? 0 : paymentValue,
      debtId
    )
      .then((rows) => {
        if (cancelled) return;
        setLoadedMatches(rows);

        const key = keywords.join('|');
        if (key === autoFillKey.current) return;
        autoFillKey.current = key;

        const suggestion = suggestDebtTerms(
          rows.filter((m) => m.strength === 'EXACT' && m.status !== 'OTHER_DEBT' && m.status !== 'IGNORED')
        );
        if (!suggestion) return;
        const last = autoFill.current;
        const isCreate = debtId === null;
        let filled = false;
        const fill = (prev: string, lastValue: string, next: string, emptyValue = '') => {
          if (prev !== emptyValue && prev !== '' && prev !== lastValue) return prev;
          filled = true;
          return next;
        };
        const nextPayment = fill(payment, last.payment, suggestion.payment);
        const nextPayDay = fill(payDay, last.payDay, suggestion.payDay, isCreate ? '1' : '');
        const nextStartDate = fill(startDate, last.startDate, suggestion.startDate);
        if (!filled) return;

        autoFill.current = {
          payment: nextPayment === suggestion.payment ? suggestion.payment : last.payment,
          payDay: nextPayDay === suggestion.payDay ? suggestion.payDay : last.payDay,
          startDate: nextStartDate === suggestion.startDate ? suggestion.startDate : last.startDate,
        };
        if (nextPayment !== payment) setPayment(nextPayment);
        if (nextPayDay !== payDay) setPayDay(nextPayDay);
        if (nextStartDate !== startDate) setStartDate(nextStartDate);
        setAutoFilledFrom(suggestion.count);
      })
      .catch((error) => console.error('Failed to preview debt payments:', error));
    return () => {
      cancelled = true;
    };
  }, [visible, db, profileId, keywords, startDate, payment, payDay, debtId]);

  const fieldBg = isDark ? '#2C2C2E' : '#FFFFFF';

  const matches = loadedMatches.filter((m) => keywords.includes(m.keyword));

  const fmt = (value: number) =>
    `${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const countByStatus = (status: DebtKeywordMatch['status']) =>
    matches.filter((m) => m.status === status).length;

  const payable = matches.filter((m) => m.status === 'NEW' || m.status === 'LINKED');
  const possible = matches.filter((m) => m.status === 'POSSIBLE');
  const toggleAdded = (id: number) => {
    Haptics.selectionAsync().catch(() => {});
    setAddedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const included = payable.filter((m) => !excludedIds.includes(m.id));
  const payableTotal = included.reduce((sum, m) => sum + m.amount, 0);
  const shownPayable = showAllMatches ? payable : payable.slice(0, 5);
  const toggleExcluded = (id: number) => {
    Haptics.selectionAsync().catch(() => {});
    setExcludedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const beforeStartCount = countByStatus('BEFORE_START');
  const otherDebtCount = countByStatus('OTHER_DEBT');
  const ignoredCount = countByStatus('IGNORED');
  const unmatchedKeywords = keywords.filter((k) => !matches.some((m) => m.keyword === k));
  const previewHints = [
    beforeStartCount > 0 ? `${beforeStartCount} before the start date` : null,
    otherDebtCount > 0 ? `${otherDebtCount} already linked to another debt` : null,
    ignoredCount > 0 ? `${ignoredCount} unlinked by you` : null,
  ].filter((hint): hint is string => hint !== null);

  const handleAddKeyword = () => {
    const keyword = keywordInput.trim().toUpperCase();
    if (!keyword) return;
    const normalized = normalizeMatchText(keyword);
    if (debtKeywordLength(keyword) < MIN_DEBT_KEYWORD_LENGTH) {
      Alert.alert(
        'Keyword too short',
        `Use at least ${MIN_DEBT_KEYWORD_LENGTH} letters or digits so unrelated transactions are not linked.`
      );
      return;
    }
    const isDuplicate = keywords.some(
      (k) => k !== editingKeyword && normalizeMatchText(k) === normalized
    );
    if (editingKeyword !== null) {
      Haptics.selectionAsync().catch(() => {});
      setKeywords((prev) =>
        isDuplicate
          ? prev.filter((k) => k !== editingKeyword)
          : prev.map((k) => (k === editingKeyword ? keyword : k))
      );
    } else if (!isDuplicate) {
      Haptics.selectionAsync().catch(() => {});
      setKeywords((prev) => [...prev, keyword]);
    }
    setEditingKeyword(null);
    setKeywordInput('');
  };

  const handleEditKeyword = (keyword: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (editingKeyword === keyword) {
      setEditingKeyword(null);
      setKeywordInput('');
      return;
    }
    setEditingKeyword(keyword);
    setKeywordInput(keyword);
    keywordInputRef.current?.focus();
  };

  const handleRemoveKeyword = (keyword: string) => {
    if (editingKeyword === keyword) {
      setEditingKeyword(null);
      setKeywordInput('');
    }
    setKeywords((prev) => prev.filter((k) => k !== keyword));
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
      let savedId: number;
      if (debt) {
        await updateDebt(db, debt.id, input);
        savedId = debt.id;
      } else {
        savedId = await createDebt(db, profileId, input);
      }
      await syncDebtPayments(db, profileId);
      for (const match of possible.filter((m) => addedIds.includes(m.id))) {
        await linkDebtTransaction(db, profileId, savedId, match.id, match.keyword);
      }
      for (const match of payable.filter((m) => excludedIds.includes(m.id))) {
        await unlinkDebtTransaction(db, savedId, match.id);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
      onClose();
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
        <View style={styles.flex}>
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
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
          >
            {renderField('NAME', name, setName, 'e.g. Car loan', { maxLength: 40 })}

            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
              onLayout={(event) => {
                keywordSectionY.current = event.nativeEvent.layout.y;
              }}
            >
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
                  ref={keywordInputRef}
                  style={[styles.input, { color: colors.text }]}
                  value={keywordInput}
                  onChangeText={setKeywordInput}
                  placeholder="e.g. DUO"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onFocus={scrollToKeywords}
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
                <Text style={styles.addKeywordText}>{editingKeyword !== null ? 'Update' : 'Add'}</Text>
              </TouchableOpacity>
            </View>

            {keywords.length > 0 && (
              <View style={styles.chipWrap}>
                {keywords.map((keyword) => (
                  <View
                    key={keyword}
                    style={[
                      styles.chip,
                      { backgroundColor: fieldBg, borderColor: colors.border },
                      editingKeyword === keyword && { borderColor: colors.accent, borderWidth: 1 },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleEditKeyword(keyword)}
                      hitSlop={{ top: 8, bottom: 8, left: 8 }}
                      style={styles.chipLabel}
                      accessibilityLabel={`Edit keyword ${keyword}`}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: editingKeyword === keyword ? colors.accent : colors.text },
                        ]}
                      >
                        {keyword}
                      </Text>
                      <Text style={[styles.chipCount, { color: colors.textSecondary }]}>
                        {matches.filter((m) => m.keyword === keyword).length}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveKeyword(keyword)} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {keywords.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  MATCHING PAYMENTS ({included.length})
                </Text>
                {payable.length === 0 ? (
                  <Text style={[styles.footnote, styles.footnoteTop, { color: colors.textSecondary }]}>
                    No statement transactions match yet. New imports are checked automatically.
                  </Text>
                ) : (
                  <View style={[styles.previewCard, { backgroundColor: colors.card }]}>
                    {shownPayable.map((match, index) => {
                      const isExcluded = excludedIds.includes(match.id);
                      return (
                        <View
                          key={match.id}
                          style={[
                            styles.previewRow,
                            index > 0 && {
                              borderTopWidth: StyleSheet.hairlineWidth,
                              borderTopColor: colors.border,
                            },
                          ]}
                        >
                          <View style={[styles.previewLeft, isExcluded && styles.disabled]}>
                            <Text
                              style={[
                                styles.previewMerchant,
                                { color: colors.text },
                                isExcluded && styles.strike,
                              ]}
                              numberOfLines={1}
                            >
                              {match.merchant && match.merchant !== 'Unknown'
                                ? match.merchant
                                : match.rawDescription}
                            </Text>
                            <Text style={[styles.previewDate, { color: colors.textSecondary }]}>
                              {match.date}
                              {isExcluded ? ' • will be unlinked' : ''}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.previewAmount,
                              { color: colors.text },
                              isExcluded && styles.disabled,
                              isExcluded && styles.strike,
                            ]}
                          >
                            {fmt(match.amount)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => toggleExcluded(match.id)}
                            hitSlop={10}
                            accessibilityLabel={isExcluded ? 'Keep this payment' : 'Unlink this payment'}
                          >
                            <Ionicons
                              name={isExcluded ? 'arrow-undo-circle-outline' : 'close-circle-outline'}
                              size={20}
                              color={isExcluded ? colors.accent : colors.textSecondary}
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    {payable.length > 5 && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowAllMatches((prev) => !prev)}
                        style={[
                          styles.previewRow,
                          { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.showAllText, { color: colors.accent }]}>
                          {showAllMatches ? 'Show fewer' : `Show all ${payable.length}`}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <View
                      style={[
                        styles.previewRow,
                        { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.previewDate, styles.previewLeft, { color: colors.textSecondary }]}>
                        Total
                      </Text>
                      <Text style={[styles.previewAmount, { color: colors.text }]}>{fmt(payableTotal)}</Text>
                    </View>
                  </View>
                )}
                {payable.length > 0 && (
                  <Text style={[styles.footnote, { color: colors.textSecondary }]}>
                    Tap the cross to unlink a payment that does not belong to this debt. It will not be linked
                    again.
                  </Text>
                )}
                {possible.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      POSSIBLE MATCHES ({possible.length})
                    </Text>
                    <Text style={[styles.footnote, styles.footnoteTop, { color: colors.textSecondary }]}>
                      Similar, but not linked automatically. Tap Add to include a payment when you save.
                    </Text>
                    <View style={[styles.previewCard, { backgroundColor: colors.card }]}>
                      {possible.slice(0, 8).map((match, index) => {
                        const isAdded = addedIds.includes(match.id);
                        return (
                          <View
                            key={match.id}
                            style={[
                              styles.previewRow,
                              index > 0 && {
                                borderTopWidth: StyleSheet.hairlineWidth,
                                borderTopColor: colors.border,
                              },
                            ]}
                          >
                            <View style={styles.previewLeft}>
                              <Text style={[styles.previewMerchant, { color: colors.text }]} numberOfLines={1}>
                                {match.merchant && match.merchant !== 'Unknown'
                                  ? match.merchant
                                  : match.rawDescription}
                              </Text>
                              <Text style={[styles.previewDate, { color: colors.textSecondary }]} numberOfLines={1}>
                                {match.date} • {fmt(match.amount)} •{' '}
                                {match.strength === 'EXACT' ? 'unusual amount' : `similar to ${match.keyword}`}
                              </Text>
                            </View>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => toggleAdded(match.id)}
                              hitSlop={8}
                              style={[
                                styles.possibleBtn,
                                { borderColor: colors.accent },
                                isAdded && { backgroundColor: colors.accent },
                              ]}
                            >
                              <Text style={[styles.possibleBtnText, { color: isAdded ? '#FFFFFF' : colors.accent }]}>
                                {isAdded ? 'Added' : 'Add'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                    {possible.length > 8 && (
                      <Text style={[styles.footnote, { color: colors.textSecondary }]}>
                        +{possible.length - 8} more. Use a more specific keyword to narrow these down.
                      </Text>
                    )}
                  </>
                )}
                {unmatchedKeywords.length > 0 && payable.length > 0 && (
                  <Text style={[styles.footnote, { color: colors.textSecondary }]}>
                    No statement transactions contain {unmatchedKeywords.join(', ')}.
                  </Text>
                )}
                {previewHints.length > 0 && (
                  <Text style={[styles.footnote, { color: colors.textSecondary }]}>
                    Not counted: {previewHints.join(' • ')}.
                  </Text>
                )}
              </>
            )}

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
            {autoFilledFrom > 0 && (
              <Text style={[styles.footnote, { color: colors.accent }]}>
                Monthly payment, payment day and start date were filled in from {autoFilledFrom} matching payment
                {autoFilledFrom === 1 ? '' : 's'}. Edit them if they are wrong.
              </Text>
            )}
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
        </View>
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
  chipLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipCount: { fontSize: 12, fontWeight: '600' },
  previewCard: { borderRadius: 14, overflow: 'hidden' },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  previewLeft: { flex: 1 },
  previewMerchant: { fontSize: 14, fontWeight: '600' },
  previewDate: { fontSize: 11, marginTop: 2 },
  previewAmount: { fontSize: 14, fontWeight: '700' },
  strike: { textDecorationLine: 'line-through' },
  showAllText: { flex: 1, fontSize: 13, fontWeight: '600' },
  possibleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  possibleBtnText: { fontSize: 13, fontWeight: '700' },
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