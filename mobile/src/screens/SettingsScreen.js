// Настройки: часы, норма, вес, напоминания, резервная копия
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useStore } from '../store';
import { C } from '../theme';
import { Btn, Card, Field, Icon, Round, Section, T } from '../ui';
import { emptyDb, today } from '../logic/core';

export default function SettingsScreen({ visible, onClose, watchState, onConnectWatch, onOpenHealth, onSync }) {
  const { db, update, replace } = useStore();
  const [rem, setRem] = useState({ name: '', type: 'daily', time: '09:00', hours: '8' });
  const st = db.settings;
  const set = (patch) => update(d => ({ ...d, settings: { ...d.settings, ...patch } }));
  const numField = (key, label, opts = {}) => (
    <Field label={label} keyboardType={opts.decimal ? 'decimal-pad' : 'number-pad'} defaultValue={String(st[key] ?? '')} style={opts.style}
      onEndEditing={e => { const n = parseFloat(String(e.nativeEvent.text).replace(',', '.')); if (n > 0) set({ [key]: n }); }} />
  );

  async function exportData() {
    const file = new File(Paths.cache, `moi-progress-${today()}.json`);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(db, null, 2));
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Сохранить резервную копию' });
  }
  async function importData() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (r.canceled) return;
    try {
      const data = JSON.parse(await new File(r.assets[0].uri).text());
      if (!data || !data.settings) throw new Error('bad');
      Alert.alert('Загрузить копию?', 'Текущие данные в приложении заменятся данными из файла.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Загрузить', onPress: () => replace(data) },
      ]);
    } catch { Alert.alert('Не получилось', 'Это не файл резервной копии «Моего прогресса».'); }
  }
  function resetAll() {
    Alert.alert('Удалить все данные?', 'Сначала лучше сделать резервную копию. Отменить удаление будет нельзя.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => replace(emptyDb()) },
    ]);
  }
  function addReminder() {
    if (!rem.name.trim()) return;
    const r = { id: Date.now().toString(), name: rem.name.trim(), type: rem.type };
    if (rem.type === 'daily') r.time = /^\d{1,2}:\d{2}$/.test(rem.time) ? rem.time.padStart(5, '0') : '09:00';
    else { r.hours = Number(rem.hours) || 8; r.lastLog = new Date().toISOString(); }
    update(d => ({ ...d, customReminders: [...d.customReminders, r] }));
    setRem({ name: '', type: 'daily', time: '09:00', hours: '8' });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 }}>
          <Round label="Назад" onPress={onClose}><Icon name="back" /></Round>
          <T w="x" size={24}>Настройки</T>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          <Section title="Часы Xiaomi" />
          <Card style={{ gap: 12 }}>
            {watchState === 'on' ? (
              <>
                <T>Подключено. Тренировки, шаги и вес подтягиваются из Health Connect при каждом открытии приложения.</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn title="Обновить сейчас" small onPress={onSync} style={{ flex: 1 }} />
                  <Btn title="Health Connect" kind="ghost" small onPress={onOpenHealth} style={{ flex: 1 }} />
                </View>
              </>
            ) : watchState === 'unavailable' ? (
              <T>На этом телефоне нет Health Connect. Установите его из Google Play (на Android 14 и новее он уже встроен), потом вернитесь сюда.</T>
            ) : (
              <>
                <T w="b">Два шага, один раз:</T>
                <T>1. В приложении Mi Fitness: Профиль → Настройки → Аккаунты → Health Connect → разрешите передачу тренировок, шагов и веса.</T>
                <T>2. Здесь нажмите «Подключить» и разрешите чтение.</T>
                <Btn title="Подключить" onPress={onConnectWatch} />
              </>
            )}
          </Card>

          <Section title="Питание" />
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {numField('normal', 'Норма, ккал в день', { style: { flex: 1 } })}
              {numField('protein', 'Белок, г в день', { style: { flex: 1 } })}
            </View>
            <View style={{ gap: 8 }}>
              <T size={13} color={C.muted}>Сколько сожжённого на тренировке добавлять к норме</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[0, 30, 50, 70, 100].map(v => (
                  <Pressable key={v} onPress={() => set({ exerciseShare: v })} accessibilityRole="button" accessibilityState={{ selected: st.exerciseShare === v }}
                    style={{ flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: st.exerciseShare === v ? C.ink : C.soft }}>
                    <T w="b" size={14} color={st.exerciseShare === v ? '#fff' : C.ink}>{v}%</T>
                  </Pressable>
                ))}
              </View>
              <T size={13} color={C.muted}>Часы обычно завышают расход. Для похудения советую 50%: после бега на 380 ккал норма вырастет на 190.</T>
            </View>
            {numField('waterGoal', 'Цель по воде, стаканов в день')}
          </Card>

          <Section title="Вес" />
          <Card style={{ flexDirection: 'row', gap: 10 }}>
            {numField('start', 'Старт, кг', { decimal: true, style: { flex: 1 } })}
            {numField('target', 'Цель, кг', { decimal: true, style: { flex: 1 } })}
          </Card>

          <Section title="Напоминания" />
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <T style={{ flex: 1 }}>Напоминать пить воду</T>
              <Switch value={!!st.waterEnabled} onValueChange={v => set({ waterEnabled: v })} trackColor={{ true: C.accent }} thumbColor="#fff" />
            </View>
            {st.waterEnabled ? numField('waterHours', 'Через сколько часов после стакана напомнить') : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {numField('weightDays', 'Взвешивание, раз в … дней', { style: { flex: 1 } })}
              {numField('measureDays', 'Замеры, раз в … дней', { style: { flex: 1 } })}
            </View>
            <T size={13} color={C.muted}>Про воду ночью (23:00–8:00) не напоминаю. Взвешивание и замеры — в 9:00 нужного дня.</T>
          </Card>

          <Card style={{ gap: 12, marginTop: 12 }}>
            <T w="b">Свои напоминания (таблетки и т.п.)</T>
            {db.customReminders.map(r => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderColor: C.line }}>
                <View style={{ flex: 1 }}>
                  <T w="s">{r.name}</T>
                  <T size={13} color={C.muted}>{r.type === 'daily' ? `каждый день в ${r.time}` : `каждые ${r.hours} ч после отметки`}</T>
                </View>
                {r.type === 'interval' ? <Btn title="Приняла" kind="ghost" small onPress={() => update(d => ({ ...d, customReminders: d.customReminders.map(x => x.id === r.id ? { ...x, lastLog: new Date().toISOString() } : x) }))} /> : null}
                <Pressable hitSlop={10} accessibilityLabel="Удалить напоминание" onPress={() => update(d => ({ ...d, customReminders: d.customReminders.filter(x => x.id !== r.id) }))}>
                  <Icon name="trash" color={C.muted} size={18} />
                </Pressable>
              </View>
            ))}
            <Field label="Название" value={rem.name} onChangeText={name => setRem({ ...rem, name })} placeholder="Например: Витамин D" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['daily', 'В одно время'], ['interval', 'Каждые N часов']].map(([k, l]) => (
                <Pressable key={k} onPress={() => setRem({ ...rem, type: k })} accessibilityRole="button" accessibilityState={{ selected: rem.type === k }}
                  style={{ flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: rem.type === k ? C.ink : C.soft }}>
                  <T w="s" size={14} color={rem.type === k ? '#fff' : C.ink}>{l}</T>
                </Pressable>
              ))}
            </View>
            {rem.type === 'daily'
              ? <Field label="Время (ЧЧ:ММ)" value={rem.time} onChangeText={time => setRem({ ...rem, time })} keyboardType="numbers-and-punctuation" />
              : <Field label="Каждые сколько часов" value={rem.hours} onChangeText={hours => setRem({ ...rem, hours: hours.replace(/\D/g, '') })} keyboardType="number-pad" />}
            <Btn title="+ Добавить напоминание" onPress={addReminder} disabled={!rem.name.trim()} />
          </Card>

          <Section title="Данные" />
          <Card style={{ gap: 10 }}>
            <T size={14} color={C.muted}>Все данные хранятся только в этом телефоне. Время от времени сохраняйте копию.</T>
            <Btn title="Сохранить резервную копию" onPress={exportData} />
            <Btn title="Загрузить из копии" kind="ghost" onPress={importData} />
            <Btn title="Удалить все данные" kind="danger" onPress={resetAll} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
