import { tNow } from '@/i18n';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestAndScheduleImportReminders() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted by user.');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('import-reminders', {
        name: tNow('notifications.channel'),
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Clear previous scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    const title = tNow('notifications.title');
    const body = tNow('notifications.body');

    // Middle of the month: 15th at 09:00 AM
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: 15,
        hour: 9,
        minute: 0,
        ...(Platform.OS === 'android' ? { channelId: 'import-reminders' } : {}),
      },
    });

    // End of the month: 28th at 09:00 AM
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: 28,
        hour: 9,
        minute: 0,
        ...(Platform.OS === 'android' ? { channelId: 'import-reminders' } : {}),
      },
    });

    console.log('Successfully scheduled bi-monthly import reminders (15th & 28th).');
    return true;
  } catch (error) {
    console.error('Failed to setup import notifications:', error);
    return false;
  }
}

/** Re-schedules the reminders in the active language; does nothing when none are scheduled. */
export async function refreshImportReminderText() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (scheduled.length > 0) await requestAndScheduleImportReminders();
}

/**
 * Smart Suppressor: Cancels all scheduled import reminders for the current month.
 */
export async function cancelCurrentMonthReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Smart Suppressor: Canceled remaining import reminders for this month.');
  } catch (error) {
    console.error('Failed to cancel notifications:', error);
  }
}
const HEALTH_CHANNEL = 'health-alerts';

/**
 * Shows Budget Health alerts right away. Never asks for permission: that only happens when the user turns an
 * alert type on (`requestHealthAlertPermission`). Delivered at once because the import flow cancels scheduled ones.
 */
export async function notifyHealthAlerts(bodies: string[]): Promise<void> {
  if (bodies.length === 0) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(HEALTH_CHANNEL, {
        name: tNow('health.notification.channel'),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const title = tNow('health.title');
    for (const body of bodies) {
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: Platform.OS === 'android' ? { channelId: HEALTH_CHANNEL } : null,
      });
    }
  } catch (error) {
    console.error('Failed to show health alerts:', error);
  }
}

/** Asked when the user turns an alert type on; false when notifications stay off. */
export async function requestHealthAlertPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
}
