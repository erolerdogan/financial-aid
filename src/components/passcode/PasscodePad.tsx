import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PASSCODE_LENGTH } from '@/utils/passcode';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const KEY_ROWS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
] as const;

const ERROR_COLOR = '#FF3B30';

interface PasscodePadProps {
  title: string;
  message?: string | null;
  messageIsError?: boolean;
  code: string;
  onChangeCode: (code: string) => void;
  disabled?: boolean;
}

/** Title, the dots for the digits entered so far and a number pad. The parent owns the digits. */
export function PasscodePad({ title, message, messageIsError, code, onChangeCode, disabled }: PasscodePadProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();

  const pressDigit = (digit: number) => {
    if (code.length >= PASSCODE_LENGTH) return;
    Haptics.selectionAsync();
    onChangeCode(code + String(digit));
  };

  const pressDelete = () => {
    if (code.length === 0) return;
    Haptics.selectionAsync();
    onChangeCode(code.slice(0, -1));
  };

  const renderDigit = (digit: number) => (
    <TouchableOpacity
      key={digit}
      style={[styles.key, { backgroundColor: colors.surface }]}
      activeOpacity={0.6}
      disabled={disabled}
      accessibilityRole="button"
      onPress={() => pressDigit(digit)}
    >
      <Text style={[styles.keyText, { color: colors.text }]}>{format.number(digit)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
        <Ionicons name="lock-closed" size={24} color={colors.accent} />
      </View>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>

      <View
        style={styles.dots}
        accessible
        accessibilityLabel={t('passcode.progress', { entered: code.length, total: PASSCODE_LENGTH })}
      >
        {Array.from({ length: PASSCODE_LENGTH }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { borderColor: colors.accent },
              index < code.length && { backgroundColor: colors.accent },
            ]}
          />
        ))}
      </View>

      <Text
        style={[styles.message, { color: messageIsError ? ERROR_COLOR : colors.textSecondary }]}
        accessibilityLiveRegion="polite"
      >
        {message ?? ''}
      </Text>

      <View style={[styles.keys, disabled && styles.keysDisabled]}>
        {KEY_ROWS.map((row) => (
          <View key={row[0]} style={styles.keyRow}>
            {row.map(renderDigit)}
          </View>
        ))}
        <View style={styles.keyRow}>
          <View style={styles.key} />
          {renderDigit(0)}
          <TouchableOpacity
            style={styles.key}
            activeOpacity={0.6}
            disabled={disabled || code.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
            onPress={pressDelete}
          >
            <Ionicons name="backspace-outline" size={28} color={code.length === 0 ? colors.textSecondary : colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 24 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 16, marginTop: 24 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  message: { fontSize: 13, lineHeight: 18, textAlign: 'center', minHeight: 54, marginTop: 16, maxWidth: 320 },
  keys: { gap: 14, marginTop: 8 },
  keysDisabled: { opacity: 0.4 },
  keyRow: { flexDirection: 'row', gap: 24 },
  key: { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center' },
  keyText: { fontSize: 30, fontWeight: '500' },
});
