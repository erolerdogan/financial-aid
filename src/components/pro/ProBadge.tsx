import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, type ViewStyle } from 'react-native';

interface ProBadgeProps {
  style?: ViewStyle;
  /** A lock in front of the word. Left out, it follows the plan: shown on Free, not with Pro or in the demo. */
  locked?: boolean;
}

/** The "Pro" pill that marks a Pro feature, in the theme's gradient so it stands out on any card. */
export function ProBadge({ style, locked }: ProBadgeProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isPro } = useEntitlement();
  const showLock = locked ?? !isPro;

  return (
    <LinearGradient
      colors={colors.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.badge, { shadowColor: colors.accent }, style]}
    >
      {showLock && <Ionicons name="lock-closed" size={12} color={colors.onGradient} />}
      <Text style={[styles.text, { color: colors.onGradient }]} maxFontSizeMultiplier={1.6}>
        {t('pro.badge')}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 11,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  text: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
});
