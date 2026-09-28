import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { deleteProfile, Profile } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
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

const AVATAR_COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5856D6'];

interface ProfileSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileSwitcherModal({ visible, onClose }: ProfileSwitcherModalProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { profiles, activeProfile, switchProfile, addNewProfile, editProfile, refreshProfiles } = useProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<Profile | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);

  const handleSave = async () => {
    if (!nameInput.trim()) return;
    if (selectedForEdit) {
      await editProfile(selectedForEdit.id, nameInput, selectedColor);
      resetForm();
    } else {
      const newProf = await addNewProfile(nameInput, selectedColor);
      resetForm();
      if (newProf) {
        switchProfile(newProf);
      }
      onClose();
    }
    await refreshProfiles();
  };

  const handleDelete = (profile: Profile) => {
    if (profiles.length <= 1) {
      Alert.alert('Cannot Delete', 'You must keep at least one profile.');
      return;
    }
    Alert.alert(
      'Delete Profile',
      `Are you sure you want to delete "${profile.name}" and all its associated data?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProfile(db, profile.id);
            await refreshProfiles();
            if (activeProfile?.id === profile.id) {
              const remaining = profiles.filter((p) => p.id !== profile.id);
              if (remaining.length > 0) switchProfile(remaining[0]);
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
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={{ flex: 1, justifyContent: 'flex-end' }} activeOpacity={1} onPress={onClose}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: colors.card }]}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {isEditing ? (selectedForEdit ? 'Edit Profile' : 'New Profile') : 'Switch Profile'}
                </Text>
                {!isEditing && (
                  <TouchableOpacity
                    onPress={() => {
                      resetForm();
                      setIsEditing(true);
                    }}
                  >
                    <Text style={[styles.addText, { color: colors.accent }]}>+ Add New</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isEditing ? (
                <View style={styles.formContainer}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="Profile Name"
                    placeholderTextColor={colors.textSecondary}
                    value={nameInput}
                    onChangeText={setNameInput}
                    autoFocus
                  />
                  <Text style={[styles.colorLabel, { color: colors.textSecondary }]}>Choose Avatar Color</Text>
                  <View style={styles.colorRow}>
                    {AVATAR_COLORS.map((col) => (
                      <TouchableOpacity
                        key={col}
                        style={[styles.colorCircle, { backgroundColor: col }, selectedColor === col && styles.selectedColor]}
                        onPress={() => setSelectedColor(col)}
                      />
                    ))}
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.cancelBtn, { borderColor: colors.border }]}
                      onPress={resetForm}
                    >
                      <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                      onPress={handleSave}
                    >
                      <Text style={styles.saveBtnText}>Save Profile</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  {profiles.map((p) => {
                    const isActive = activeProfile?.id === p.id;
                    return (
                      <View
                        key={p.id}
                        style={[styles.profileItem, { borderBottomColor: colors.border }, isActive && { backgroundColor: colors.tintBackground }]}
                      >
                        <TouchableOpacity
                          style={styles.profileInfoArea}
                          onPress={() => {
                            switchProfile(p);
                            onClose();
                          }}
                        >
                          <View style={[styles.avatar, { backgroundColor: p.avatarColor }]}>
                            <Text style={styles.avatarTxt}>{p.name.substring(0, 1)}</Text>
                          </View>
                          <Text style={[styles.profileName, { color: colors.text }]}>{p.name}</Text>
                          {isActive && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                        </TouchableOpacity>

                        <View style={styles.profileActions}>
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedForEdit(p);
                              setNameInput(p.name);
                              setSelectedColor(p.avatarColor);
                              setIsEditing(true);
                            }}
                            style={styles.iconBtn}
                          >
                            <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDelete(p)}
                            style={styles.iconBtn}
                          >
                            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
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
  profileName: { fontSize: 15, fontWeight: '600', flex: 1 },
  profileActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6 },
});