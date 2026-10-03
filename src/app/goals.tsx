import { ScreenContainer } from '@/components/ScreenContainer';
import { getCategoryColor } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CategoryGoalWithProgress,
  getCategoryGoalsWithProgress,
  setCategoryGoal
} from '@/db/database';
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
  const { colors, isDark } = useTheme();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

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
    }, [loadGoals, dataVersion])
  );

  const handleSaveGoal = async () => {
    if (!db || !editingCategory) return;
    const parsed = parseFloat(inputLimit);
    if (!isNaN(parsed) && parsed >= 0) {
      await setCategoryGoal(db, editingCategory, parsed, activeProfileId);
    } else if (inputLimit === '' || parsed === 0) {
      await setCategoryGoal(db, editingCategory, 0, activeProfileId);
    }
    setModalVisible(false);
    setEditingCategory('');
    setInputLimit('');
    loadGoals();
  };

  return (
    <ScreenContainer showDemoBanner={false}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Category Budget Goals</Text>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Manage your monthly spending caps per category. Progress is tracked against current month expenses.
        </Text>

        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 40 }} />
        ) : goals.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No spending categories found for this profile yet.
          </Text>
        ) : (
          goals.map((item) => {
            const catColor = getCategoryColor(item.category);
            const isOver = item.monthlyLimit > 0 && item.spent > item.monthlyLimit;

            return (
              <TouchableOpacity
                key={item.category}
                style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() => {
                  setEditingCategory(item.category);
                  setInputLimit(item.monthlyLimit > 0 ? item.monthlyLimit.toString() : '');
                  setModalVisible(true);
                }}
              >
                <View style={styles.goalCardHeader}>
                  <View style={styles.goalLeft}>
                    <View style={[styles.dot, { backgroundColor: catColor }]} />
                    <Text style={[styles.categoryName, { color: colors.text }]}>{item.category}</Text>
                  </View>
                  <View style={styles.goalRight}>
                    <Text style={[styles.spentText, { color: colors.text }]}>
                      {currencySymbol}{item.spent.toFixed(0)}{' '}
                      <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>
                        / {item.monthlyLimit > 0 ? `${currencySymbol}${item.monthlyLimit.toFixed(0)}` : 'No limit'}
                      </Text>
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                  </View>
                </View>

                {/* Progress bar */}
                {item.monthlyLimit > 0 && (
                  <View style={[styles.progressTrack, { backgroundColor: isDark ? '#38383A' : '#E5E5EA' }]}>
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
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <TouchableWithoutFeedback>
              <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    Budget for {editingCategory}
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.budgetInput,
                    {
                      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="e.g. 400"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={inputLimit}
                  onChangeText={setInputLimit}
                  autoFocus
                />
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { backgroundColor: isDark ? '#38383A' : '#E5E5EA' }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSaveBtn, { backgroundColor: colors.accent }]}
                    onPress={handleSaveGoal}
                  >
                    <Text style={styles.modalSaveText}>Save Goal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
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
  headerTitle: { fontSize: 20, fontWeight: '700' },
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { fontSize: 15, fontWeight: '600' },
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