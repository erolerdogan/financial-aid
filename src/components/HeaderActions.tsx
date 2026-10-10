import { ProfileQuickSwitchSheet } from '@/components/ProfileQuickSwitchSheet';
import { SelectableText } from '@/components/SelectableText';
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
  /** The screen title, drawn under the row of actions. */
  title: string;
}

/**
 * The header of every tab: the active profile's avatar on the left (opens the quick switcher),
 * transaction search and the "For You" bell on the right, the title below.
 */
export function HeaderActions({ title }: HeaderActionsProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { activeProfile, isDemoMode } = useProfile();
  const { count, hasQuietItems, openInbox, refreshInbox } = useInbox();
  const [profileSheetVisible, setProfileSheetVisible] = useState(false);
  const bellRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      refreshInbox();
    }, [refreshInbox])
  );

  const inboxLabel =
    count > 0 ? t('header.forYouItems', { count }) : hasQuietItems ? t('header.forYouReminder') : t('header.forYou');
  const profileName = activeProfile?.name || t('profile.defaultName');

  return (
    <View style={styles.header}>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.avatar, { backgroundColor: activeProfile?.avatarColor || colors.accent }]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setProfileSheetVisible(true);
          }}
          activeOpacity={0.7}
          // The demo workspace has one profile and nothing to switch to.
          disabled={isDemoMode}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('header.profile', { name: profileName })}
          accessibilityState={{ disabled: isDemoMode }}
        >
          <Text style={styles.avatarText} allowFontScaling={false}>
            {profileName.substring(0, 1).toUpperCase()}
          </Text>
        </TouchableOpacity>

        <View style={styles.group}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push({ pathname: '/transactions', params: { focusSearch: '1' } });
            }}
            hitSlop={4}
            accessibilityLabel={t('header.search')}
            accessibilityRole="button"
          >
            <Ionicons name="search" size={18} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            ref={bellRef}
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              // The panel grows out of the bell, so it needs to know where the bell is.
              if (!bellRef.current) return openInbox();
              bellRef.current.measureInWindow((x, y, width, height) => openInbox({ x, y, width, height }));
            }}
            hitSlop={4}
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
        </View>
      </View>

      <SelectableText
        style={[styles.title, { color: colors.text }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
        accessibilityRole="header"
      >
        {title}
      </SelectableText>

      <ProfileQuickSwitchSheet visible={profileSheetVisible} onClose={() => setProfileSheetVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 8, marginBottom: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 },
  group: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginTop: 10 },
  iconBtn: {
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
