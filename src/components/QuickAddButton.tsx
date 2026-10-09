import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

interface QuickAddButtonProps {
  /** Uncategorised transactions waiting. */
  count: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Opens the quick add sheet for the category on screen. */
export function QuickAddButton({ count, onPress, style }: QuickAddButtonProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.tintBackground }, style]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
      <Text style={[styles.text, { color: colors.accent }]} numberOfLines={1}>
        {t('quickAdd.button', { count })}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  text: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
