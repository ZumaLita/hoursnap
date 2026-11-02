// The web app has no background reminders; the APK handles those.
export const remindersSupported = false;
export async function scheduleReminders(_enabled: boolean, _schedule: unknown) {
  return true;
}
export function onReminderTap(_cb: () => void) {
  return () => {};
}
