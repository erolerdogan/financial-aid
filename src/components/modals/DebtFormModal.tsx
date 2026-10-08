import { SelectableText } from '@/components/SelectableText';
import { CATEGORY_COLOR_PALETTE } from '@/constants/colors';
import { useI18n } from '@/contexts/LanguageContext';
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
    DEBT_TERM_UNITS,
    DEBT_TYPE_OPTIONS,
    debtKeywordLength,
    DebtTermUnit,
    estimateApr,
    isValidDateKey,
    MAX_DEBT_TERM_MONTHS,
    MIN_DEBT_KEYWORD_LENGTH,
    suggestDebtTerms,
    termToMonths,
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

export interface DebtPrefill {
  name: string;
  type: DebtType;
  keywords: string[];
}

interface DebtFormModalProps {
  visible: boolean;
  debt: DebtSummary | null; // null = create
  prefill?: DebtPrefill | null; // create only: start from a statement suggestion
  /** Open scrolled to the interest rate field (from the payoff plan's "add the rate" hint). */
  focusApr?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function DebtFormModal({ visible, debt, prefill, focusApr = false, onClose, onSaved }: DebtFormModalProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { activeProfile, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const [name, setName] = useState('');
  const [type, setType] = useState<DebtType>('LOAN');
  const [amount, setAmount] = useState('');
  const [apr, setApr] = useState('');
  const [payment, setPayment] = useState('');
  const [payDay, setPayDay] = useState('1');
  const [term, setTerm] = useState('');
  const [termUnit, setTermUnit] = useState<DebtTermUnit>('MONTHS');
  const [startDate, setStartDate] = useState('');
  const [color, setColor] = useState(CATEGORY_COLOR_PALETTE[0]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null);
  const keywordInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const keywordSectionY = useRef(0);
  const aprSectionY = useRef(0);

  // After the sheet has presented and the fields are laid out.
  useEffect(() => {
    if (!visible || !focusApr) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, aprSectionY.current - 8), animated: true });
    }, 500);
    return () => clearTimeout(timer);
  }, [visible, focusApr]);

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
      const wholeYears = !!debt.termMonths && debt.termMonths % 12 === 0;
      setTerm(debt.termMonths ? String(wholeYears ? debt.termMonths / 12 : debt.termMonths) : '');
      setTermUnit(wholeYears ? 'YEARS' : 'MONTHS');
      setStartDate(debt.startDate ?? '');
      setColor(debt.color);
      setKeywords(debt.keywords.map((k) => k.toUpperCase()));
    } else {
      setName(prefill?.name ?? '');
      setType(prefill?.type ?? 'LOAN');
      setAmount('');
      setApr('');
      setPayment('');
      setPayDay('1');
      setTerm('');
      setTermUnit('MONTHS');
      setStartDate('');
      setColor(CATEGORY_COLOR_PALETTE[0]);
      setKeywords(prefill?.keywords.map((k) => k.toUpperCase()) ?? []);
    }
  }, [visible, debt, prefill]);

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

  const fieldBg = colors.field;

  const matches = loadedMatches.filter((m) => keywords.includes(m.keyword));

  const fmt = (value: number) =>
    format.money(value, currencySymbol, 2);

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
    beforeStartCount > 0 ? t('debt.form.hintBeforeStart', { count: beforeStartCount }) : null,
    otherDebtCount > 0 ? t('debt.form.hintOtherDebt', { count: otherDebtCount }) : null,
    ignoredCount > 0 ? t('debt.form.hintIgnored', { count: ignoredCount }) : null,
  ].filter((hint): hint is string => hint !== null);

  const handleAddKeyword = () => {
    const keyword = keywordInput.trim().toUpperCase();
    if (!keyword) return;
    const normalized = normalizeMatchText(keyword);
    if (debtKeywordLength(keyword) < MIN_DEBT_KEYWORD_LENGTH) {
      Alert.alert(
        t('debt.form.keywordShortTitle'),
        t('debt.form.keywordShortMessage', { min: MIN_DEBT_KEYWORD_LENGTH })
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
    const termValue = termToMonths(term, termUnit);
    const startValue = startDate.trim();

    if (!trimmedName) return Alert.alert(t('categoryForm.nameRequiredTitle'), t('debt.form.nameRequired'));
    if (isNaN(originalAmount) || originalAmount <= 0)
      return Alert.alert(t('debt.form.originalTitle'), t('debt.form.originalMessage'));
    if (isNaN(aprValue) || aprValue < 0 || aprValue > 100)
      return Alert.alert(t('debt.detail.interestRate'), t('debt.form.aprMessage'));
    if (isNaN(paymentValue) || paymentValue < 0)
      return Alert.alert(t('debt.detail.monthlyPayment'), t('debt.form.paymentMessage'));
    if (isNaN(dayValue) || dayValue < 1 || dayValue > 31)
      return Alert.alert(t('debt.form.payDayTitle'), t('debt.form.payDayMessage'));
    if (termValue !== null && isNaN(termValue))
      return Alert.alert(
        t('debt.form.termTitle'),
        t('debt.form.termMessage', { years: MAX_DEBT_TERM_MONTHS / 12 })
      );
    if (startValue !== '' && !isValidDateKey(startValue))
      return Alert.alert(t('debt.form.startTitle'), t('debt.form.startMessage'));

    const input: DebtInput = {
      name: trimmedName,
      type,
      originalAmount,
      apr: aprValue,
      paymentAmount: paymentValue,
      paymentDay: dayValue,
      startDate: startValue === '' ? null : startValue,
      termMonths: termValue,
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
      Alert.alert(t('common.error'), t('debt.form.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!debt) return;
    Alert.alert(
      t('debt.deleteTitle'),
      t('debt.deleteMessage', { name: debt.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebt(db, debt.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              onSaved();
              onClose();
            } catch (error) {
              console.error('Failed to delete debt:', error);
              Alert.alert(t('common.error'), t('debt.deleteFailed'));
            }
          },
        },
      ]
    );
  };

  // Rate implied by amount, payment and term; offered under the APR field, never written silently.
  const termNumber = termToMonths(term, termUnit) ?? NaN;
  const amountNumber = parseNumber(amount);
  const paymentNumber = parseNumber(payment);
  const canEstimateApr = !isNaN(termNumber) && amountNumber > 0 && paymentNumber > 0;
  const estimatedApr = canEstimateApr ? estimateApr(amountNumber, paymentNumber, termNumber) : null;
  const aprNumber = apr.trim() === '' ? 0 : parseNumber(apr);
  const showAprEstimate = estimatedApr !== null && Math.abs(aprNumber - estimatedApr) > 0.005;
  const formatMoney = (value: number) =>
    format.money(value, currencySymbol, { maximumFractionDigits: 2 });
  const needsTermForEstimate = term.trim() === '' && apr.trim() === '' && amountNumber > 0 && paymentNumber > 0;

  const renderField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    options?: { keyboard?: 'default' | 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation'; prefix?: string; suffix?: string; maxLength?: number }
  ) => (
    <>
      <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>{label}</SelectableText>
      <View style={[styles.inputWrap, { backgroundColor: fieldBg, borderColor: colors.border }]}>
        {options?.prefix ? (
          <SelectableText style={[styles.affix, { color: colors.textSecondary }]}>{options.prefix}</SelectableText>
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
          <SelectableText style={[styles.affix, { color: colors.textSecondary }]}>{options.suffix}</SelectableText>
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
              <Text style={[styles.headerAction, { color: colors.accent }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <SelectableText style={[styles.headerTitle, { color: colors.text }]}>
              {debt ? t('debt.form.editTitle') : t('debt.form.newTitle')}
            </SelectableText>
            <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={8}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={[styles.headerAction, styles.bold, { color: colors.accent }]}>{t('common.save')}</Text>
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
            {renderField(t('categoryForm.name'), name, setName, t('debt.form.namePlaceholder'), { maxLength: 40 })}

            <SelectableText
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
              onLayout={(event) => {
                keywordSectionY.current = event.nativeEvent.layout.y;
              }}
            >
              {t('debt.form.keywords')}
            </SelectableText>
            <SelectableText style={[styles.footnote, styles.footnoteTop, { color: colors.textSecondary }]}>
              {t('debt.form.keywordsHelp')}
            </SelectableText>
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
                  placeholder={t('debt.form.keywordPlaceholder')}
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
                <Text style={styles.addKeywordText}>{editingKeyword !== null ? t('debt.form.update') : t('common.add')}</Text>
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
                      accessibilityLabel={t('debt.form.a11yEditKeyword', { keyword })}
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

            <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('debt.form.type')}</SelectableText>
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
                      {t(option.label)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {renderField(t('debt.form.original'), amount, setAmount, '0.00', {
              keyboard: 'decimal-pad',
              prefix: currencySymbol,
            })}
            {renderField(t('debt.form.payment'), payment, setPayment, '0.00', {
              keyboard: 'decimal-pad',
              prefix: currencySymbol,
            })}
            <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('debt.form.term')}</SelectableText>
            <View style={styles.termRow}>
              <View style={[styles.inputWrap, styles.flex, { backgroundColor: fieldBg, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={term}
                  onChangeText={setTerm}
                  placeholder={termUnit === 'YEARS' ? '5' : '60'}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType={termUnit === 'YEARS' ? 'decimal-pad' : 'number-pad'}
                  maxLength={termUnit === 'YEARS' ? 4 : 3}
                  autoCorrect={false}
                />
              </View>
              <View style={[styles.unitToggle, { backgroundColor: fieldBg, borderColor: colors.border }]}>
                {DEBT_TERM_UNITS.map((unit) => {
                  const isActive = unit.key === termUnit;
                  return (
                    <TouchableOpacity
                      key={unit.key}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setTermUnit(unit.key);
                      }}
                      style={[styles.unitOption, isActive && { backgroundColor: colors.accent }]}
                    >
                      <Text style={[styles.typeText, { color: isActive ? '#FFFFFF' : colors.text }]}>
                        {t(unit.label)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View
              onLayout={(event) => {
                aprSectionY.current = event.nativeEvent.layout.y;
              }}
            >
              {renderField(t('debt.form.apr'), apr, setApr, '0', {
                keyboard: 'decimal-pad',
                suffix: '%',
              })}
            </View>
            {showAprEstimate && (
              <View style={styles.estimateRow}>
                <SelectableText style={[styles.estimateText, { color: colors.textSecondary }]}>
                  {t('debt.form.estimatedRate', { rate: estimatedApr ?? '' })}
                </SelectableText>
                <TouchableOpacity
                  activeOpacity={0.8}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('debt.form.a11yUseRate', { rate: estimatedApr ?? '' })}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setApr(String(estimatedApr));
                  }}
                >
                  <Text style={[styles.estimateAction, { color: colors.accent }]}>{t('debt.form.use')}</Text>
                </TouchableOpacity>
              </View>
            )}
            {needsTermForEstimate && (
              <SelectableText style={[styles.footnote, { color: colors.textSecondary }]}>
                {t('debt.form.rateHelp')}
              </SelectableText>
            )}
            {canEstimateApr && estimatedApr === null && (
              <SelectableText style={[styles.footnote, { color: colors.textSecondary }]}>
                {paymentNumber * termNumber < amountNumber
                  ? t('debt.form.noRateLow', {
                      count: termNumber,
                      payment: formatMoney(paymentNumber),
                      total: formatMoney(paymentNumber * termNumber),
                      amount: formatMoney(amountNumber),
                    })
                  : t('debt.form.noRateHigh', {
                      count: termNumber,
                      payment: formatMoney(paymentNumber),
                      total: formatMoney(paymentNumber * termNumber),
                      amount: formatMoney(amountNumber),
                    })}
              </SelectableText>
            )}
            {renderField(t('debt.form.payDay'), payDay, setPayDay, '1', {
              keyboard: 'number-pad',
              maxLength: 2,
            })}
            {renderField(t('debt.form.start'), startDate, setStartDate, 'YYYY-MM-DD', {
              keyboard: 'numbers-and-punctuation',
              maxLength: 10,
            })}
            {autoFilledFrom > 0 && (
              <SelectableText style={[styles.footnote, { color: colors.accent }]}>
                {t('debt.form.autoFilled', { count: autoFilledFrom })}
              </SelectableText>
            )}
            <SelectableText style={[styles.footnote, { color: colors.textSecondary }]}>
              {t('debt.form.interestNote')}
            </SelectableText>

            <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('categoryForm.color')}</SelectableText>
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

            {keywords.length > 0 && (
              <>
                <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  {t('debt.form.matching', { count: included.length })}
                </SelectableText>
                {payable.length === 0 ? (
                  <SelectableText style={[styles.footnote, styles.footnoteTop, { color: colors.textSecondary }]}>
                    {t('debt.form.noMatches')}
                  </SelectableText>
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
                            <SelectableText
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
                            </SelectableText>
                            <SelectableText style={[styles.previewDate, { color: colors.textSecondary }]}>
                              {match.date}
                              {isExcluded ? ` • ${t('debt.form.willUnlink')}` : ''}
                            </SelectableText>
                          </View>
                          <SelectableText
                            style={[
                              styles.previewAmount,
                              { color: colors.text },
                              isExcluded && styles.disabled,
                              isExcluded && styles.strike,
                            ]}
                          >
                            {fmt(match.amount)}
                          </SelectableText>
                          <TouchableOpacity
                            onPress={() => toggleExcluded(match.id)}
                            hitSlop={10}
                            accessibilityLabel={isExcluded ? t('debt.form.a11yKeep') : t('debt.form.a11yUnlink')}
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
                          {showAllMatches ? t('debt.form.showFewer') : t('debt.form.showAll', { count: payable.length })}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <View
                      style={[
                        styles.previewRow,
                        { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                      ]}
                    >
                      <SelectableText style={[styles.previewDate, styles.previewLeft, { color: colors.textSecondary }]}>
                        {t('debt.form.total')}
                      </SelectableText>
                      <SelectableText style={[styles.previewAmount, { color: colors.text }]}>{fmt(payableTotal)}</SelectableText>
                    </View>
                  </View>
                )}
                {payable.length > 0 && (
                  <SelectableText style={[styles.footnote, { color: colors.textSecondary }]}>
                    {t('debt.form.unlinkHelp')}
                  </SelectableText>
                )}
                {possible.length > 0 && (
                  <>
                    <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      {t('debt.form.possible', { count: possible.length })}
                    </SelectableText>
                    <SelectableText style={[styles.footnote, styles.footnoteTop, { color: colors.textSecondary }]}>
                      {t('debt.form.possibleHelp')}
                    </SelectableText>
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
                              <SelectableText style={[styles.previewMerchant, { color: colors.text }]} numberOfLines={1}>
                                {match.merchant && match.merchant !== 'Unknown'
                                  ? match.merchant
                                  : match.rawDescription}
                              </SelectableText>
                              <SelectableText style={[styles.previewDate, { color: colors.textSecondary }]} numberOfLines={1}>
                                {match.date} • {fmt(match.amount)} •{' '}
                                {match.strength === 'EXACT' ? t('debt.form.unusualAmount') : t('debt.form.similarTo', { keyword: match.keyword })}
                              </SelectableText>
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
                                {isAdded ? t('debt.form.added') : t('common.add')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                    {possible.length > 8 && (
                      <SelectableText style={[styles.footnote, { color: colors.textSecondary }]}>
                        +{possible.length - 8} more. Use a more specific keyword to narrow these down.
                      </SelectableText>
                    )}
                  </>
                )}
                {unmatchedKeywords.length > 0 && payable.length > 0 && (
                  <SelectableText style={[styles.footnote, { color: colors.textSecondary }]}>
                    {t('debt.form.noneContain', { keywords: unmatchedKeywords.join(', ') })}
                  </SelectableText>
                )}
                {previewHints.length > 0 && (
                  <SelectableText style={[styles.footnote, { color: colors.textSecondary }]}>
                    {t('debt.form.notCounted', { hints: previewHints.join(' • ') })}
                  </SelectableText>
                )}
              </>
            )}

            {debt && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.dangerRow, { backgroundColor: colors.card }]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                <Text style={styles.dangerText}>{t('debt.form.delete')}</Text>
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
  termRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unitToggle: {
    flexDirection: 'row',
    height: 46,
    padding: 3,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unitOption: { paddingHorizontal: 14, borderRadius: 9, justifyContent: 'center' },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  estimateText: { flex: 1, fontSize: 12, lineHeight: 17 },
  estimateAction: { fontSize: 14, fontWeight: '600' },
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