import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePaywall } from '@/hooks/usePaywall';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** Shown on top of a screen while the active profile is beyond the free limit. */
export function ReadOnlyBanner() {
  const { readOnly } = useProfileAccess();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { openPaywall } = usePaywall();

  if (!readOnly) return null;

  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: colors.tintBackground, borderBottomColor: colors.border }]}
      activeOpacity={0.8}
      onPress={() => openPaywall('readOnly')}
      accessibilityRole="button"
      accessibilityLabel={`${t('pro.readOnly.banner')}. ${t('pro.renewToEdit')}`}
    >
      <View style={styles.left}>
        <Ionicons name="lock-closed" size={14} color={colors.accent} />
        <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
          {t('pro.readOnly.banner')}
        </Text>
      </View>
      <Text style={[styles.action, { color: colors.accent }]} numberOfLines={1}>
        {t('pro.renewToEdit')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  text: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  action: { fontSize: 13, fontWeight: '700' },
});
