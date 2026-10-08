import { SelectableText } from '@/components/SelectableText';
import { useInbox } from '@/contexts/InboxContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { muteAlertKey, setAlertStatus, type StoredHealthAlert } from '@/db/database';
import { loadNewAlerts } from '@/services/healthService';
import { alertText } from '@/utils/healthAlertText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const severityIcon = (severity: number): IconName => {
  if (severity >= 3) return 'alert-circle-outline';
  if (severity === 2) return 'information-circle-outline';
  return 'happy-outline';
};

/**
 * Up to three alerts from the last import, each answered with "Got it" or "Don't alert me about this".
 * The same alerts are rows in the For You inbox; answering one in either place removes it from both.
 */
export function AlertsStrip() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const { items, refreshInbox } = useInbox();
  // Changes when an alert is dismissed from the inbox while this screen stays in front.
  const inboxAlerts = items
    .filter((item) => item.kind === 'HEALTH_ALERT')
    .map((item) => item.key)
    .join(',');

  const [loaded, setLoaded] = useState<{ profileId: number; alerts: StoredHealthAlert[] } | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      const alerts = await loadNewAlerts(db, profileId);
      setLoaded({ profileId, alerts });
    } catch (error) {
      console.error('Failed to load health alerts:', error);
    }
  }, [db, profileId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, dataVersion, inboxAlerts])
  );

  const alerts = loaded?.profileId === profileId ? loaded.alerts : [];
  if (alerts.length === 0) return null;

  const handleGotIt = async (alert: StoredHealthAlert) => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await setAlertStatus(db, profileId, alert.id, 'seen');
      await load();
      refreshInbox(true);
    } catch (error) {
      console.error('Failed to mark alert as seen:', error);
    }
  };

  const handleMute = async (alert: StoredHealthAlert) => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await muteAlertKey(db, profileId, alert.type, alert.key);
      await load();
      refreshInbox(true);
    } catch (error) {
      console.error('Failed to mute alert:', error);
    }
  };

  return (
    <View style={styles.container} accessibilityLabel={t('health.alerts')}>
      {alerts.map((alert) => {
        const good = alert.severity <= 1;
        const tint = good ? '#34C759' : alert.severity >= 3 ? '#FF9500' : colors.accent;
        return (
          <View
            key={alert.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.messageRow}>
              <Ionicons name={severityIcon(alert.severity)} size={20} color={tint} />
              <View style={styles.messageBody}>
                <SelectableText style={[styles.type, { color: colors.textSecondary }]}>
                  {t(`health.alertType.${alert.type}`)}
                </SelectableText>
                <SelectableText style={[styles.message, { color: colors.text }]}>
                  {alertText(alert.message, t, format, currencySymbol)}
                </SelectableText>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.muteBtn}
                onPress={() => handleMute(alert)}
                accessibilityRole="button"
              >
                <Text style={[styles.muteText, { color: colors.textSecondary }]}>{t('health.alert.mute')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gotItBtn, { backgroundColor: colors.tintBackground }]}
                onPress={() => handleGotIt(alert)}
                accessibilityRole="button"
              >
                <Text style={[styles.gotItText, { color: colors.accent }]}>{t('health.alert.gotIt')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16, gap: 8 },
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  messageRow: { flexDirection: 'row', gap: 10 },
  messageBody: { flex: 1 },
  type: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  message: { fontSize: 14, lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  muteBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, flexShrink: 1 },
  muteText: { fontSize: 13, fontWeight: '500' },
  gotItBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12 },
  gotItText: { fontSize: 14, fontWeight: '700' },
});
