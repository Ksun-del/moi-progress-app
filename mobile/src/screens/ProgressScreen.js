// Экран «Прогресс»: вес и график, неделя по данным с часов, тренировки, замеры, таймер
import { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useStore } from '../store';
import { C } from '../theme';
import { Btn, Card, Chip, Field, Icon, Progress, Section, Sheet, T } from '../ui';
import IntervalTimer from '../components/IntervalTimer';
import WorkoutSheet from '../components/WorkoutSheet';
import {
  today, shortDate, sortedMeasures, weekStats, workoutKcal, workoutTitle, workoutKind, DAY_SHORT, fmt, plural, removeWorkout,
} from '../logic/core';

export default function ProgressScreen({ watchState }) {
  const { db, update } = useStore();
  const { width } = useWindowDimensions();
  const [weightOpen, setWeightOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addW, setAddW] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const ms = sortedMeasures(db);
  const weights = ms.filter(m => m.weight).slice(0, 30).reverse();
  const cur = weights.length ? weights[weights.length - 1].weight : null;
  const { start, target } = db.settings;
  const lose = target <= start;
  const done = cur == null ? 0 : (lose ? start - cur : cur - start);
  const total = Math.max(0.1, Math.abs(start - target));
  const leftKg = cur == null ? null : Math.max(0, lose ? cur - target : target - cur);
  const week = weekStats(db);
  const workouts = [...db.workouts].sort((a, b) => (b.start || b.date).localeCompare(a.start || a.date));
  const chartW = width - 32 - 36;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
          <T w="x" size={30}>Прогресс</T>
        </View>

        <Card style={{ gap: 14, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <T size={13} color={C.muted}>Вес сейчас</T>
              <T w="x" size={40}>{cur != null ? String(cur).replace('.', ',') : '—'} <T w="s" size={18} color={C.muted}>кг</T></T>
            </View>
            {cur != null ? <Chip text={`${done >= 0 ? '−' : '+'}${String(Math.abs(Math.round(done * 10) / 10)).replace('.', ',')} кг с начала`} color={done >= 0 ? C.ok : C.bad} bg={done >= 0 ? C.okBg : C.badBg} /> : null}
          </View>
          {weights.length >= 2 ? <WeightChart data={weights} w={chartW} /> : <T size={14} color={C.muted}>График появится после двух взвешиваний.</T>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={14} color={C.muted}>Цель {String(target).replace('.', ',')} кг</T>
            {leftKg != null ? <T w="b" size={14}>осталось {String(Math.round(leftKg * 10) / 10).replace('.', ',')} кг</T> : null}
          </View>
          <Progress value={done / total} color={C.accent} height={8} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title="+ Внести вес" style={{ flex: 1 }} onPress={() => setWeightOpen(true)} />
            <Btn title="История" kind="ghost" style={{ flex: 1 }} onPress={() => setHistoryOpen(true)} />
          </View>
        </Card>

        <Card style={{ marginTop: 12, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T w="x" size={18}>Эта неделя</T>
            <T size={13} color={C.muted}>тренировки и питание</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 110 }}>
            {week.days.map(d => {
              const max = Math.max(300, ...week.days.map(x => x.kcal));
              const h = d.has ? Math.max(24, 80 * d.kcal / max) : 12;
              return (
                <View key={d.key} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <View style={{ width: '100%', height: h, borderRadius: 8, backgroundColor: d.has ? C.ink : d.future ? C.line : C.track }} />
                  <T size={12} color={C.muted}>{DAY_SHORT[d.key]}</T>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Stat v={week.count} l={plural(week.count, 'тренировка', 'тренировки', 'тренировок')} />
            <Stat v={fmt(week.burned)} l="ккал сожжено" />
            <Stat v={week.avgKcal ? fmt(week.avgKcal) : '—'} l="ккал в день (прошлые дни)" />
          </View>
        </Card>

        <Section title="Тренировки" action="+ Добавить" onAction={() => setAddW(true)} />
        <Card style={{ paddingVertical: 4 }}>
          {workouts.length ? (showAll ? workouts : workouts.slice(0, 5)).map((w, i) => (
            <View key={w.hcId || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: workoutKind(w) === 'strength' ? C.gymBg : C.runBg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={workoutKind(w) === 'strength' ? 'gym' : 'run'} color={workoutKind(w) === 'strength' ? C.gym : C.run} />
              </View>
              <View style={{ flex: 1 }}>
                <T w="b">{workoutTitle(w)}{w.distanceKm ? ` · ${String(w.distanceKm).replace('.', ',')} км` : ''}</T>
                <T size={13} color={C.muted}>{w.date === today() ? 'Сегодня' : shortDate(w.date)} · {w.duration} мин · {w.source === 'watch' ? 'с часов' : 'вручную'}</T>
              </View>
              <T w="b">{fmt(workoutKcal(db, w))}</T>
              <Pressable hitSlop={10} accessibilityLabel="Удалить тренировку" onPress={() => update(d => removeWorkout(d, w))}>
                <Icon name="trash" size={18} color={C.muted} />
              </Pressable>
            </View>
          )) : <T color={C.muted} style={{ paddingVertical: 14 }}>Тренировок пока нет. Нажмите «+ Добавить».</T>}
          {workouts.length > 5 && !showAll ? <Btn title="Показать все" kind="clear" small style={{ marginVertical: 10 }} onPress={() => setShowAll(true)} /> : null}
        </Card>

        <Card style={{ marginTop: 12, paddingVertical: 4 }}>
          <Pressable onPress={() => setTimerOpen(true)} accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
            <Icon name="timer" color={C.muted} />
            <T w="s" style={{ flex: 1 }}>Интервальный таймер</T>
            <Icon name="chevron" color={C.muted} size={18} />
          </Pressable>
        </Card>
      </ScrollView>

      <WeightSheet visible={weightOpen} onClose={() => setWeightOpen(false)}
        onSave={(m) => { update(d => ({ ...d, measure: [...d.measure, m] })); setWeightOpen(false); }} />

      <Sheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title="Вес и замеры">
        {ms.length ? ms.map((m, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
            <View style={{ flex: 1 }}>
              <T w="b">{shortDate(m.date)}{m.weight ? ` · ${String(m.weight).replace('.', ',')} кг` : ''}</T>
              {m.waist || m.belly || m.hips ? <T size={13} color={C.muted}>{[m.waist && `талия ${m.waist}`, m.belly && `живот ${m.belly}`, m.hips && `бёдра ${m.hips}`].filter(Boolean).join(' · ')} см</T> : null}
            </View>
            <Pressable hitSlop={10} accessibilityLabel="Удалить запись" onPress={() => update(d => ({ ...d, measure: d.measure.filter(x => x !== m) }))}>
              <Icon name="trash" size={18} color={C.muted} />
            </Pressable>
          </View>
        )) : <T color={C.muted}>Записей пока нет.</T>}
      </Sheet>

      <WorkoutSheet visible={addW} onClose={() => setAddW(false)} watchState={watchState} />

      <IntervalTimer visible={timerOpen} onClose={() => setTimerOpen(false)} />
    </View>
  );
}

function Stat({ v, l }) {
  return <View style={{ flex: 1 }}><T w="x" size={20}>{v}</T><T size={12} color={C.muted}>{l}</T></View>;
}

function WeightChart({ data, w }) {
  const h = 110, pad = 8;
  const vals = data.map(d => d.weight);
  const mn = Math.min(...vals) - 0.3, mx = Math.max(...vals) + 0.3;
  const pts = data.map((d, i) => [pad + i * (w - 2 * pad) / (data.length - 1), pad + (mx - d.weight) / (mx - mn) * (h - 2 * pad)]);
  const last = pts[pts.length - 1];
  return (
    <View>
      <Svg width={w} height={h}>
        {[0.15, 0.5, 0.85].map(f => <Line key={f} x1={0} x2={w} y1={h * f} y2={h * f} stroke={C.line} />)}
        <Polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={C.ink} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={last[0]} cy={last[1]} r={6} fill={C.accent} stroke={C.ink} strokeWidth={2} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={11} color={C.muted}>{shortDate(data[0].date)}</T>
        <T size={11} color={C.muted}>{shortDate(data[data.length - 1].date)}</T>
      </View>
    </View>
  );
}

function WeightSheet({ visible, onClose, onSave }) {
  const [f, setF] = useState({ weight: '', waist: '', belly: '', hips: '' });
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return n > 0 ? n : null; };
  const ok = num(f.weight) || num(f.waist) || num(f.belly) || num(f.hips);
  return (
    <Sheet visible={visible} onClose={onClose} title="Вес и замеры">
      <Field label="Вес, кг" keyboardType="decimal-pad" value={f.weight} onChangeText={weight => setF({ ...f, weight })} autoFocus />
      <T size={13} color={C.muted}>Замеры — по желанию, раз в несколько недель</T>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Талия, см" keyboardType="decimal-pad" value={f.waist} onChangeText={waist => setF({ ...f, waist })} style={{ flex: 1 }} />
        <Field label="Живот, см" keyboardType="decimal-pad" value={f.belly} onChangeText={belly => setF({ ...f, belly })} style={{ flex: 1 }} />
        <Field label="Бёдра, см" keyboardType="decimal-pad" value={f.hips} onChangeText={hips => setF({ ...f, hips })} style={{ flex: 1 }} />
      </View>
      <Btn title="Сохранить" disabled={!ok} onPress={() => {
        onSave({ date: today(), weight: num(f.weight), waist: num(f.waist), belly: num(f.belly), hips: num(f.hips) });
        setF({ weight: '', waist: '', belly: '', hips: '' });
      }} />
    </Sheet>
  );
}
