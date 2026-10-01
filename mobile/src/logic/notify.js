// Уведомления с самого телефона (вместо сервера на Render)
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { planReminders } from './reminders';
import { sortedMeasures, markReminderDone, normalizeDb, DB_KEY } from './core';
import * as Cloud from './cloud';

const CHANNEL_ID = 'reminders';
const PILL_CATEGORY = 'pill';      // свои напоминания — с кнопкой «✓ Выпила»
const DONE_ACTION = 'done';
const HANDLED_KEY = 'myProgressDoneHandled';
export const NOTIFY_TASK = 'moi-progress-notify';

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
  // Кнопка в самом уведомлении; приложение при нажатии не открывается
  await Notifications.setNotificationCategoryAsync(PILL_CATEGORY, [
    { identifier: DONE_ACTION, buttonTitle: '✓ Выпила', options: { opensAppToForeground: false } },
  ]);
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
    // отметки «выпила» (done) на расписание не влияют — их не берём, чтобы зря не пересобирать
    customReminders: (db.customReminders || []).map(({ id, name, type, time, hours, lastLog }) => ({ id, name, type, time, hours, lastLog })),
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
    const content = { title: r.title, sound: 'default' };
    if (r.body) content.body = r.body;
    if (r.rid) { content.categoryIdentifier = PILL_CATEGORY; content.data = { rid: r.rid }; }
    const trigger = r.kind === 'daily'
      ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: CHANNEL_ID }
      : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL_ID };
    try { await Notifications.scheduleNotificationAsync({ content, trigger }); }
    catch (e) { console.warn('Не удалось поставить напоминание', r.title, e); }
  }
}

// ---------- Кнопка «✓ Выпила» ----------
// Если приложение открыто или свёрнуто — отметка идёт через хранилище (store.js передаёт сюда update).
// Если закрыто — Android запускает фоновую задачу: пишем прямо в память телефона и в облако.
let liveUpdate = null;
export function setLiveUpdate(fn) { liveUpdate = fn; }

// В фоновой задаче данные приходят «сырыми» строкой (dataString), в обычном обработчике — объектом (data)
function readRid(content) {
  if (!content) return null;
  if (content.data && content.data.rid) return content.data.rid;
  try { return JSON.parse(content.dataString || '{}').rid || null; } catch { return null; }
}

const seen = new Set();
export async function handleNotificationResponse(resp) {
  if (!resp || resp.actionIdentifier !== DONE_ACTION) return;
  const n = resp.notification;
  const id = n?.request?.identifier;
  const rid = readRid(n?.request?.content);
  if (id) Notifications.dismissNotificationAsync(id).catch(() => {}); // убрать из шторки
  // Одно нажатие может прийти дважды (фоновая задача + обработчик) — считаем один раз
  const key = id + '|' + n?.date;
  if (seen.has(key)) return;
  seen.add(key);
  let handled = [];
  try { handled = JSON.parse(await AsyncStorage.getItem(HANDLED_KEY)) || []; } catch {}
  if (handled.includes(key)) return;
  await AsyncStorage.setItem(HANDLED_KEY, JSON.stringify([...handled, key].slice(-50))).catch(() => {});
  if (!rid) return;
  const at = new Date();
  if (liveUpdate) { liveUpdate(d => markReminderDone(d, rid, at)); return; }

  const raw = await AsyncStorage.getItem(DB_KEY);
  if (!raw) return;
  let db = { ...markReminderDone(normalizeDb(JSON.parse(raw)), rid, at), _updatedAt: Date.now() };
  await AsyncStorage.setItem(DB_KEY, JSON.stringify(db));
  await scheduleReminders(db).catch(() => {});
  const cfg = await Cloud.loadConfig();
  if (!cfg) return;
  try {
    if (!(await Cloud.push(cfg, db))) {
      // в облаке версия новее — добавляем отметку к ней
      const remote = await Cloud.pull(cfg);
      if (remote.db) {
        db = { ...markReminderDone(normalizeDb(remote.db), rid, at), _updatedAt: Math.max(Date.now(), remote.updatedAt + 1) };
        await AsyncStorage.setItem(DB_KEY, JSON.stringify(db));
        await Cloud.push(cfg, db);
      }
    }
  } catch {} // нет интернета — уйдёт в облако при следующем открытии приложения
}

// Фоновая задача: должна быть объявлена при загрузке приложения (index.js импортирует этот файл)
TaskManager.defineTask(NOTIFY_TASK, async ({ data }) => {
  if (data && 'actionIdentifier' in data) await handleNotificationResponse(data);
});
Notifications.registerTaskAsync(NOTIFY_TASK).catch(() => {});
