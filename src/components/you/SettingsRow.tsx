import { SelectableText } from '@/components/SelectableText';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// The system red the app uses for destructive actions in both modes.
const DANGER = '#FF3B30';

interface SettingsSectionProps {
  title: string;
  /** Shown under the card, e.g. why its rows are disabled. */
  note?: string;
  children: React.ReactNode;
}

/** A titled card of rows in the You tab; a hairline is drawn between the rows that render. */
export function SettingsSection({ title, note, children }: SettingsSectionProps) {
  const { colors } = useTheme();
  const rows = React.Children.toArray(children);
  if (rows.length === 0) return null;

  return (
    <>
      <SelectableText style={[styles.sectionHeader, { color: colors.textSecondary }]} accessibilityRole="header">
        {title}
      </SelectableText>
      <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            {row}
          </React.Fragment>
        ))}
      </View>
      {note ? <SelectableText style={[styles.sectionNote, { color: colors.textSecondary }]}>{note}</SelectableText> : null}
    </>
  );
}

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
  /** Short text on the right, before the chevron. */
  value?: string;
  /** Without it the row is plain text and not tappable. */
  onPress?: () => void;
  disabled?: boolean;
  /** A destructive action. */
  danger?: boolean;
  busy?: boolean;
  /** Opens something outside the app. */
  external?: boolean;
  /** Replaces the icon circle, e.g. a profile avatar. */
  leading?: React.ReactNode;
  /** Replaces the chevron, e.g. a switch. */
  right?: React.ReactNode;
}

export function SettingsRow({
  icon,
  title,
  sub,
  value,
  onPress,
  disabled = false,
  danger = false,
  busy = false,
  external = false,
  leading,
  right,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const tint = danger ? DANGER : colors.accent;

  const content = (
    <>
      <View style={styles.rowLeft}>
        {leading ?? (
          <View style={[styles.iconCircle, { backgroundColor: danger ? `${DANGER}20` : colors.tintBackground }]}>
            <Ionicons name={icon} size={18} color={tint} />
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: danger ? DANGER : colors.text }]}>{title}</Text>
          {sub ? <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{sub}</Text> : null}
        </View>
      </View>
      {right ?? (
        <View style={styles.rowRight}>
          {value ? (
            <Text style={[styles.rowValue, { color: onPress ? colors.accent : colors.textSecondary }]} selectable={!onPress}>
              {value}
            </Text>
          ) : null}
          {busy ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : onPress ? (
            <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={16} color={colors.textSecondary} />
          ) : null}
        </View>
      )}
    </>
  );

  if (!onPress) return <View style={[styles.rowItem, disabled && styles.rowDisabled]}>{content}</View>;

  return (
    <TouchableOpacity
      style={[styles.rowItem, disabled && styles.rowDisabled]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityState={{ disabled: disabled || busy }}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  sectionNote: { fontSize: 12, lineHeight: 16, marginTop: 8, marginHorizontal: 4 },
  cardGroup: {
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 62,
  },
  rowDisabled: { opacity: 0.4 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
  rowText: { flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: '45%' },
  iconCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 11, marginTop: 1 },
  rowValue: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  divider: { height: StyleSheet.hairlineWidth },
});
