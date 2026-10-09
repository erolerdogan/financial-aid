import { ReadOnlyNote } from '@/components/pro/ReadOnlySheet';
import { SelectableText } from '@/components/SelectableText';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import type { Household } from '@/constants/benchmarks';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { clearAllRangeOverrides, getAlertSettings, setAlertSetting } from '@/db/database';
import { ALERT_TYPES, enabledAlertTypes, type AlertType } from '@/utils/healthAlerts';
import { requestHealthAlertPermission } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface HealthOptionsProps {
  household: Household | null;
  /** Opens the household sheet, which the Health screen owns. */
  onEditHousehold: () => void;
  /** Called after the accepted ranges were cleared, so the categories reload. */
  onRangesReset: () => void | Promise<void>;
}

/** The content of the options sheet: household, a switch per alert type, reset of accepted ranges. */
export function HealthOptions({ household, onEditHousehold, onRangesReset }: HealthOptionsProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { activeProfile, dataVersion } = useProfile();
  // Shown in a sheet, where the read-only sheet cannot present: the controls are off with a note.
  const { readOnly: profileReadOnly } = useProfileAccess();
  const { can } = useEntitlement();
  const readOnly = profileReadOnly || !can('budgetHealth');
  const profileId = activeProfile?.id ?? 1;

  // Tagged with its profile, so a switch never shows the previous profile's switches.
  const [loaded, setLoaded] = useState<{ profileId: number; enabled: AlertType[] } | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      const settings = await getAlertSettings(db, profileId);
      setLoaded({ profileId, enabled: enabledAlertTypes(settings) });
    } catch (error) {
      console.error('Failed to load alert settings:', error);
    }
  }, [db, profileId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, dataVersion])
  );

  const enabled = loaded?.profileId === profileId ? loaded.enabled : null;

  const handleToggle = async (type: AlertType, value: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setLoaded((prev) =>
      prev ? { ...prev, enabled: value ? [...prev.enabled, type] : prev.enabled.filter((item) => item !== type) } : prev
    );
    try {
      await setAlertSetting(db, profileId, type, value);
      // Permission is only asked here, when a type is turned on.
      if (value && !(await requestHealthAlertPermission())) {
        Alert.alert(t('health.options.notificationsOffTitle'), t('health.options.notificationsOffMessage'));
      }
    } catch (error) {
      console.error('Failed to save alert setting:', error);
      await load();
    }
  };

  const handleResetRanges = () => {
    Alert.alert(t('health.options.resetRanges'), t('health.options.resetRangesMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('health.action.reset'),
        style: 'destructive',
        onPress: async () => {
          try {
            await clearAllRangeOverrides(db, profileId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await onRangesReset();
          } catch (error) {
            console.error('Failed to reset range overrides:', error);
          }
        },
      },
    ]);
  };

  const householdSummary = household
    ? `${t('health.household.adults')} ${household.adults} · ${t('health.household.children')} ${household.children} · ${t(
        household.housingType === 'own' ? 'health.household.own' : 'health.household.rent'
      )}`
    : t('health.options.householdUnset');

  return (
    <View>
      {readOnly && <ReadOnlyNote />}
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={onEditHousehold}
        disabled={readOnly}
        accessibilityRole="button"
      >
        <View style={styles.rowLeft}>
          <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
            <Ionicons name="people-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{t('health.options.household')}</Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{householdSummary}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <SelectableText style={[styles.sectionTitle, { color: colors.text }]}>{t('health.alerts')}</SelectableText>
      <SelectableText style={[styles.hint, { color: colors.textSecondary }]}>{t('health.options.alertsHint')}</SelectableText>

      {ALERT_TYPES.map((type) => (
        <View key={type} style={styles.row}>
          <SelectableText style={[styles.rowTitle, styles.rowText, { color: colors.text }]}>{t(`health.alertType.${type}`)}</SelectableText>
          <Switch
            value={enabled?.includes(type) ?? false}
            disabled={!enabled || readOnly}
            onValueChange={(value) => handleToggle(type, value)}
            trackColor={{ false: '#78788029', true: colors.accent }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#78788029"
            accessibilityLabel={t(`health.alertType.${type}`)}
          />
        </View>
      ))}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={handleResetRanges}
        disabled={readOnly}
        accessibilityRole="button"
      >
        <View style={styles.rowLeft}>
          <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
            <Ionicons name="refresh-outline" size={18} color={colors.accent} />
          </View>
          <Text style={[styles.rowTitle, styles.rowText, { color: colors.text }]}>{t('health.options.resetRanges')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

interface HealthOptionsSheetProps extends HealthOptionsProps {
  visible: boolean;
  onClose: () => void;
}

/** Bottom sheet opened from the ⋯ button at the top of the Health segment. */
export function HealthOptionsSheet({ visible, onClose, ...options }: HealthOptionsSheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} accessible={false} onPress={onClose}>
        <TouchableWithoutFeedback accessible={false}>
          <View
            style={[styles.sheet, { backgroundColor: colors.card }]}
            onAccessibilityEscape={onClose}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <SelectableText style={[styles.sheetTitle, { color: colors.text }]}>{t('freedom.moreOptions')}</SelectableText>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Mounted per opening, so the switches are read fresh. */}
              {visible ? <HealthOptions {...options} /> : null}
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, gap: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowText: { flex: 1 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', paddingTop: 14 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 2, marginBottom: 4 },
  divider: { height: StyleSheet.hairlineWidth },
});
