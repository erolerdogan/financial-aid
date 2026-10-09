import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { THEMES, useTheme } from '@/contexts/ThemeContext';
import { usePaywall } from '@/hooks/usePaywall';
import { isThemeLocked } from '@/utils/entitlement';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ThemeSwatchesProps {
  /** Wraps onto several lines instead of scrolling sideways. */
  wrap?: boolean;
  /** A tap on a locked theme shows it without saving it, instead of opening the paywall. */
  previewLocked?: boolean;
}

/** One swatch per theme; a tap applies it at once. A theme outside the free ones opens the paywall. */
export function ThemeSwatches({ wrap = false, previewLocked = false }: ThemeSwatchesProps) {
  const { colors, isDark, themeName, setThemeName, previewThemeName, setPreviewTheme } = useTheme();
  const { t } = useI18n();
  const { isPro } = useEntitlement();
  const { openPaywall } = usePaywall();

  const swatches = THEMES.map((theme) => {
    const selected = theme.name === (previewThemeName ?? themeName);
    const preview = isDark ? theme.dark : theme.light;
    // A Pro theme that is still the saved one stays; it is only locked once another one is picked.
    const locked = theme.name !== themeName && isThemeLocked(isPro, theme.name);
    return (
      <TouchableOpacity
        key={theme.name}
        style={styles.option}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={
          locked
            ? t('pro.gateA11y', { label: t('settings.themeLabel', { name: theme.label }) })
            : t('settings.themeLabel', { name: theme.label })
        }
        accessibilityState={{ selected }}
        onPress={() => {
          if (locked && !previewLocked) {
            openPaywall('themes');
            return;
          }
          Haptics.selectionAsync();
          if (locked) {
            setPreviewTheme(theme.name);
            return;
          }
          setPreviewTheme(null);
          setThemeName(theme.name);
        }}
      >
        <View style={[styles.ring, { borderColor: selected ? colors.accent : 'transparent' }]}>
          <LinearGradient colors={preview.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatch}>
            {selected && !locked && <Ionicons name="checkmark" size={20} color={preview.onGradient} />}
            {locked && <Ionicons name="lock-closed" size={18} color={preview.onGradient} />}
          </LinearGradient>
        </View>
        <Text style={[styles.label, { color: selected ? colors.text : colors.textSecondary }]} numberOfLines={1}>
          {theme.label}
        </Text>
      </TouchableOpacity>
    );
  });

  if (wrap) return <View style={styles.wrap}>{swatches}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {swatches}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 14, paddingVertical: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 16 },
  option: { alignItems: 'center', width: 72 },
  ring: { padding: 3, borderRadius: 30, borderWidth: 2 },
  swatch: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '600', marginTop: 6 },
});
