import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getUncategorisedGroups,
  getUncategorisedTransactions,
  quickCategorise,
  Transaction,
  UncategorisedGroup,
} from '@/db/database';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import {
  buildSections,
  GroupState,
  filterSections,
  QuickSection,
  ruleKeywordsFor,
  selectionState,
  toggleRow,
  toggleRows,
  visibleIds,
} from '@/utils/quickCategorise';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface QuickCategoriseSheetProps {
  visible: boolean;
  /** The category the picked transactions go to. */
  category: string | null;
  onClose: () => void;
  onMoved: (count: number) => void;
}

const CHECK_ICONS = {
  none: 'ellipse-outline',
  some: 'remove-circle',
  all: 'checkmark-circle',
} as const;

const MerchantHeader = memo(function MerchantHeader({
  section,
  state,
  onToggle,
}: {
  section: QuickSection<Transaction>;
  state: GroupState;
  onToggle: (ids: number[]) => void;
}) {
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { currencySymbol } = useProfile();

  if (!section.group) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={[styles.looseTitle, { color: colors.textSecondary }]}>{t('quickAdd.other')}</Text>
      </View>
    );
  }

  const total = section.data.reduce((sum, row) => sum + Math.abs(row.amount), 0);
  return (
    <TouchableOpacity
      style={styles.sectionHeader}
      activeOpacity={0.7}
      onPress={() => onToggle(section.data.map((row) => row.id))}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: state === 'some' ? 'mixed' : state === 'all' }}
    >
      <Ionicons
        name={CHECK_ICONS[state]}
        size={22}
        color={state === 'none' ? colors.textSecondary : colors.accent}
      />
      <View style={styles.rowTextWrap}>
        <Text style={[styles.groupTitle, { color: colors.text }]} numberOfLines={1}>
          {section.group.title}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {[
            t('common.transactions', { count: section.data.length }),
            format.money(total, currencySymbol, { maximumFractionDigits: 0 }),
          ].join(' • ')}
        </Text>
      </View>
      {section.suggested && <Text style={[styles.rowSub, { color: colors.accent }]}>{t('review.suggested')}</Text>}
    </TouchableOpacity>
  );
});

const PickRow = memo(function PickRow({
  item,
  checked,
  onToggle,
}: {
  item: Transaction;
  checked: boolean;
  onToggle: (id: number) => void;
}) {
  const { colors } = useTheme();
  const { format } = useI18n();
  const { currencySymbol, currencyDecimals } = useProfile();

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onToggle(item.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Ionicons
        name={checked ? CHECK_ICONS.all : CHECK_ICONS.none}
        size={20}
        color={checked ? colors.accent : colors.textSecondary}
      />
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {item.rawDescription}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{format.day(item.date)}</Text>
      </View>
      <Text style={[styles.rowAmount, { color: colors.text }]}>
        {`${item.amount < 0 ? '-' : '+'}${format.money(Math.abs(item.amount), currencySymbol, currencyDecimals)}`}
      </Text>
    </TouchableOpacity>
  );
});

