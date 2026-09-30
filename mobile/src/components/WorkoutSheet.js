// Шторка «Добавить тренировку»: выбрать тренировку с часов (последние 3 дня) или внести вручную.
// С часов сами ничего не добавляется — только то, что выбрала здесь.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useStore } from '../store';
import { C } from '../theme';
import { Btn, Field, Sheet, T } from '../ui';
import * as Health from '../logic/health';
import { today, shortDate, mergeWatchWorkouts, newWatchWorkouts, workoutTitle, workoutKcal, WORKOUT_KINDS, fmt } from '../logic/core';

export default function WorkoutSheet({ visible, onClose, watchState }) {
  const { db, update } = useStore();
  const [watchList, setWatchList] = useState(null); // null — загружаю
  const [form, setForm] = useState({ kind: 'run', duration: '', kcal: '' });

  useEffect(() => {
    if (!visible) return;
    setForm({ kind: 'run', duration: '', kcal: '' });
    if (watchState !== 'on') { setWatchList([]); return; }
    setWatchList(null);
    Health.readWorkouts(3).then(l => setWatchList(l || [])).catch(() => setWatchList([]));
  }, [visible, watchState]);

  const fresh = newWatchWorkouts(db, watchList || []);

  function addWatch(w) { update(d => mergeWatchWorkouts(d, [w], true)); }
  function addManual() {
    update(d => ({ ...d, workouts: [...d.workouts, { date: today(), kind: form.kind, duration: Number(form.duration), kcal: Number(form.kcal) || 0, source: 'manual' }] }));
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Добавить тренировку">
      {watchState === 'on' ? (
        <View style={{ gap: 0 }}>
          <T w="b" size={13} color={C.muted} style={{ marginBottom: 4 }}>С ЧАСОВ (ПОСЛЕДНИЕ 3 ДНЯ)</T>
          {watchList === null ? <ActivityIndicator color={C.ink} style={{ paddingVertical: 12 }} /> : null}
          {watchList !== null && !fresh.length ? <T color={C.muted} style={{ paddingVertical: 6 }}>Новых тренировок с часов нет.</T> : null}
          {fresh.map((w, i) => (
            <View key={w.hcId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
              <View style={{ flex: 1 }}>
                <T w="s">{workoutTitle(w)}{w.distanceKm ? ` · ${String(w.distanceKm).replace('.', ',')} км` : ''}</T>
                <T size={13} color={C.muted}>{w.date === today() ? 'Сегодня' : shortDate(w.date)} {timeOf(w.start)} · {w.duration} мин · {fmt(workoutKcal(db, w))} ккал</T>
              </View>
              <Btn title="Добавить" small onPress={() => addWatch(w)} />
            </View>
          ))}
        </View>
      ) : null}

      <T w="b" size={13} color={C.muted} style={{ marginTop: 8 }}>ВРУЧНУЮ (СЕГОДНЯ)</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(WORKOUT_KINDS).map(([k, label]) => (
          <Pressable key={k} onPress={() => setForm({ ...form, kind: k })} accessibilityRole="button" accessibilityState={{ selected: form.kind === k }}
            style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: form.kind === k ? C.ink : C.soft }}>
            <T w="s" size={14} color={form.kind === k ? '#fff' : C.ink}>{label}</T>
          </Pressable>
        ))}
      </View>
      <Field label="Длительность, мин" keyboardType="number-pad" value={form.duration} onChangeText={v => setForm({ ...form, duration: v.replace(/\D/g, '') })} />
      <Field label="Калории, если знаете (иначе посчитаю сама)" keyboardType="number-pad" value={form.kcal} onChangeText={v => setForm({ ...form, kcal: v.replace(/\D/g, '') })} />
      <Btn title="Сохранить" disabled={!Number(form.duration)} onPress={addManual} />
    </Sheet>
  );
}

function timeOf(s) { const d = new Date(s); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
