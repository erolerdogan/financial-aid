import { CategoryFormModal } from '@/components/modals/CategoryFormModal';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { CategoryInfo, getCategoriesWithStats } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, format, categoryName } = useI18n();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<CategoryInfo | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      const rows = await getCategoriesWithStats(db, profileId);
      setCategories(rows);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }, [db, profileId]);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  const customCategories = categories.filter((c) => c.isBuiltIn === 0);
  const builtInCategories = categories.filter((c) => c.isBuiltIn === 1);

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditing(null);
    setFormVisible(true);
  };

  const openEdit = (category: CategoryInfo) => {
    Haptics.selectionAsync().catch(() => {});
    setEditing(category);
    setFormVisible(true);
  };

  const formatSubtitle = (category: CategoryInfo): string => {
    const parts: string[] = [];
    if (category.transactionCount > 0) {
      parts.push(t('common.transactions', { count: category.transactionCount }));
      if (category.totalSpent > 0) {
        parts.push(
          t('categories.spent', {
            amount: format.money(category.totalSpent, currencySymbol, { maximumFractionDigits: 0 }),
          })
        );
      }
    } else {
      parts.push(t('categories.noTransactions'));
    }
    if (category.monthlyLimit > 0) {
      parts.push(t('categories.goal', { amount: format.money(category.monthlyLimit, currencySymbol) }));
    }
    return parts.join(' • ');
  };

  const renderGroup = (title: string, items: CategoryInfo[]) => {
    if (items.length === 0) return null;
    return (
      <>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {items.map((category, index) => (
            <React.Fragment key={category.id}>
              {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <TouchableOpacity
                style={styles.rowItem}
                activeOpacity={0.7}
                onPress={() => openEdit(category)}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.colorDot, { backgroundColor: category.color }]} />
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {categoryName(category.name)}
                    </Text>
                    <Text
                      style={[styles.rowSub, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {formatSubtitle(category)}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View
        style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.categories')}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.accent }]}
            onPress={openCreate}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.background }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            {t('categories.intro')}
          </Text>
          {renderGroup(t('categories.yours'), customCategories)}
          {renderGroup(t('categories.builtIn'), builtInCategories)}
        </ScrollView>
      )}

      <CategoryFormModal
        visible={formVisible}
        category={editing}
        allCategories={categories}
        onClose={() => setFormVisible(false)}
        onChanged={load}
      />
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 48 },
  introText: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardGroup: { borderRadius: 14, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 46 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  colorDot: { width: 14, height: 14, borderRadius: 7, marginRight: 14 },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
});