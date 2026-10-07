import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  categoriseMerchantGroup,
  CategoryInfo,
  getCategoriesWithStats,
  getUncategorisedGroups,
  UncategorisedGroup,
} from '@/db/database';
import { UNCATEGORISED } from '@/utils/parser';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReviewScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, format, categoryName, describe } = useI18n();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const [groups, setGroups] = useState<UncategorisedGroup[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UncategorisedGroup | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      const [groupRows, categoryRows] = await Promise.all([
        getUncategorisedGroups(db, profileId),
        getCategoriesWithStats(db, profileId),
      ]);
      setGroups(groupRows);
      setCategories(categoryRows.filter((c) => c.name !== UNCATEGORISED));
    } catch (error) {
      console.error('Failed to load uncategorised transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [db, profileId]);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  const openPicker = (group: UncategorisedGroup) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected(group);
  };

  const assign = async (group: UncategorisedGroup, category: string) => {
    if (!db) return;
    setSelected(null);
    try {
      await categoriseMerchantGroup(db, group, category, profileId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setGroups((prev) => prev.filter((g) => g.key !== group.key));
    } catch (error) {
      console.error('Failed to categorise merchant:', error);
      load();
    }
  };

  const formatSubtitle = (group: UncategorisedGroup): string =>
    [
      t('common.transactions', { count: group.count }),
      format.money(group.total, currencySymbol, { maximumFractionDigits: 0 }),
      t('review.last', { date: format.day(group.lastDate) }),
    ].join(' • ');

  // The suggested category leads the picker.
  const suggested = selected?.suggestion?.category;
  const pickerCategories = suggested
    ? [...categories].sort((a, b) => Number(b.name === suggested) - Number(a.name === suggested))
    : categories;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View
        style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('transactions.review')}</Text>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: colors.background }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={44} color={colors.accent} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('review.doneTitle')}</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            {t('review.doneSub')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            {t('review.intro')}
          </Text>
          <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
            {groups.map((group, index) => (
              <React.Fragment key={group.key}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <TouchableOpacity
                  style={styles.rowItem}
                  activeOpacity={0.7}
                  onPress={() => openPicker(group)}
                >
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {group.title}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                      {formatSubtitle(group)}
                    </Text>
                    <Text style={[styles.rowRaw, { color: colors.textSecondary }]} numberOfLines={1}>
                      {group.sample}
                    </Text>
                    {group.suggestion && (
                      <View style={styles.suggestionRow}>
                        <TouchableOpacity
                          style={[styles.suggestionBtn, { backgroundColor: colors.background }]}
                          activeOpacity={0.7}
                          onPress={() => assign(group, group.suggestion!.category)}
                          accessibilityRole="button"
                          accessibilityLabel={t('review.categoriseAs', { category: categoryName(group.suggestion.category) })}
                        >
                          <Ionicons name="checkmark" size={14} color={colors.accent} />
                          <Text style={[styles.suggestionText, { color: colors.accent }]} numberOfLines={1}>
                            {categoryName(group.suggestion.category)}
                          </Text>
                        </TouchableOpacity>
                        <Text
                          style={[styles.suggestionReason, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {describe([group.suggestion.reason])}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback onPress={() => setSelected(null)}>
            <View style={styles.sheetBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
              {selected?.title}
            </Text>
            <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>{t('review.choose')}</Text>
            <ScrollView style={styles.sheetList}>
              {pickerCategories.map((category, index) => (
                <React.Fragment key={category.id}>
                  {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  <TouchableOpacity
                    style={styles.sheetRow}
                    activeOpacity={0.7}
                    onPress={() => selected && assign(selected, category.name)}
                  >
                    <View style={[styles.colorDot, { backgroundColor: category.color }]} />
                    <Text style={[styles.rowTitle, styles.sheetRowTitle, { color: colors.text }]} numberOfLines={1}>
                      {categoryName(category.name)}
                    </Text>
                    {category.name === suggested && (
                      <Text style={[styles.rowSub, { color: colors.accent }]}>{t('review.suggested')}</Text>
                    )}
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 14, marginTop: 4 },
  content: { padding: 20, paddingBottom: 48 },
  introText: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  cardGroup: { borderRadius: 14, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowTextWrap: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowRaw: { fontSize: 11, marginTop: 2 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  suggestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  suggestionText: { fontSize: 13, fontWeight: '600', marginLeft: 4, flexShrink: 1 },
  suggestionReason: { fontSize: 12, marginLeft: 8, flexShrink: 1 },
  sheetRowTitle: { flex: 1, marginRight: 8 },
  colorDot: { width: 14, height: 14, borderRadius: 7, marginRight: 14 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    paddingBottom: 34,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20 },
  sheetSub: { fontSize: 13, marginTop: 2, marginBottom: 8, paddingHorizontal: 20 },
  sheetList: { flexGrow: 0 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
});
