import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Schedule } from './schedule';

const LINES = [
  'Wat ben je nu aan het doen?',
  'Snel, toon iedereen je moment.',
  'Voor en achter, go!',
  'Snappen of overslaan, jij kiest.',
  'Nieuw uur, nieuwe snap. Wat gebeurt er?',
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const remindersSupported = true;

/** Schedules a weekly reminder at the start of every hour this person can snap. */
export async function scheduleReminders(enabled: boolean, schedule: Schedule) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return true;

  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('snaps', {
      name: 'Snaps elk uur',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#4A3AFF',
    });
  }

  // weekday: 1 = Sunday ... 7 = Saturday
  for (let weekday = 1; weekday <= 7; weekday++) {
    const jsDay = weekday - 1;
    const w = schedule.onHoliday ? schedule.holiday : jsDay === 0 || jsDay === 6 ? schedule.weekend : schedule.weekday;
    if (!w.on) continue;
    for (let h = w.start; h <= w.end; h++) {
      await Notifications.scheduleNotificationAsync({
        content: { title: '📸 HourSnap-tijd', body: LINES[(h + weekday) % LINES.length], data: { hour: h } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: h, minute: 0, channelId: 'snaps' },
      });
    }
  }
  return true;
}

export function onReminderTap(cb: () => void) {
  const sub = Notifications.addNotificationResponseReceivedListener(() => cb());
  return () => sub.remove();
}
