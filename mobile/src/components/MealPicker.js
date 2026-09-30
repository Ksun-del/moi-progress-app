// Шторка «Что ела?»: по плану / не ела / собрать «тарелку» из продуктов и блюд
// Тарелка: добавляешь по одному («гречка 150», потом «курица 120»), всё складывается в одну запись.
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { C, F } from '../theme';
import { Btn, Field, Sheet, T, Icon, Round } from '../ui';
import {
  dayMeals, catalog, searchCatalog, parseFoodText, splitDishName, setSlot, addExtra, norm, r1, fmt, dec, forSlot, plateTotal,
} from '../logic/core';

// Элемент тарелки: продукт (можно менять граммы) или готовое блюдо
function fromProduct(p) { return { prod: p.product, grams: p.grams }; }
function fromDish(d) { return { name: d.name, cal: d.cal, protein: d.protein }; }
function itemValue(x) {
  if (!x.prod) return x;
  const g = Number(x.grams) || 0;
  return { name: `${x.prod.n} ${g} г`, cal: Math.round(x.prod.kcal * g / 100), protein: r1(x.prod.p * g / 100) };
}

export default function MealPicker({ date, slot, onClose }) {
  const { db, update } = useStore();
  const [q, setQ] = useState('');
  const [plate, setPlate] = useState([]);
  const [dishName, setDishName] = useState(null);      // не null — показываем поле «как назвать блюдо»
  const [newProd, setNewProd] = useState(null);         // {n, kcal, p} — форма своего продукта
  const visible = slot !== null && slot !== undefined;
  const meals = db ? dayMeals(db, date) : [];
  const meal = typeof slot === 'number' ? meals[slot] : null;
  const cat = meal ? meal.cat : null;

  const list = useMemo(() => (db ? catalog(db, date) : []), [db, date]);
  const parts = useMemo(() => (q && db ? parseFoodText(db, q) : []), [q, db]);
  const found = parts.filter(p => p.product);
  const shown = searchCatalog(list, q);
  const mine = meal ? forSlot(shown, meal) : shown;
  const other = meal ? shown.filter(d => !mine.includes(d)) : [];
  const values = plate.map(itemValue);
  const total = plateTotal(values);

  function close() { setQ(''); setPlate([]); setDishName(null); setNewProd(null); onClose(); }
  function record(item) {
    update(d => (slot === 'extra' ? addExtra(d, date, item) : setSlot(d, date, slot, item)));
    close();
  }
  function addToPlate(items) { setPlate(p => [...p, ...items]); setQ(''); setDishName(null); }
  function setGrams(i, v) { setPlate(p => p.map((x, j) => (j === i ? { ...x, grams: v.replace(/\D/g, '') } : x))); }
  function removeItem(i) { setPlate(p => p.filter((_, j) => j !== i)); }
  function saveDish() {
    const item = plateTotal(values, dishName);
    const c = cat || 'Перекус';
    update(d => ({ ...d, myDishes: [...(d.myDishes || []), { cat: c, name: item.name, cal: item.cal, protein: item.protein }] }));
    record(item);
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

  const footer = plate.length ? (
    <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderColor: C.line }}>
      {dishName === null ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title={`Записать · ${fmt(total.cal)} ккал`} kind="accent" style={{ flex: 1 }} onPress={() => record(total)} />
          <Btn title="Запомнить" kind="ghost" onPress={() => setDishName('')} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Field label="Как назвать блюдо (появится в списке готовых)" value={dishName} onChangeText={setDishName} placeholder="Например: Гречка с курицей" autoFocus />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn title="Сохранить и записать" kind="accent" style={{ flex: 1 }} onPress={saveDish} />
            <Btn title="Отмена" kind="clear" onPress={() => setDishName(null)} />
          </View>
        </View>
      )}
    </View>
  ) : null;

  return (
    <Sheet visible={visible} onClose={close} title={title} footer={footer}>
      {meal && !plate.length ? (
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

      {plate.length ? (
        <View style={{ backgroundColor: C.warmBg, borderRadius: 20, padding: 16, gap: 4 }}>
          <T w="b" size={13} color={C.muted}>В ТАРЕЛКЕ</T>
          {plate.map((x, i) => {
            const v = values[i];
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderColor: C.warmLine }}>
                <T w="s" style={{ flex: 1 }}>{x.prod ? x.prod.n : splitDishName(x.name).title}</T>
                {x.prod ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TextInput value={String(x.grams)} onChangeText={t => setGrams(i, t)} keyboardType="number-pad" selectTextOnFocus
                      accessibilityLabel={`Граммы: ${x.prod.n}`}
                      style={{ width: 58, height: 38, borderRadius: 10, backgroundColor: C.card, textAlign: 'center', fontFamily: F.s, fontSize: 15, color: C.ink, padding: 0 }} />
                    <T size={13} color={C.muted}>г</T>
                  </View>
                ) : null}
                <T w="b" style={{ minWidth: 44, textAlign: 'right' }}>{v.cal}</T>
                <Round label="Убрать" size={32} bg={C.card} onPress={() => removeItem(i)}><Icon name="close" size={12} color={C.muted} /></Round>
              </View>
            );
          })}
          <View style={{ height: 1, backgroundColor: C.warmLine, marginTop: 4 }} />
          <T w="x" size={16} style={{ paddingTop: 6 }}>Итого: {fmt(total.cal)} ккал · {dec(total.protein)} г белка</T>
        </View>
      ) : null}

      <T w="b" size={13} color={C.muted} style={{ marginTop: 6 }}>{plate.length ? 'ДОБАВИТЬ ЕЩЁ' : meal ? 'ИЛИ ДРУГОЕ' : 'НАЙТИ ИЛИ ПОСЧИТАТЬ'}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 26, borderWidth: 2, borderColor: C.ink, paddingHorizontal: 16, gap: 8 }}>
        <Icon name="search" color={C.muted} />
        <Field value={q} onChangeText={setQ} placeholder="Продукт или блюдо: «гречка 150»"
          style={{ flex: 1 }} inputStyle={{ backgroundColor: 'transparent', paddingHorizontal: 0 }} autoCorrect={false} />
      </View>
      {!q && !plate.length ? <T size={13} color={C.muted}>Ела несколько продуктов (гречка + курица)? Добавляйте по одному — всё сложится в одну запись. Граммы можно поправить потом.</T> : null}

      {q && parts.length ? (
        <View style={{ backgroundColor: C.soft, borderRadius: 20, padding: 16, gap: 8 }}>
          {parts.map((p, i) => p.product ? (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T style={{ flex: 1 }}>{p.product.n}, {p.grams} г</T><T w="b">{p.cal} ккал</T>
            </View>
          ) : (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <T color={C.muted} style={{ flex: 1 }}>«{p.text}» — нет в базе продуктов</T>
              <Btn title="Добавить продукт" kind="clear" small onPress={() => setNewProd({ n: p.text.replace(/[\d.,]+.*$/, '').trim(), kcal: '', p: '' })} />
            </View>
          ))}
          {found.length ? <Btn title={found.length > 1 ? `+ Добавить ${found.length} в тарелку` : '+ Добавить в тарелку'} small onPress={() => addToPlate(found.map(fromProduct))} /> : null}
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

      <DishList title={cat ? `Готовое: ${cat.toLowerCase()}` : 'Готовые блюда'} items={mine} onPick={d => addToPlate([fromDish(d)])} />
      <DishList title="Другое" items={other} onPick={d => addToPlate([fromDish(d)])} />
      {q && !shown.length && !found.length ? <T color={C.muted}>Ничего не нашлось. Напишите продукт с граммами, например «курица 120», или добавьте свой продукт.</T> : null}
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
          <Pressable key={i} onPress={() => onPick(d)} accessibilityRole="button" accessibilityHint="Добавить в тарелку"
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
