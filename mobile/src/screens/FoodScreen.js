// Экран «Еда»: приём пищи по плану или замена, готовые блюда, меню недели, заготовки, покупки
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useStore } from '../store';
import { C } from '../theme';
import { Btn, Card, Icon, Section, Sheet, T } from '../ui';
import MealPicker from '../components/MealPicker';
import {
  today, addDays, dayMeals, catalog, menuIndex, menuDay, weekdayKey, shoppingFor, prepFor,
  splitDishName, setSlot, forSlot, isCoffee, DAY_KEYS, DAY_SHORT, DAY_FULL, r1, dec,
} from '../logic/core';

export default function FoodScreen() {
  const { db, update } = useStore();
  const date = today();
  const meals = dayMeals(db, date);
  const firstTodo = Math.max(0, meals.findIndex(m => m.state === 'todo'));
  const [sel, setSel] = useState(firstTodo);
  const [picker, setPicker] = useState(null);
  const [dayView, setDayView] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [myOpen, setMyOpen] = useState(false);
  const meal = meals[sel] || meals[0];
  const mi = menuIndex(date);
  const list = forSlot(catalog(db, date), meal).slice(0, 8);
  const prep = prepFor(addDays(date, 1));
  const prepEntries = ['Завтрак', 'Обед', 'Перекус', 'Ужин'].filter(k => prep[k] && prep[k].length);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
          <T size={14} color={C.muted}>Меню недели {mi + 1} из 3 · {DAY_FULL[weekdayKey(date)]}</T>
          <T w="x" size={30}>Еда</T>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {meals.map((m, i) => (
            <Pressable key={i} onPress={() => setSel(i)} accessibilityRole="button" accessibilityState={{ selected: i === sel }}
              style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: i === sel ? C.ink : C.card, borderWidth: 1, borderColor: i === sel ? C.ink : C.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {m.state !== 'todo' ? <Icon name="check" size={14} color={i === sel ? '#fff' : C.ok} width={3} /> : null}
              <T w="s" size={14} color={i === sel ? '#fff' : C.ink}>{isCoffee(m.plan.name) ? 'Кофе' : m.cat}</T>
            </Pressable>
          ))}
        </ScrollView>

        <Card style={{ marginTop: 6, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13} color={C.muted}>{meal.state === 'custom' ? 'Съела вместо плана' : meal.state === 'skip' ? 'Отмечено: не ела' : `По плану: ${meal.cat.toLowerCase()}`}</T>
            <T w="b" size={13}>{meal.state === 'skip' ? 0 : meal.cal} ккал · {dec(meal.state === 'skip' ? 0 : meal.protein)} г б.</T>
          </View>
          <T w="b" size={18}>{splitDishName(meal.name).title}</T>
          {splitDishName(meal.name).details ? <T size={13} color={C.muted}>{splitDishName(meal.name).details}</T> : null}
          {meal.state === 'todo' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn title="Съела это" kind="accent" style={{ flex: 1 }} onPress={() => update(d => setSlot(d, date, sel, 'plan'))} />
              <Btn title="Не ела" kind="ghost" style={{ flex: 1 }} onPress={() => update(d => setSlot(d, date, sel, 'skip'))} />
            </View>
          ) : (
            <Btn title="Вернуть как в плане" kind="ghost" onPress={() => update(d => setSlot(d, date, sel, null))} />
          )}
          <Btn title="Съела другое — найти или посчитать" kind="clear" onPress={() => setPicker(sel)} />
        </Card>

        {list.length ? <Section title={isCoffee(meal.plan.name) ? 'Готовое: кофе-перекус' : `Готовое: ${meal.cat.toLowerCase()}`} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {list.map((d, i) => (
            <Pressable key={i} onPress={() => update(x => setSlot(x, date, sel, { name: d.name, cal: d.cal, protein: d.protein }))} accessibilityRole="button"
              style={({ pressed }) => ({ width: '48.5%', minHeight: 124, backgroundColor: C.card, borderRadius: 20, padding: 14, gap: 6, opacity: pressed ? 0.7 : 1 })}>
              <T w={d.mine ? 'b' : 's'} size={12} color={d.mine ? C.run : C.muted}>{d.src}</T>
              <T w="b" size={15}>{splitDishName(d.name).title}</T>
              <T size={13} color={C.muted} style={{ marginTop: 'auto' }}>{d.cal} ккал · {dec(d.protein)} г б.</T>
            </Pressable>
          ))}
        </View>

        <Section title="Меню недели" />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {DAY_KEYS.map(k => (
            <Pressable key={k} onPress={() => setDayView(k)} accessibilityRole="button"
              style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: k === weekdayKey(date) ? C.run : 'transparent' }}>
              <T w="b" size={14} color={k === weekdayKey(date) ? C.run : C.ink}>{DAY_SHORT[k]}</T>
            </Pressable>
          ))}
        </View>

        <Section title="Приготовить сегодня вечером" />
        <Card style={{ gap: 10 }}>
          {prepEntries.length ? prepEntries.map(k => (
            <View key={k} style={{ gap: 2 }}>
              <T w="b">{k}</T>
              <T size={14} color={C.muted}>{prep[k].join(', ')}</T>
            </View>
          )) : <T color={C.muted}>На завтра всё быстро — заранее готовить нечего.</T>}
        </Card>

        <Card style={{ marginTop: 12, paddingVertical: 4 }}>
          <Row icon="cart" title="Список покупок на неделю" onPress={() => setShopOpen(true)} />
          <Row icon="pot" title={`Мои блюда: ${(db.myDishes || []).length}`} onPress={() => setMyOpen(true)} top />
        </Card>
      </ScrollView>

      <MealPicker date={date} slot={picker} onClose={() => setPicker(null)} />

      <Sheet visible={!!dayView} onClose={() => setDayView(null)} title={dayView ? DAY_FULL[dayView] : ''}>
        {dayView ? menuDay(mi, dayView).map((m, i) => (
          <View key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: C.line, gap: 2 }}>
            <T w="b" color={C.run}>{i === 1 ? 'Кофе-перекус' : ['Завтрак', '', 'Обед', 'Перекус', 'Ужин'][i]}</T>
            <T>{splitDishName(m.name).title}{splitDishName(m.name).details ? ' — ' + splitDishName(m.name).details : ''}</T>
            <T size={13} color={C.muted}>{m.cal} ккал · {dec(m.protein)} г белка</T>
          </View>
        )) : null}
        {dayView ? <T w="x" color={C.run} style={{ textAlign: 'center' }}>Итого: {menuDay(mi, dayView).reduce((s, m) => s + m.cal, 0)} ккал · {dec(menuDay(mi, dayView).reduce((s, m) => s + (m.protein || 0), 0))} г белка</T> : null}
      </Sheet>

      <Sheet visible={shopOpen} onClose={() => setShopOpen(false)} title="Список покупок">
        {shoppingFor(date).map(([cat, items]) => (
          <View key={cat} style={{ gap: 4 }}>
            <T w="b" size={16} style={{ marginTop: 6 }}>{cat}</T>
            {items.map(([label, amount]) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: C.line }}>
                <T style={{ flex: 1 }}>{label}</T><T w="s" color={C.muted}>{amount}</T>
              </View>
            ))}
          </View>
        ))}
      </Sheet>

      <Sheet visible={myOpen} onClose={() => setMyOpen(false)} title="Мои блюда">
        {(db.myDishes || []).length ? db.myDishes.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
            <View style={{ flex: 1 }}>
              <T w="s">{splitDishName(d.name).title}</T>
              <T size={12} color={C.muted}>{d.cat} · {d.cal} ккал · {dec(d.protein)} г б.</T>
            </View>
            <Pressable accessibilityLabel="Удалить блюдо" hitSlop={10} onPress={() => update(x => ({ ...x, myDishes: x.myDishes.filter((_, j) => j !== i) }))}>
              <Icon name="trash" color={C.muted} />
            </Pressable>
          </View>
        )) : <T color={C.muted}>Пока нет. Когда посчитаете еду по продуктам, нажмите «Запомнить как блюдо».</T>}
      </Sheet>
    </View>
  );
}

function Row({ icon, title, onPress, top }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: top ? 1 : 0, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} color={C.muted} />
      <T w="s" style={{ flex: 1 }}>{title}</T>
      <Icon name="chevron" color={C.muted} size={18} />
    </Pressable>
  );
}
