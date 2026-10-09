import { ReadOnlySheetHost } from '@/components/pro/ReadOnlySheet';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SelectableText } from '@/components/SelectableText';
import { getCategoryColor } from '@/constants/colors';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CategoryGoalWithProgress,
  getCategoryGoalsWithProgress,
  setCategoryGoal
} from '@/db/database';
import { useBudgetGate } from '@/hooks/useBudgetGate';
import { parseNumber } from '@/utils/debt';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useProfile } from '../contexts/ProfileContext';

export default function GoalsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format, categoryName } = useI18n();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;
  const { isReadOnly, guardBudget, reload: reloadBudgetGate } = useBudgetGate();

  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<CategoryGoalWithProgress[]>([]);
  
  // Modal state for editing a specific category goal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string>('');
  const [inputLimit, setInputLimit] = useState<string>('');

  const loadGoals = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const data = await getCategoryGoalsWithProgress(db, currentMonthKey, activeProfileId);
      setGoals(data);
    } catch (err) {
      console.error('Failed to load category goals:', err);
    } finally {
      setLoading(false);
    }
  }, [db, activeProfileId]);

  useFocusEffect(
    useCallback(() => {
      loadGoals();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion is listed on purpose: reload when stored data changes
    }, [loadGoals, dataVersion])
  );

  const handleSaveGoal = async () => {
    if (!db || !editingCategory) return;
    const parsed = parseNumber(inputLimit);
    if (!isNaN(parsed) && parsed >= 0) {
      await setCategoryGoal(db, editingCategory, parsed, activeProfileId);
    } else if (inputLimit === '' || parsed === 0) {
      await setCategoryGoal(db, editingCategory, 0, activeProfileId);
    }
    setModalVisible(false);
    setEditingCategory('');
    setInputLimit('');
    loadGoals();
    reloadBudgetGate();
  };

  // Removing is never gated, also not for a budget beyond the free limit.
  const handleRemoveGoal = async (category: string) => {
    if (!db) return;
    await setCategoryGoal(db, category, 0, activeProfileId);
    loadGoals();
    reloadBudgetGate();
  };

  return (
    <ScreenContainer showDemoBanner={false}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]} maxFontSizeMultiplier={1.4}>{t('settings.budgets')}</SelectableText>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SelectableText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {t('budgets.subtitle')}
        </SelectableText>

        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 40 }} />
        ) : goals.length === 0 ? (
          <SelectableText style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('budgets.empty')}
          </SelectableText>
        ) : (
          goals.map((item) => {
            const catColor = getCategoryColor(item.category);
            const isOver = item.monthlyLimit > 0 && item.spent > item.monthlyLimit;
            const locked = isReadOnly(item.category);

            return (
              <TouchableOpacity
                key={item.category}
                style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() =>
                  guardBudget(
                    item.category,
                    () => {
                      setEditingCategory(item.category);
                      setInputLimit(item.monthlyLimit > 0 ? item.monthlyLimit.toString() : '');
                      setModalVisible(true);
                    },
                    () => handleRemoveGoal(item.category)
                  )
                }
                accessibilityRole="button"
              >
                <View style={styles.goalCardHeader}>
                  <View style={styles.goalLeft}>
                    <View style={[styles.dot, { backgroundColor: catColor }]} />
                    <View style={styles.categoryNameWrap}>
                      <Text style={[styles.categoryName, { color: colors.text }]}>{categoryName(item.category)}</Text>
                      {locked && (
                        <Text style={[styles.lockedNote, { color: colors.textSecondary }]}>{t('pro.renewToEdit')}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.goalRight}>
                    <Text style={[styles.spentText, { color: colors.text }]}>
                      {format.money(item.spent, currencySymbol)}{' '}
                      <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>
                        / {item.monthlyLimit > 0 ? format.money(item.monthlyLimit, currencySymbol) : t('budgets.noLimit')}
                      </Text>
                    </Text>
                    <Ionicons name={locked ? 'lock-closed' : 'chevron-forward'} size={14} color={colors.textSecondary} />
                  </View>
                </View>

                {/* Progress bar */}
                {item.monthlyLimit > 0 && (
                  <View style={[styles.progressTrack, { backgroundColor: colors.track }]}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${Math.min(100, item.percentage)}%`,
                          backgroundColor: isOver ? '#FF3B30' : catColor,
                        },
                      ]}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Edit Goal Modal with KeyboardAvoidingView */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'flex-end' }}
            activeOpacity={1}
            accessible={false}
            onPress={() => setModalVisible(false)}
          >
            <TouchableWithoutFeedback accessible={false}>
              <View
                style={[styles.sheetContainer, { backgroundColor: colors.card }]}
                onAccessibilityEscape={() => setModalVisible(false)}
              >
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                  <SelectableText style={[styles.sheetTitle, { color: colors.text }]}>
                    {t('budgets.budgetFor', { category: editingCategory ? categoryName(editingCategory) : '' })}
                  </SelectableText>
                </View>
                <TextInput
                  style={[
                    styles.budgetInput,
                    {
                      backgroundColor: colors.surface,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder={t('budgets.placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={inputLimit}
                  onChangeText={setInputLimit}
                  autoFocus
                />
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { backgroundColor: colors.track }]}
                    onPress={() => setModalVisible(false)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.modalCancelText, { color: colors.text }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSaveBtn, { backgroundColor: colors.accent }]}
                    onPress={handleSaveGoal}
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalSaveText}>{t('budgets.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
      <ReadOnlySheetHost />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  sectionSubtitle: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  emptyText: { textAlign: 'center', fontStyle: 'italic', marginTop: 40 },
  goalCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  goalCardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexGrow: 1, flexShrink: 1, minWidth: '45%' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  categoryNameWrap: { flexShrink: 1 },
  categoryName: { fontSize: 15, fontWeight: '600' },
  lockedNote: { fontSize: 11, marginTop: 1 },
  goalRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spentText: { fontSize: 14, fontWeight: '700' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  sheetHeader: { alignItems: 'center', marginBottom: 16 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  budgetInput: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  modalActionRow: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600' },
  modalSaveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});