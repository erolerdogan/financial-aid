import { SelectableText } from '@/components/SelectableText';
import { CATEGORY_COLOR_PALETTE } from '@/constants/colors';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    addCustomRule,
    CategoryInfo,
    CategoryRule,
    createCategory,
    deleteCategory,
    deleteCustomRule,
    findCategoryByName,
    getCategoryKeywords,
    reclassifyAllUnoverriddenTransactions,
    renameCategory,
    updateCategoryColor
} from '@/db/database';
import { UNCATEGORISED } from '@/utils/parser';
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

interface CategoryFormModalProps {
  visible: boolean;
  category: CategoryInfo | null; // null = create mode
  allCategories: CategoryInfo[];
  onClose: () => void;
  onChanged: () => void;
}

const DEFAULT_REASSIGN = UNCATEGORISED;

export function CategoryFormModal({
  visible,
  category,
  allCategories,
  onClose,
  onChanged,
}: CategoryFormModalProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, categoryName } = useI18n();
  const { activeProfile, refreshProfiles } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLOR_PALETTE[0]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [originalRules, setOriginalRules] = useState<CategoryRule[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reassignTarget, setReassignTarget] = useState('');

  const isCreate = category === null;
  const isBuiltIn = category?.isBuiltIn === 1;

  useEffect(() => {
    if (!visible) return;

    setDeleting(false);
    setSaving(false);
    setKeywordInput('');

    if (category) {
      setName(category.name);
      setColor(category.color);
      setKeywords([]);
      setOriginalRules([]);
      getCategoryKeywords(db, profileId, category.name)
        .then((rules) => {
          setOriginalRules(rules);
          setKeywords(rules.map((r) => r.keyword.toUpperCase()));
        })
        .catch((error) => console.error('Failed to load keywords:', error));
    } else {
      setName('');
      setColor(CATEGORY_COLOR_PALETTE[0]);
      setKeywords([]);
      setOriginalRules([]);
    }
  }, [visible, category, db, profileId]);

  const reassignOptions = allCategories
    .filter((c) => c.id !== category?.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleAddKeyword = () => {
    const keyword = keywordInput.trim().toUpperCase();
    if (!keyword) return;
    if (!keywords.includes(keyword)) {
      Haptics.selectionAsync().catch(() => {});
      setKeywords((prev) => [...prev, keyword]);
    }
    setKeywordInput('');
  };

  const handleRemoveKeyword = (keyword: string) => {
    Haptics.selectionAsync().catch(() => {});
    setKeywords((prev) => prev.filter((k) => k !== keyword));
  };

  const finish = async (addedKeywordCount: number) => {
    await refreshProfiles();
    onChanged();
    onClose();

    if (addedKeywordCount > 0) {
      setTimeout(() => {
        Alert.alert(
          t('categoryForm.applyTitle'),
          t('categoryForm.applyMessage'),
          [
            { text: t('common.notNow'), style: 'cancel' },
            {
              text: t('common.apply'),
              onPress: async () => {
                try {
                  const updated = await reclassifyAllUnoverriddenTransactions(db, profileId);
                  await refreshProfiles();
                  onChanged();
                  Alert.alert(
                    t('common.done'),
                    t('categoryForm.updated', { count: updated })
                  );
                } catch (error) {
                  console.error('Reclassify failed:', error);
                  Alert.alert(t('common.error'), t('categoryForm.updateFailed'));
                }
              },
            },
          ]
        );
      }, 350);
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t('categoryForm.nameRequiredTitle'), t('categoryForm.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      if (isCreate) {
        const existing = await findCategoryByName(db, profileId, trimmed);
        if (existing) {
          Alert.alert(t('categoryForm.existsTitle'), t('categoryForm.exists', { name: categoryName(existing.name) }));
          setSaving(false);
          return;
        }
        await createCategory(db, profileId, trimmed, color, keywords);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await finish(keywords.length);
        return;
      }

      const target = category as CategoryInfo;
      const nameChanged = !isBuiltIn && trimmed !== target.name;

      if (nameChanged) {
        const clash = await findCategoryByName(db, profileId, trimmed, target.id);
        if (clash) {
          setSaving(false);
          Alert.alert(
            t('categoryForm.mergeTitle'),
            t('categoryForm.mergeMessage', { existing: categoryName(clash.name), name: target.name }),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('categoryForm.merge'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    setSaving(true);
                    await deleteCategory(db, profileId, target.id, clash.name);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    await finish(0);
                  } catch (error) {
                    console.error('Merge failed:', error);
                    Alert.alert(t('common.error'), t('categoryForm.mergeFailed'));
                  } finally {
                    setSaving(false);
                  }
                },
              },
            ]
          );
          return;
        }
      }

      const originalKeywords = originalRules.map((r) => r.keyword.toUpperCase());
      const added = keywords.filter((k) => !originalKeywords.includes(k));
      const removed = originalRules.filter((r) => !keywords.includes(r.keyword.toUpperCase()));

      if (nameChanged) await renameCategory(db, profileId, target.id, trimmed);
      if (color !== target.color) await updateCategoryColor(db, profileId, target.id, color);

      const finalName = nameChanged ? trimmed : target.name;
      for (const rule of removed) await deleteCustomRule(db, rule.id);
      for (const keyword of added) await addCustomRule(db, keyword, finalName, profileId);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await finish(added.length);
    } catch (error) {
      console.error('Failed to save category:', error);
      Alert.alert(t('common.error'), t('categoryForm.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleStartDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const fallback =
      reassignOptions.find((c) => c.name === DEFAULT_REASSIGN)?.name ??
      reassignOptions[0]?.name ??
      '';
    setReassignTarget(fallback);
    setDeleting(true);
  };

  const handleConfirmDelete = async () => {
    if (!category || !reassignTarget) return;
    setSaving(true);
    try {
      await deleteCategory(db, profileId, category.id, reassignTarget);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      await finish(0);
    } catch (error) {
      console.error('Failed to delete category:', error);
      Alert.alert(t('common.error'), t('categoryForm.deleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const fieldBg = colors.field;

  const renderDeleteStep = () => (
    <>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDeleting(false)} hitSlop={8}>
          <Text style={[styles.headerAction, { color: colors.accent }]}>{t('common.back')}</Text>
        </TouchableOpacity>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]}>{t('categoryForm.delete')}</SelectableText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SelectableText style={[styles.helperText, { color: colors.textSecondary }]}>
          {t('categoryForm.moveHelp', { count: category?.transactionCount ?? 0, name: category?.name ?? '' })}
        </SelectableText>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {reassignOptions.map((option, index) => {
            const isSelected = option.name === reassignTarget;
            return (
              <React.Fragment key={option.id}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <TouchableOpacity
                  style={styles.reassignRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setReassignTarget(option.name);
                  }}
                >
                  <View style={[styles.dot, { backgroundColor: option.color }]} />
                  <Text style={[styles.reassignText, { color: colors.text }]}>{categoryName(option.name)}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={saving || !reassignTarget}
          style={[styles.deleteBtn, (saving || !reassignTarget) && styles.btnDisabled]}
          onPress={handleConfirmDelete}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.deleteBtnText}>{t('categoryForm.moveDelete')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );

  const renderFormStep = () => (
    <>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text style={[styles.headerAction, { color: colors.accent }]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]}>
          {isCreate ? t('categoryForm.new') : t('categoryForm.edit')}
        </SelectableText>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={8}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={[styles.headerAction, styles.headerActionBold, { color: colors.accent }]}>
              {t('common.save')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('categoryForm.name')}</SelectableText>
        <View style={[styles.inputWrap, { backgroundColor: fieldBg, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: isBuiltIn ? colors.textSecondary : colors.text }]}
            value={isBuiltIn ? categoryName(name) : name}
            onChangeText={setName}
            placeholder={t('categoryForm.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            editable={!isBuiltIn}
            maxLength={30}
            autoCorrect={false}
            returnKeyType="done"
          />
          {isBuiltIn && <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />}
        </View>
        {isBuiltIn && (
          <SelectableText style={[styles.footnote, { color: colors.textSecondary }]}>
            {t('categoryForm.builtInNote')}
          </SelectableText>
        )}

        <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('categoryForm.color')}</SelectableText>
        <View style={styles.swatchGrid}>
          {CATEGORY_COLOR_PALETTE.map((swatch) => {
            const isSelected = swatch === color;
            return (
              <TouchableOpacity
                key={swatch}
                activeOpacity={0.8}
                style={[
                  styles.swatchRing,
                  isSelected && { borderColor: swatch },
                ]}
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

        <SelectableText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {t('categoryForm.keywords')}
        </SelectableText>
        <SelectableText style={[styles.footnote, styles.footnoteTop, { color: colors.textSecondary }]}>
          {t('categoryForm.keywordsHelp')}
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
              style={[styles.input, { color: colors.text }]}
              value={keywordInput}
              onChangeText={setKeywordInput}
              placeholder={t('categoryForm.keywordPlaceholder')}
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
              keywordInput.trim().length === 0 && styles.btnDisabled,
            ]}
          >
            <Text style={styles.addKeywordText}>{t('common.add')}</Text>
          </TouchableOpacity>
        </View>

        {keywords.length > 0 && (
          <View style={styles.chipWrap}>
            {keywords.map((keyword) => (
              <View
                key={keyword}
                style={[styles.chip, { backgroundColor: fieldBg, borderColor: colors.border }]}
              >
                <SelectableText style={[styles.chipText, { color: colors.text }]}>{keyword}</SelectableText>
                <TouchableOpacity onPress={() => handleRemoveKeyword(keyword)} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {!isCreate && !isBuiltIn && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.dangerRow, { backgroundColor: colors.card }]}
            onPress={handleStartDelete}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            <Text style={styles.dangerText}>{t('categoryForm.delete')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
          {deleting ? renderDeleteStep() : renderFormStep()}
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
  headerActionBold: { fontWeight: '700' },
  headerSpacer: { width: 40 },
  content: { padding: 20, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 46,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  footnote: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  footnoteTop: { marginTop: 0, marginBottom: 10 },
  helperText: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
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
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  card: { borderRadius: 14, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  reassignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  reassignText: { flex: 1, fontSize: 16, fontWeight: '500' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  deleteBtn: {
    marginTop: 24,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
});