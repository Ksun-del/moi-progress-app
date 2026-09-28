// «Мой прогресс» — приложение для Android.
// Три экрана (Сегодня / Еда / Прогресс) + настройки. Тренировки подтягиваются с часов через Health Connect,
// напоминания ставит сам телефон, данные хранятся в памяти телефона.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold } from '@expo-google-fonts/onest';
import { StoreProvider, useStore } from './src/store';
import { C } from './src/theme';
import { Icon, T } from './src/ui';
import TodayScreen from './src/screens/TodayScreen';
import FoodScreen from './src/screens/FoodScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { setupNotifications, scheduleReminders } from './src/logic/notify';
import * as Health from './src/logic/health';
import { mergeWatchWorkouts } from './src/logic/core';

export default function App() {
  const [fonts] = useFonts({ Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold });
  return (
    <SafeAreaProvider>
      <StoreProvider>
        {fonts ? <Main /> : <View style={{ flex: 1, backgroundColor: C.bg }} />}
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const TABS = [
  { key: 'today', title: 'Сегодня', icon: 'today' },
  { key: 'food', title: 'Еда', icon: 'food' },
  { key: 'progress', title: 'Прогресс', icon: 'progress' },
];

function Main() {
  const { db, update } = useStore();
  const [tab, setTab] = useState('today');
  const [settings, setSettings] = useState(false);
  const [watch, setWatch] = useState('checking'); // checking | off | on | unavailable
  const [steps, setSteps] = useState(null);
  const syncing = useRef(false);

  // Данные с часов: тренировки, шаги, вес
  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const s = await Health.status();
      if (s !== 'ok') { setWatch(s === 'update' ? 'off' : 'unavailable'); return; }
      if (!(await Health.hasAccess())) { setWatch('off'); return; }
      setWatch('on');
      const list = await Health.readWorkouts(14);
      if (list && list.length) update(d => mergeWatchWorkouts(d, list));
      setSteps(await Health.readStepsToday());
      const ws = await Health.readWeights(30);
      if (ws.length) update(d => {
        const have = new Set(d.measure.filter(m => m.weight).map(m => m.date));
        const add = ws.filter(w => !have.has(w.date)).map(w => ({ date: w.date, weight: w.weight, source: 'scale' }));
        return add.length ? { ...d, measure: [...d.measure, ...add] } : d;
      });
    } catch (e) {
      console.warn('Health Connect', e);
    } finally { syncing.current = false; }
  }, [update]);

  const connect = useCallback(async () => {
    try { if (await Health.connect()) await sync(); else setWatch(w => (w === 'unavailable' ? w : 'off')); }
    catch (e) { console.warn(e); }
  }, [sync]);

  useEffect(() => {
    setupNotifications().catch(() => {});
    sync();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') sync(); });
    return () => sub.remove();
  }, [sync]);

  // Напоминания пересчитываются при изменении данных (функция сама пропускает, если ничего не поменялось)
  useEffect(() => { if (db) scheduleReminders(db).catch(() => {}); }, [db]);

  // «Назад» на телефоне: с «Еды»/«Прогресса» — на «Сегодня», с «Сегодня» — выход
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'today') { setTab('today'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [tab]);

  if (!db) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        {tab === 'today' ? <TodayScreen onOpenSettings={() => setSettings(true)} onOpenFood={() => setTab('food')} steps={steps} watchState={watch} onConnectWatch={connect} /> : null}
        {tab === 'food' ? <FoodScreen /> : null}
        {tab === 'progress' ? <ProgressScreen /> : null}
      </View>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.card, borderTopWidth: 1, borderColor: '#ece6dd' }}>
        <View style={{ height: 72, flexDirection: 'row', alignItems: 'center' }} accessibilityRole="tablist">
          {TABS.map(t => {
            const on = t.key === tab;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ width: 56, height: 30, borderRadius: 15, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={t.icon} color={on ? C.ink : C.muted} />
                </View>
                <T w={on ? 'b' : 's'} size={12} color={on ? C.ink : C.muted}>{t.title}</T>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
      <SettingsScreen visible={settings} onClose={() => setSettings(false)} watchState={watch}
        onConnectWatch={connect} onOpenHealth={Health.openSettings} onSync={sync} />
    </SafeAreaView>
  );
}