/** Lists every uncategorised transaction per merchant; the picked ones are added to one category. */
export function QuickCategoriseSheet({ visible, category, onClose, onMoved }: QuickCategoriseSheetProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, categoryName } = useI18n();
  const { activeProfile } = useProfile();
  const { readOnly } = useProfileAccess();
  const profileId = activeProfile?.id ?? 1;

  const [rows, setRows] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<UncategorisedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [remember, setRemember] = useState(true);

  // Each opening starts from a clean sheet.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setSelected(new Set());
      setQuery('');
      setRemember(true);
      setSaving(false);
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!visible || !db) return;
    let cancelled = false;

    Promise.all([getUncategorisedTransactions(db, profileId), getUncategorisedGroups(db, profileId)])
      .then(([transactionRows, groupRows]) => {
        if (cancelled) return;
        setRows(transactionRows);
        setGroups(groupRows);
      })
      .catch((error) => console.error('Failed to load uncategorised transactions:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, db, profileId]);

  const sections = useMemo(() => buildSections(rows, groups, category ?? ''), [rows, groups, category]);
  const shownSections = useMemo(() => filterSections(sections, query), [sections, query]);
  const shownIds = useMemo(() => visibleIds(shownSections), [shownSections]);

  const allShownPicked = selectionState(shownIds, selected) === 'all';
  const ruleKeywords = remember ? ruleKeywordsFor(groups, selected) : [];

  const pickRow = useCallback((id: number) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) => toggleRow(prev, id));
  }, []);

  const pickRows = useCallback((ids: number[]) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) => toggleRows(prev, ids));
  }, []);

  const handleConfirm = async () => {
    if (!db || !category || readOnly || saving || selected.size === 0) return;
    setSaving(true);
    try {
      const moved = await quickCategorise(db, Array.from(selected), ruleKeywords, category, profileId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onMoved(moved);
      onClose();
    } catch (error) {
      console.error('Failed to categorise transactions:', error);
      setSaving(false);
    }
  };

  // Rows are memoised and get plain values, so a tap redraws the rows it changes, not the list.
  const renderSectionHeader = ({ section }: { section: QuickSection<Transaction> }) => (
    <MerchantHeader
      section={section}
      state={selectionState(section.data.map((row) => row.id), selected)}
      onToggle={pickRows}
    />
  );

  const renderItem = ({ item }: { item: Transaction }) => (
    <PickRow item={item} checked={selected.has(item.id)} onToggle={pickRow} />
  );

  const renderBody = () => {
    if (loading) {
      return <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />;
    }
    if (rows.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle" size={40} color={colors.accent} />
          <SelectableText style={[styles.emptyTitle, { color: colors.text }]}>{t('review.doneTitle')}</SelectableText>
          <SelectableText style={[styles.rowSub, { color: colors.textSecondary }]}>{t('review.doneSub')}</SelectableText>
        </View>
      );
    }

    return (
      <>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('list.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.clearSearch')}
            >
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {shownIds.length > 0 && (
          <TouchableOpacity
            style={styles.selectAll}
            activeOpacity={0.7}
            onPress={() => pickRows(shownIds)}
            accessibilityRole="button"
          >
            <Text style={[styles.selectAllText, { color: colors.accent }]}>
              {t(allShownPicked ? 'quickAdd.deselectAll' : 'quickAdd.selectAll')}
            </Text>
          </TouchableOpacity>
        )}

        <SectionList
          style={styles.list}
          sections={shownSections}
          keyExtractor={(item) => item.id.toString()}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={15}
          ListEmptyComponent={
            <SelectableText style={[styles.noMatches, { color: colors.textSecondary }]}>
              {t('list.noMatches', { query })}
            </SelectableText>
          }
        />

        <View style={[styles.rememberRow, { borderTopColor: colors.border }]}>
          <View style={styles.rowTextWrap}>
            <Text style={[styles.rememberTitle, { color: colors.text }]}>{t('quickAdd.remember')}</Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
              {ruleKeywords.length > 0
                ? t('quickAdd.rememberNote', { count: ruleKeywords.length })
                : t('quickAdd.rememberHelp')}
            </Text>
          </View>
          <Switch
            value={remember}
            onValueChange={setRemember}
            trackColor={{ true: colors.accent }}
            accessibilityLabel={t('quickAdd.remember')}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.confirmBtn,
            { backgroundColor: colors.accent },
            (selected.size === 0 || saving) && styles.btnDisabled,
          ]}
          activeOpacity={0.85}
          disabled={selected.size === 0 || saving}
          onPress={handleConfirm}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmText}>
              {selected.size > 0 ? t('quickAdd.confirm', { count: selected.size }) : t('common.add')}
            </Text>
          )}
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={onClose} accessible={false}>
          <View style={styles.backdrop} accessible={false} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.sheet,
            // A fixed height: a list that sizes itself to its rows resizes while scrolling and flickers.
            !loading && rows.length > 0 && styles.sheetFull,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onAccessibilityEscape={onClose}
        >
          <View style={styles.headerRow}>
            <View style={styles.rowTextWrap}>
              <SelectableText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {t('quickAdd.title', { category: category ? categoryName(category) : '' })}
              </SelectableText>
              {!loading && rows.length > 0 && (
                <SelectableText style={[styles.rowSub, { color: colors.textSecondary }]}>
                  {t('transactions.uncategorised', { count: rows.length })}
                </SelectableText>
              )}
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.surface }]}
              onPress={onClose}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          {renderBody()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 34,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  loader: { marginVertical: 48 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 6 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  selectAll: { alignSelf: 'flex-end', paddingVertical: 10 },
  selectAllText: { fontSize: 14, fontWeight: '600' },
  sheetFull: { height: '88%' },
  list: { flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  groupTitle: { fontSize: 15, fontWeight: '700' },
  looseTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 12 },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 13, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '600' },
  noMatches: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rememberTitle: { fontSize: 15, fontWeight: '600' },
  confirmBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  confirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
});
