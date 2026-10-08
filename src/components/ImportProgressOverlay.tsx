import { useImportResult } from '@/contexts/ImportResultContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// "Reading statement 12 of 45" while several files are imported. A plain View, not a Modal, so the
// summary sheet and alerts can present afterwards. Rendered by the screens an import starts from.
export function ImportProgressOverlay() {
  const { progress } = useImportResult();
  const { colors } = useTheme();
  const { t } = useI18n();

  if (!progress) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background + 'CC' }]} accessibilityLiveRegion="polite">
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.label, { color: colors.text }]}>
          {t('import.progress', { current: progress.current, total: progress.total })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 15, fontWeight: '600' },
});
