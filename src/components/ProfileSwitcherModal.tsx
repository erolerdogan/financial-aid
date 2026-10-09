import { ProBadge } from '@/components/pro/ProBadge';
import { ProfileSetup } from '@/components/profile/ProfileSetup';
import { SelectableText } from '@/components/SelectableText';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { CURRENCY_SYMBOLS, useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { deleteProfile, Profile, saveHousehold } from '@/db/database';
import { usePaywall } from '@/hooks/usePaywall';
import { canAdd, isProfileReadOnly } from '@/utils/entitlement';
import { AVATAR_COLORS, buildHousehold, defaultCurrency, type SetupAnswers } from '@/utils/profileSetup';
import { Ionicons } from '@expo/vector-icons';
import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
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
  TouchableWithoutFeedback,
  View
} from 'react-native';

interface ProfileSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileSwitcherModal({ visible, onClose }: ProfileSwitcherModalProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { profiles, activeProfile, switchProfile, addNewProfile, editProfile, refreshProfiles, isDemoMode } = useProfile();
  const { isPro } = useEntitlement();
  const { openPaywall } = usePaywall();
  const deviceLocales = useLocales();
  const profileIds = profiles.map((profile) => profile.id);
  const canAddProfile = canAdd(isPro, 'maxProfiles', profiles.length);

  const handleAddNew = () => {
    if (!canAddProfile) {
      // The paywall is a screen: it can only present once this sheet has closed.
      onClose();
      setTimeout(() => openPaywall('profiles'), 300);
      return;
    }
    resetForm();
    setIsEditing(true);
  };

  const [isEditing, setIsEditing] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<Profile | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);

  const handleSave = async () => {
    if (!nameInput.trim()) return;

    if (selectedForEdit) {
      await editProfile(selectedForEdit.id, nameInput, selectedColor);
      resetForm();
    }
  };

  // A new profile answers the questionnaire; its household row is saved with it.
  const handleSetupDone = async (answers: SetupAnswers) => {
    const newProf = await addNewProfile(answers.name, answers.color, answers.currency);
    if (newProf) {
      try {
        await saveHousehold(db, newProf.id, buildHousehold(answers));
      } catch (error) {
        console.error('Failed to save the household:', error);
      }
      await switchProfile(newProf);
    }
    resetForm();
    onClose();
    if (newProf) {
      if (router.canDismiss()) router.dismissAll();
      router.navigate('/(tabs)');
    }
  };

  const handleDelete = (profile: Profile) => {
    if (profiles.length <= 1) {
      Alert.alert(t('profile.cannotDeleteTitle'), t('profile.cannotDeleteMessage'));
      return;
    }
    Alert.alert(
      t('profile.deleteTitle'),
      t('profile.deleteMessage', { name: profile.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteProfile(db, profile.id);
            await refreshProfiles();
            if (activeProfile?.id === profile.id) {
              const remaining = profiles.filter((p) => p.id !== profile.id);
              if (remaining.length > 0) await switchProfile(remaining[0]);
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setIsEditing(false);
    setSelectedForEdit(null);
    setNameInput('');
    setSelectedColor(AVATAR_COLORS[0]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={{ flex: 1, justifyContent: 'flex-end' }} activeOpacity={1} accessible={false} onPress={onClose}>
          <TouchableWithoutFeedback accessible={false}>
            <View
              style={[styles.sheet, { backgroundColor: colors.card }]}
              onAccessibilityEscape={onClose}
            >
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              
              {isEditing && !selectedForEdit ? (
                <ProfileSetup
                  nameRequired
                  initialName=""
                  initialColor={AVATAR_COLORS[0]}
                  initialCurrency={defaultCurrency(deviceLocales[0]?.currencyCode, Object.keys(CURRENCY_SYMBOLS))}
                  submitLabel={t('profile.save')}
                  onSubmit={handleSetupDone}
                  onCancel={resetForm}
                />
              ) : (
              <>
              <View style={styles.headerRow}>
                <SelectableText style={[styles.title, { color: colors.text }]}>
                  {isEditing ? t('profile.edit') : t('profile.switch')}
                </SelectableText>
                {!isEditing && (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={handleAddNew}
                    accessibilityRole="button"
                    accessibilityLabel={
                      canAddProfile ? t('profile.addNew') : t('pro.gateA11y', { label: t('profile.addNew') })
                    }
                  >
                    <Text style={[styles.addText, { color: colors.accent }]}>{t('profile.addNew')}</Text>
                    {!canAddProfile && <ProBadge locked />}
                  </TouchableOpacity>
                )}
              </View>

              {isEditing ? (
                <View style={styles.formContainer}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder={t('profile.namePlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={nameInput}
                    onChangeText={setNameInput}
                    autoFocus
                  />
                  <SelectableText style={[styles.colorLabel, { color: colors.textSecondary }]}>{t('profile.avatarColor')}</SelectableText>
                  <View style={styles.colorRow}>
                    {AVATAR_COLORS.map((col, index) => (
                      <TouchableOpacity
                        key={col}
                        style={[styles.colorCircle, { backgroundColor: col }, selectedColor === col && styles.selectedColor]}
                        onPress={() => setSelectedColor(col)}
                        accessibilityRole="button"
                        accessibilityLabel={t('a11y.colorOption', { number: index + 1, total: AVATAR_COLORS.length })}
                        accessibilityState={{ selected: selectedColor === col }}
                      />
                    ))}
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.cancelBtn, { borderColor: colors.border }]}
                      onPress={resetForm}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.cancelBtnText, { color: colors.text }]}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                      onPress={handleSave}
                      accessibilityRole="button"
                    >
                      <Text style={styles.saveBtnText}>{t('profile.save')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  {profiles.map((p) => {
                    const isActive = activeProfile?.id === p.id;
                    // Beyond the free limit: still switchable and deletable, not editable.
                    const locked = isProfileReadOnly(isPro, profileIds, p.id, isDemoMode);
                    return (
                      <View
                        key={p.id}
                        style={[styles.profileItem, { borderBottomColor: colors.border }, isActive && { backgroundColor: colors.tintBackground }]}
                      >
                        <TouchableOpacity
                          style={styles.profileInfoArea}
                          onPress={async () => {
                            await switchProfile(p);
                            onClose();
                          }}
                          accessibilityRole="button"
                        >
                          <View style={[styles.avatar, { backgroundColor: p.avatarColor }]}>
                            <Text style={styles.avatarTxt}>{p.name.substring(0, 1)}</Text>
                          </View>
                          <View style={styles.profileNameWrap}>
                            <Text style={[styles.profileName, { color: colors.text }]}>{p.name}</Text>
                            {locked && (
                              <Text style={[styles.profileLocked, { color: colors.textSecondary }]}>
                                {t('pro.readOnly.title')} · {t('pro.renewToEdit')}
                              </Text>
                            )}
                          </View>
                          {isActive && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                        </TouchableOpacity>

                        <View style={styles.profileActions}>
                          {locked ? (
                            <View style={styles.iconBtn}>
                              <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
                            </View>
                          ) : (
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedForEdit(p);
                              setNameInput(p.name);
                              setSelectedColor(p.avatarColor);
                              setIsEditing(true);
                            }}
                            style={styles.iconBtn}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={t('a11y.edit', { name: p.name })}
                          >
                            <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                          </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => handleDelete(p)}
                            style={styles.iconBtn}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={t('a11y.delete', { name: p.name })}
                          >
                            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
              </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addText: { fontSize: 14, fontWeight: '600' },
  formContainer: { gap: 14 },
  input: { height: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontWeight: '600' },
  colorLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  colorCircle: { width: 32, height: 32, borderRadius: 16 },
  selectedColor: { borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 3 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  profileItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, borderRadius: 12 },
  profileInfoArea: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  profileNameWrap: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '600' },
  profileLocked: { fontSize: 11, marginTop: 1 },
  profileActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6 },
});