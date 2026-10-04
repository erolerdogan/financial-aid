import { ProfileSwitcherModal } from '@/components/ProfileSwitcherModal';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HeaderActionsProps {
  children?: React.ReactNode;
}

export function HeaderActions({ children }: HeaderActionsProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeProfile } = useProfile();
  const { importStatement, importing } = useStatementImporter();
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  return (
    <View style={styles.group}>
      <TouchableOpacity
        style={[styles.profilePill, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setProfileModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={[styles.miniAvatar, { backgroundColor: activeProfile?.avatarColor || '#007AFF' }]}>
          <Text style={styles.miniAvatarText}>{activeProfile?.name?.substring(0, 1) || 'P'}</Text>
        </View>
        <Text style={[styles.profilePillText, { color: colors.text }]} numberOfLines={1}>
          {activeProfile?.name || 'Personal'}
        </Text>
        <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={importStatement}
        disabled={importing}
        accessibilityLabel="Import bank statement"
      >
        {importing ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Ionicons name="download-outline" size={18} color={colors.text} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => router.push('/settings')}
        accessibilityLabel="Settings"
      >
        <Ionicons name="settings-outline" size={18} color={colors.text} />
      </TouchableOpacity>

      {children}

      <ProfileSwitcherModal visible={profileModalVisible} onClose={() => setProfileModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    marginLeft: 12,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    flexShrink: 1,
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  profilePillText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  settingsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
});
