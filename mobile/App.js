// Приложение «Мой прогресс» для Android.
// Внутри — та же страница index.html, что и на сайте (упакована в app-html.js).
// Приложение добавляет:
//   • надёжное хранение данных в памяти телефона (AsyncStorage);
//   • напоминания прямо с телефона — без сервера на Render;
//   • экспорт резервной копии через «Поделиться»;
//   • кнопку «Назад».
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import APP_HTML from './app-html';
import { planReminders } from './reminders';

const DATA_KEY = 'myProgressV2';
const CHANNEL_ID = 'reminders';

// Уведомления показываем и когда приложение открыто
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Напоминания',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) await Notifications.requestPermissionsAsync();
}

// Полностью пересобираем расписание при каждом изменении настроек/отметок
async function scheduleReminders(settings) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const plan = planReminders(settings);
  for (const r of plan) {
    const content = { title: r.title, body: r.body, sound: 'default' };
    const trigger = r.kind === 'daily'
      ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: CHANNEL_ID }
      : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL_ID };
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger });
    } catch (e) {
      console.warn('Не удалось поставить напоминание', r.title, e);
    }
  }
}

async function shareBackup(json) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const file = new File(Paths.cache, `moi-progress-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Сохранить резервную копию' });
}

export default function App() {
  const webRef = useRef(null);
  // undefined — ещё читаем память, null — данных нет, строка — сохранённые данные
  const [saved, setSaved] = useState(undefined);

  useEffect(() => {
    AsyncStorage.getItem(DATA_KEY).then(setSaved).catch(() => setSaved(null));
    setupNotifications().catch(() => {});
  }, []);

  // «Назад»: страница сама решает — закрыть окно, вернуться на Главную или выйти
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      webRef.current?.injectJavaScript('window.__onBack && window.__onBack(); true;');
      return true;
    });
    return () => sub.remove();
  }, []);

  const onMessage = useCallback(async (event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    try {
      if (msg.type === 'save') await AsyncStorage.setItem(DATA_KEY, msg.data.json);
      else if (msg.type === 'reminders') await scheduleReminders(msg.data);
      else if (msg.type === 'export') await shareBackup(msg.data.json);
      else if (msg.type === 'exit') BackHandler.exitApp();
    } catch (e) {
      console.warn('Ошибка обработки сообщения', msg.type, e);
    }
  }, []);

  if (saved === undefined) return <View style={styles.bg} />;

  // До загрузки страницы: если у WebView данных нет (первый запуск, очистка),
  // восстанавливаем их из памяти приложения. Если есть — не трогаем, они не старее.
  const beforeLoad = `
    try {
      var saved = ${JSON.stringify(saved)};
      if (saved && !localStorage.getItem('${DATA_KEY}')) localStorage.setItem('${DATA_KEY}', saved);
    } catch (e) {}
    true;
  `;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.bg} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <WebView
          ref={webRef}
          style={styles.bg}
          originWhitelist={['*']}
          source={{ html: APP_HTML, baseUrl: 'https://moi-progress.app/' }}
          injectedJavaScriptBeforeContentLoaded={beforeLoad}
          onMessage={onMessage}
          domStorageEnabled
          javaScriptEnabled
          allowFileAccess
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          overScrollMode="never"
          textZoom={100}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#ffffff' },
});
