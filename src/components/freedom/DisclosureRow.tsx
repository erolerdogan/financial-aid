import { ProBadge } from '@/components/pro/ProBadge';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface DisclosureRowProps {
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  /** A Pro section without Pro: shown with a badge, and `onToggle` opens the paywall instead. */
  locked?: boolean;
  /** A Pro section that is open without Pro (the demo workspace): the badge next to the chevron. */
  pro?: boolean;
}

/** A card-shaped row that shows or hides the cards rendered after it. */
export function DisclosureRow({ title, subtitle, expanded, onToggle, locked = false, pro = false }: DisclosureRowProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    onToggle();
  };

  return (
    <Pressable
      onPress={toggle}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={locked ? t('pro.gateA11y', { label: title }) : `${title}. ${subtitle}`}
      accessibilityState={locked ? undefined : { expanded }}
    >
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {locked ? (
        <ProBadge locked style={styles.badge} />
      ) : (
        <>
          {pro && <ProBadge style={styles.badge} />}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1 },
  badge: { alignSelf: 'center' },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 2 },
});
