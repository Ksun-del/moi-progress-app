// Экран «Сегодня»: кольцо калорий, белок, вода, тренировка с часов, подсказка на ужин, приёмы пищи
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useStore } from '../store';
import { C } from '../theme';
import { Btn, Card, Chip, Icon, Progress, Ring, Round, Section, T } from '../ui';
import MealPicker from '../components/MealPicker';
import {
  today, humanDate, dayTotals, dayTarget, dinnerAdvice, workoutsOn, workoutKcal, workoutTitle, workoutKind,
  waterCount, addWater, undoWater, splitDishName, setSlot, removeExtra, fmt, plural, r1, dec,
} from '../logic/core';

export default function TodayScreen({ onOpenSettings, onOpenFood, steps, watchState, onConnectWatch }) {
  const { db, update } = useStore();
  const [slot, setSlotPick] = useState(null);
  const date = today();
  const t = dayTotals(db, date);
  const target = dayTarget(db, date);
  const left = target.total - t.kcal;
  const water = waterCount(db, date);
  const workouts = workoutsOn(db, date);
  const advice = dinnerAdvice(db, date);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 }}>
          <View>
            <T size={14} color={C.muted}>{humanDate(date)}</T>
            <T w="x" size={30}>Сегодня</T>
          </View>
          <Round label="Настройки" onPress={onOpenSettings}><Icon name="gear" size={22} width={1.8} /></Round>
        </View>

        <Card style={{ gap: 18, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <Ring value={t.kcal / target.total} color={left < -target.total * 0.05 ? C.bad : C.accent}>
              <T w="x" size={32}>{fmt(Math.abs(left))}</T>
              <T size={13} color={C.muted}>{left >= 0 ? 'ккал можно' : 'ккал сверху'}</T>
            </Ring>
            <View style={{ flex: 1, gap: 10 }}>
              <View>
                <T size={13} color={C.muted}>Съедено</T>
                <T w="b" size={20}>{fmt(t.kcal)} <T size={14} color={C.muted}>ккал</T></T>
              </View>
              <View>
                <T size={13} color={C.muted}>Норма сегодня</T>
                <T w="b" size={20}>{fmt(target.total)} <T size={14} color={C.muted}>ккал</T></T>
                {target.bonus > 0 ? <T w="s" size={12} color={C.accentText}>{target.base} + {target.bonus} за тренировку</T> : null}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: C.soft, borderRadius: 16, padding: 12, gap: 8 }}>
              <T size={13} color={C.muted}>Белок</T>
              <T w="b" size={17}>{Math.round(t.protein)} <T size={13} color={C.muted}>/ {db.settings.protein} г</T></T>
              <Progress value={t.protein / db.settings.protein} />
            </View>
            <View style={{ flex: 1, backgroundColor: C.soft, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable style={{ flex: 1 }} onLongPress={() => update(undoWater)} accessibilityHint="Долгое нажатие — убрать стакан">
                <T size={13} color={C.muted}>Вода, стаканов</T>
                <T w="b" size={17}>{water} <T size={13} color={C.muted}>/ {db.settings.waterGoal}</T></T>
              </Pressable>
              <Round label="Добавить стакан воды" bg={C.water} onPress={() => update(addWater)}><Icon name="plus" color="#fff" /></Round>
            </View>
          </View>
          {steps != null ? <T size={13} color={C.muted}>Шаги сегодня: {fmt(steps)}</T> : null}
        </Card>

        {workouts.map((w, i) => (
          <Card key={w.hcId || i} style={{ marginTop: 12, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: workoutKind(w) === 'strength' ? C.gymBg : C.runBg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={workoutKind(w) === 'strength' ? 'gym' : 'run'} color={workoutKind(w) === 'strength' ? C.gym : C.run} />
              </View>
              <View style={{ flex: 1 }}>
                <T w="b" size={16}>{workoutTitle(w)}</T>
                <T size={13} color={C.muted}>{w.source === 'watch' ? 'С часов' : 'Вручную'}{w.start ? ' · ' + timeRange(w) : ''}</T>
              </View>
              <Chip text={`+${Math.round(workoutKcal(db, w) * db.settings.exerciseShare / 100 / 10) * 10} к норме`} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Stat v={`${w.duration} мин`} l="время" />
              {w.distanceKm ? <Stat v={`${String(w.distanceKm).replace('.', ',')} км`} l="дистанция" /> : null}
              <Stat v={fmt(workoutKcal(db, w))} l={w.kcal ? 'ккал сожгла' : 'ккал (оценка)'} />
            </View>
          </Card>
        ))}

        {!workouts.length && watchState === 'off' ? (
          <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="watch" color={C.run} size={24} />
            <T style={{ flex: 1 }} size={14}>Подключите часы — тренировки будут появляться здесь сами</T>
            <Btn title="Подключить" small onPress={onConnectWatch} />
          </Card>
        ) : null}

        {advice ? (
          <Card dark style={{ marginTop: 12, gap: 12 }}>
            <View style={{ gap: 4 }}>
              <T size={12} color={C.darkMuted}>Что съесть на ужин</T>
              <T w="s" color="#fff">
                {advice.kcalLeft > 0
                  ? `Останется ${fmt(advice.kcalLeft)} ккал${advice.proteinLeft > 0 ? ` и ${advice.proteinLeft} г белка` : ''}. Лучше подойдёт:`
                  : 'Калории на сегодня уже набраны. Если голодно — лёгкий белковый ужин:'}
              </T>
            </View>
            {(advice.options.length ? advice.options : []).map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.darkSoft, borderRadius: 16, padding: 12 }}>
                <View style={{ flex: 1 }}>
                  <T w="b" color="#fff">{splitDishName(d.name).title}</T>
                  <T size={13} color={C.darkMuted}>{d.cal} ккал · {dec(d.protein)} г белка</T>
                </View>
                <Btn title="Выбрать" small kind={i === 0 ? 'accent' : 'darkGhost'}
                  onPress={() => { const di = t.meals.findIndex(m => m.cat === 'Ужин'); update(x => setSlot(x, date, di, { name: d.name, cal: d.cal, protein: d.protein })); }} />
              </View>
            ))}
            {!advice.options.length ? <T size={13} color={C.darkMuted}>Подходящего готового ужина нет — возьмите по плану половину порции или творог 150 г.</T> : null}
          </Card>
        ) : null}

        <Section title="Еда" action="Изменить" onAction={onOpenFood} />
        <Card style={{ paddingVertical: 4 }}>
          {t.meals.map((m, i) => (
            <Pressable key={i} onPress={() => setSlotPick(i)} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
              <Pressable hitSlop={8} accessibilityLabel={m.state === 'todo' ? 'Отметить: съела по плану' : 'Снять отметку'}
                onPress={() => update(x => setSlot(x, date, i, m.state === 'todo' ? 'plan' : null))}>
                {m.state === 'eaten' || m.state === 'custom'
                  ? <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={15} color="#fff" width={3} /></View>
                  : m.state === 'skip'
                    ? <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={14} color={C.muted} width={3} /></View>
                    : <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.border }} />}
              </Pressable>
              <View style={{ flex: 1 }}>
                <T size={12} color={C.muted}>{m.cat}{m.state === 'todo' ? ' · по плану' : m.state === 'custom' ? ' · замена' : m.state === 'skip' ? ' · не ела' : ''}</T>
                <T w="s" color={m.state === 'todo' || m.state === 'skip' ? C.muted : C.ink} style={m.state === 'skip' ? { textDecorationLine: 'line-through' } : null}>{splitDishName(m.name).title}</T>
              </View>
              <T w="b" color={m.state === 'todo' ? C.muted : C.ink}>{m.state === 'skip' ? 0 : m.cal}</T>
            </Pressable>
          ))}
          {t.extras.map((x, i) => (
            <View key={'x' + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderColor: C.line }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={15} color="#fff" width={3} /></View>
              <View style={{ flex: 1 }}>
                <T size={12} color={C.muted}>Ещё</T>
                <T w="s">{splitDishName(x.name).title}</T>
              </View>
              <T w="b">{x.cal}</T>
              <Round label="Удалить" size={36} bg={C.soft} onPress={() => update(d => removeExtra(d, date, i))}><Icon name="close" size={14} color={C.muted} /></Round>
            </View>
          ))}
        </Card>
        <Btn title="+ Ещё что-то съела" kind="ghost" style={{ marginTop: 12 }} onPress={() => setSlotPick('extra')} />
      </ScrollView>
      <MealPicker date={date} slot={slot} onClose={() => setSlotPick(null)} />
    </View>
  );
}

function Stat({ v, l }) {
  return <View style={{ flex: 1 }}><T w="b" size={18}>{v}</T><T size={12} color={C.muted}>{l}</T></View>;
}
function timeRange(w) {
  const f = (s) => { const d = new Date(s); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  return w.end ? `${f(w.start)}–${f(w.end)}` : f(w.start);
}
