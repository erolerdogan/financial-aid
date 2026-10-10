import { SelectableText } from '@/components/SelectableText';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { Profile } from '@/db/database';
import { isProfileReadOnly } from '@/utils/entitlement';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ProfileQuickSwitchSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * The sheet behind the avatar in a tab header: pick a profile, nothing else. Adding, renaming and
 * deleting are in the You tab ("Manage profiles").
 */
export function ProfileQuickSwitchSheet({ visible, onClose }: ProfileQuickSwitchSheetProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { profiles, activeProfile, switchProfile, isDemoMode } = useProfile();
  const { isPro } = useEntitlement();
  const insets = useSafeAreaInsets();
  const profileIds = profiles.map((profile) => profile.id);

  const handlePick = async (profile: Profile) => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
    if (profile.id !== activeProfile?.id) await switchProfile(profile);
  };

  const handleManage = () => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
    router.navigate('/you');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} accessible={false} onPress={onClose}>
        <TouchableWithoutFeedback accessible={false}>
          <View
            style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
            onAccessibilityEscape={onClose}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              {t('profile.switch')}
            </SelectableText>

            <ScrollView style={styles.list}>
              {profiles.map((profile) => {
                const active = profile.id === activeProfile?.id;
                // Beyond the free limit: still switchable, shown read-only.
                const readOnly = isProfileReadOnly(isPro, profileIds, profile.id, isDemoMode);
                return (
                  <TouchableOpacity
                    key={profile.id}
                    style={[styles.row, active && { backgroundColor: colors.tintBackground }]}
                    activeOpacity={0.7}
                    onPress={() => handlePick(profile)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.avatar, { backgroundColor: profile.avatarColor || colors.accent }]}>
                      <Text style={styles.avatarText} allowFontScaling={false}>
                        {profile.name.substring(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                        {profile.name}
                      </Text>
                      {readOnly && (
                        <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                          {t('pro.readOnly.title')}
                        </Text>
                      )}
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.manage, { borderTopColor: colors.border }]}
              activeOpacity={0.7}
              onPress={handleManage}
              accessibilityRole="button"
            >
              <Ionicons name="people-outline" size={18} color={colors.accent} />
              <Text style={[styles.manageText, { color: colors.accent }]}>{t('profile.manage')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  list: { maxHeight: 320 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  manage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  manageText: { fontSize: 15, fontWeight: '600' },
});
