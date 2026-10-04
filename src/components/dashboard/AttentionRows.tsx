import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface AttentionItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  action: string;
  onPress: () => void;
}

interface AttentionRowsProps {
  items: AttentionItem[];
}

export function AttentionRows({ items }: AttentionRowsProps) {
  const { colors } = useTheme();

  if (items.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {items.map((item, index) => (
        <TouchableOpacity
          key={item.key}
          style={[
            styles.row,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
          ]}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            item.onPress();
          }}
        >
          <Ionicons name={item.icon} size={18} color={colors.accent} />
          <Text style={[styles.text, { color: colors.text }]} numberOfLines={2}>
            {item.text}
          </Text>
          <Text style={[styles.action, { color: colors.accent }]}>{item.action}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: { flex: 1, fontSize: 14, fontWeight: '600' },
  action: { fontSize: 14, fontWeight: '600' },
});
