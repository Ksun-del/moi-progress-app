// Уведомления с самого телефона (вместо сервера на Render)
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { planReminders } from './reminders';
import { sortedMeasures } from './core';

const CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Напоминания',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (!cur.granted) await Notifications.requestPermissionsAsync();
}

export function reminderPayload(db) {
  const m = sortedMeasures(db);
  return {
    waterEnabled: !!db.settings.waterEnabled,
    waterHours: db.settings.waterHours,
    lastWaterLog: db.waterLog.length ? db.waterLog[db.waterLog.length - 1] : null,
    weightDays: db.settings.weightDays,
    measureDays: db.settings.measureDays,
    lastWeightLog: m.find(x => x.weight)?.date || null,
    lastMeasureLog: m.find(x => x.waist || x.hips || x.belly)?.date || null,
    customReminders: db.customReminders || [],
  };
}

let lastKey = '';
// Пересобирает расписание целиком; вызывается при каждом изменении данных, но работает, только если что-то поменялось
export async function scheduleReminders(db) {
  const payload = reminderPayload(db);
  const key = JSON.stringify(payload);
  if (key === lastKey) return;
  lastKey = key;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of planReminders(payload)) {
    const content = { title: r.title, body: r.body, sound: 'default' };
    const trigger = r.kind === 'daily'
      ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: CHANNEL_ID }
      : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL_ID };
    try { await Notifications.scheduleNotificationAsync({ content, trigger }); }
    catch (e) { console.warn('Не удалось поставить напоминание', r.title, e); }
  }
}
