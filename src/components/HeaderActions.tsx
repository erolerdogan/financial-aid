import { ProfileSwitcherModal } from '@/components/ProfileSwitcherModal';
import { useInbox } from '@/contexts/InboxContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HeaderActionsProps {
  children?: React.ReactNode;
  /** Transaction search; off on the Plan tab, which is not about transactions. */
  showSearch?: boolean;
}

export function HeaderActions({ children, showSearch = true }: HeaderActionsProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { activeProfile, isDemoMode } = useProfile();
  const { count, hasQuietItems, openInbox, refreshInbox } = useInbox();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const bellRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      refreshInbox();
    }, [refreshInbox])
  );

  const inboxLabel =
    count > 0 ? t('header.forYouItems', { count }) : hasQuietItems ? t('header.forYouReminder') : t('header.forYou');

  return (
    <View style={styles.group}>
      <TouchableOpacity
        style={[styles.profilePill, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setProfileModalVisible(true)}
        activeOpacity={0.7}
        disabled={isDemoMode}
        accessibilityRole="button"
      >
        <View style={[styles.miniAvatar, { backgroundColor: activeProfile?.avatarColor || '#007AFF' }]}>
          <Text style={styles.miniAvatarText} allowFontScaling={false}>{activeProfile?.name?.substring(0, 1) || 'P'}</Text>
        </View>
        <Text style={[styles.profilePillText, { color: colors.text }]} numberOfLines={1}>
          {activeProfile?.name || t('profile.defaultName')}
        </Text>
        {!isDemoMode && <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />}
      </TouchableOpacity>

      {showSearch && (
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push({ pathname: '/transactions', params: { focusSearch: '1' } });
          }}
          accessibilityLabel={t('header.search')}
          accessibilityRole="button"
        >
          <Ionicons name="search" size={18} color={colors.text} />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        ref={bellRef}
        style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          // The panel grows out of the bell, so it needs to know where the bell is.
          if (!bellRef.current) return openInbox();
          bellRef.current.measureInWindow((x, y, width, height) => openInbox({ x, y, width, height }));
        }}
        accessibilityLabel={inboxLabel}
        accessibilityRole="button"
      >
        <Ionicons name="notifications-outline" size={18} color={colors.text} />
        {count > 0 ? (
          <View style={[styles.badge, { borderColor: colors.background }]}>
            <Text style={styles.badgeText} allowFontScaling={false}>{count > 9 ? '9+' : count}</Text>
          </View>
        ) : hasQuietItems ? (
          <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.background }]} />
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => router.push('/settings')}
        accessibilityLabel={t('header.settings')}
        accessibilityRole="button"
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
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  dot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
  },
});
