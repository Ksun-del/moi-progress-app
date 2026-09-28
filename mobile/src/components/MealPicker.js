// Шторка «Что ела?»: по плану / не ела / другое блюдо / посчитать по продуктам
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useStore } from '../store';
import { C } from '../theme';
import { Btn, Field, Sheet, T, Icon } from '../ui';
import {
  dayMeals, catalog, searchCatalog, parseFoodText, splitDishName, setSlot, addExtra, norm, r1, fmt, dec, forSlot,
} from '../logic/core';

export default function MealPicker({ date, slot, onClose }) {
  const { db, update } = useStore();
  const [q, setQ] = useState('');
  const [dishName, setDishName] = useState(null);      // не null — показываем поле «как назвать блюдо»
  const [newProd, setNewProd] = useState(null);         // {n, kcal, p} — форма своего продукта
  const visible = slot !== null && slot !== undefined;
  const meals = db ? dayMeals(db, date) : [];
  const meal = typeof slot === 'number' ? meals[slot] : null;
  const cat = meal ? meal.cat : null;

  const list = useMemo(() => (db ? catalog(db, date) : []), [db, date]);
  const parts = useMemo(() => (q && db ? parseFoodText(db, q) : []), [q, db]);
  const found = parts.filter(p => p.product);
  const catHit = q && list.some(d => norm(d.name).includes(norm(q)));
  const showCalc = q && found.length > 0 && (/\d/.test(q) || parts.length > 1 || !catHit);
  const shown = searchCatalog(list, q);
  const mine = meal ? forSlot(shown, meal) : shown;
  const other = meal ? shown.filter(d => !mine.includes(d)) : [];

  function close() { setQ(''); setDishName(null); setNewProd(null); onClose(); }
  function record(item) {
    update(d => (slot === 'extra' ? addExtra(d, date, item) : setSlot(d, date, slot, item)));
    close();
  }
  function calcItem() {
    const name = found.map(p => `${p.product.n.toLowerCase()} ${p.grams} г`).join(' + ');
    return { name: name[0].toUpperCase() + name.slice(1), cal: found.reduce((s, p) => s + p.cal, 0), protein: r1(found.reduce((s, p) => s + p.protein, 0)) };
  }
  function saveDish() {
    const item = calcItem();
    const title = (dishName || '').trim();
    const full = title && title !== item.name ? `${title} — ${item.name}` : item.name;
    const c = cat || 'Перекус';
    update(d => ({ ...d, myDishes: [...(d.myDishes || []), { cat: c, name: full, cal: item.cal, protein: item.protein }] }));
    record({ ...item, name: full });
  }
  function saveProduct() {
    const kcal = parseFloat(String(newProd.kcal).replace(',', '.'));
    const p = parseFloat(String(newProd.p || '0').replace(',', '.')) || 0;
    if (!newProd.n.trim() || !(kcal >= 0)) return;
    const key = norm(newProd.n).split(/\s+/).filter(w => w.length > 2).map(w => w.slice(0, Math.max(3, w.length - 2)));
    update(d => ({ ...d, myProducts: [...(d.myProducts || []), { n: newProd.n.trim(), k: key.length ? key : [norm(newProd.n)], kcal, p, mine: true }] }));
    setNewProd(null);
  }

  const title = slot === 'extra' ? 'Что ещё съела?' : `${cat || ''} — что ела?`;

  return (
    <Sheet visible={visible} onClose={close} title={title}>
      {meal ? (
        <View style={{ backgroundColor: C.soft, borderRadius: 20, padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13} color={C.muted}>По плану</T>
            <T w="b" size={13}>{meal.plan.cal} ккал · {dec(meal.plan.protein)} г белка</T>
          </View>
          <T w="b" size={17}>{splitDishName(meal.plan.name).title}</T>
          {meal.state === 'custom' ? <T w="s" size={14} color={C.accentText}>Сейчас записано: {splitDishName(meal.name).title} · {meal.cal} ккал</T> : null}
          {splitDishName(meal.plan.name).details ? <T size={13} color={C.muted}>{splitDishName(meal.plan.name).details}</T> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn title="Съела это" kind="accent" style={{ flex: 1 }} onPress={() => record('plan')} />
            <Btn title="Не ела" kind="ghost" style={{ flex: 1 }} onPress={() => record('skip')} />
          </View>
          {meal.state !== 'todo' ? <Btn title="Сбросить отметку" kind="clear" small onPress={() => { update(d => setSlot(d, date, slot, null)); close(); }} /> : null}
        </View>
      ) : null}

      <T w="b" size={13} color={C.muted} style={{ marginTop: 6 }}>{meal ? 'ИЛИ ДРУГОЕ' : 'НАЙТИ ИЛИ ПОСЧИТАТЬ'}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 26, borderWidth: 2, borderColor: C.ink, paddingHorizontal: 16, gap: 8 }}>
        <Icon name="search" color={C.muted} />
        <Field value={q} onChangeText={t => { setQ(t); setDishName(null); }} placeholder="Блюдо или «гречка 150 г, 2 яйца»"
          style={{ flex: 1 }} inputStyle={{ backgroundColor: 'transparent', paddingHorizontal: 0 }} autoCorrect={false} />
      </View>

      {showCalc ? (
        <View style={{ backgroundColor: C.warmBg, borderRadius: 20, padding: 16, gap: 8 }}>
          {parts.map((p, i) => p.product ? (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T style={{ flex: 1 }}>{p.product.n}, {p.grams} г</T><T w="b">{p.cal} ккал</T>
            </View>
          ) : (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <T color={C.bad} style={{ flex: 1 }}>«{p.text}» — не знаю</T>
              <Btn title="Добавить продукт" kind="clear" small onPress={() => setNewProd({ n: p.text.replace(/[\d.,]+.*$/, '').trim(), kcal: '', p: '' })} />
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: C.warmLine }} />
          <T w="x" size={16}>Итого: {fmt(calcItem().cal)} ккал · {dec(calcItem().protein)} г белка</T>
          {dishName === null ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Btn title="Записать" small onPress={() => record(calcItem())} />
              <Btn title="Запомнить как блюдо" kind="clear" small onPress={() => setDishName('')} />
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <Field label="Как назвать блюдо" value={dishName} onChangeText={setDishName} placeholder="Например: Мой обед" autoFocus />
              <Btn title="Сохранить и записать" small onPress={saveDish} />
            </View>
          )}
        </View>
      ) : q && /\d/.test(q) && !found.length ? (
        <View style={{ backgroundColor: C.warmBg, borderRadius: 20, padding: 16, gap: 10 }}>
          <T>Не узнала продукт. Напишите, например: «гречка 150 г» или «2 яйца».</T>
          <Btn title="Добавить свой продукт" kind="clear" small onPress={() => setNewProd({ n: q.replace(/[\d.,]+.*$/, '').trim(), kcal: '', p: '' })} />
        </View>
      ) : null}

      {newProd ? (
        <View style={{ backgroundColor: C.soft, borderRadius: 20, padding: 16, gap: 10 }}>
          <T w="b">Свой продукт (данные с упаковки)</T>
          <Field label="Название" value={newProd.n} onChangeText={n => setNewProd({ ...newProd, n })} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field label="Ккал в 100 г" keyboardType="decimal-pad" value={newProd.kcal} onChangeText={kcal => setNewProd({ ...newProd, kcal })} style={{ flex: 1 }} />
            <Field label="Белок в 100 г" keyboardType="decimal-pad" value={newProd.p} onChangeText={p => setNewProd({ ...newProd, p })} style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn title="Сохранить" small onPress={saveProduct} />
            <Btn title="Отмена" kind="clear" small onPress={() => setNewProd(null)} />
          </View>
        </View>
      ) : null}

      <DishList title={cat ? `Готовое: ${cat.toLowerCase()}` : 'Готовые блюда'} items={mine} onPick={d => record({ name: d.name, cal: d.cal, protein: d.protein })} />
      <DishList title="Другое" items={other} onPick={d => record({ name: d.name, cal: d.cal, protein: d.protein })} />
      {!shown.length && !showCalc ? <T color={C.muted}>Ничего не нашлось. Можно написать продукты с граммами — посчитаю.</T> : null}
    </Sheet>
  );
}

function DishList({ title, items, onPick }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 0 }}>
      <T w="b" size={13} color={C.muted} style={{ marginTop: 8, marginBottom: 4 }}>{title.toUpperCase()}</T>
      {items.map((d, i) => {
        const sp = splitDishName(d.name);
        return (
          <Pressable key={i} onPress={() => onPick(d)} accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ flex: 1, gap: 2 }}>
              <T w="s">{sp.title}</T>
              <T size={12} color={C.muted}>{sp.details ? sp.details + ' · ' : ''}{d.src}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T w="b">{d.cal}</T>
              <T size={12} color={C.muted}>{dec(d.protein)} г б.</T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
