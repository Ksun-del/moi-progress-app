import assert from 'node:assert';
import * as L from '../src/logic/core.js';
import { planReminders } from '../src/logic/reminders.js';

const at = (s) => new Date(s);
const hm = (d) => `${d.getDate()}.${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };

// ---------- Напоминания ----------
ok('вода: каждые 2 часа после отметки', () => {
  const p = planReminders({ waterEnabled: true, waterHours: 2, lastWaterLog: at('2026-09-28T10:00:00').toISOString() }, at('2026-09-28T10:30:00'));
  assert.deepStrictEqual(p.map(r => hm(r.at)), ['28.9 12:00', '28.9 14:00', '28.9 16:00']);
});
ok('вода: ночью не будим', () => {
  const p = planReminders({ waterEnabled: true, waterHours: 2, lastWaterLog: at('2026-09-28T21:30:00').toISOString() }, at('2026-09-28T21:40:00'));
  assert.ok(p.every(r => r.at.getHours() >= 8 && r.at.getHours() < 23));
});
ok('взвешивание и замеры в 9:00', () => {
  const p = planReminders({ lastWeightLog: '2026-09-22', weightDays: 7, lastMeasureLog: '2026-09-01', measureDays: 28 }, at('2026-09-28T20:00:00'));
  assert.deepStrictEqual(p.map(r => hm(r.at)), ['29.9 09:00', '29.9 09:00']);
});

// ---------- Данные ----------
const TODAY = '2026-09-28';
function freshDb() { return L.normalizeDb({ settings: { normal: 1500, protein: 110, exerciseShare: 50 }, measure: [{ date: '2026-09-20', weight: 64 }] }); }

ok('старые данные из версии-сайта читаются', () => {
  const old = { workouts: [{ date: TODAY, type: 'Бег на улице', duration: '40', feel: 'Отлично' }], food: [], measure: [], settings: { start: 66, target: 58, normal: 1500, train: 1700, protein: 110 }, weekMenu: {}, waterLog: [] };
  const db = L.normalizeDb(old);
  assert.equal(db.weekMenu, undefined);
  assert.equal(db.settings.exerciseShare, 50);
  assert.equal(L.workoutKind(db.workouts[0]), 'run');
  assert.ok(L.workoutKcal(db, db.workouts[0]) > 300, 'бег 40 мин оценивается по MET');
});

ok('сегодня: не отмеченное не считается съеденным, прошедший день — считается по плану', () => {
  const db = freshDb();
  assert.equal(L.dayTotals(db, TODAY, TODAY).kcal, 0);
  const past = L.dayTotals(db, '2026-09-27', TODAY);
  assert.ok(past.kcal > 1400 && past.kcal < 1600, 'прошедший день ≈ план ' + past.kcal);
});

ok('отметки: по плану, не ела, замена, ещё', () => {
  let db = freshDb();
  const plan = L.planFor(TODAY);
  db = L.setSlot(db, TODAY, 0, 'plan');
  db = L.setSlot(db, TODAY, 1, 'skip');
  db = L.setSlot(db, TODAY, 2, { name: 'Гречка + индейка', cal: 560, protein: 46 });
  db = L.addExtra(db, TODAY, { name: 'Банан', cal: 115, protein: 1.8 });
  const t = L.dayTotals(db, TODAY, TODAY);
  assert.equal(t.kcal, Math.round(plan[0].cal + 560 + 115));
  assert.equal(t.meals[1].state, 'skip');
  assert.equal(db.food.find(f => f.date === TODAY).status, 'changed');
  db = L.removeExtra(db, TODAY, 0);
  assert.equal(L.dayTotals(db, TODAY, TODAY).extras.length, 0);
});

ok('норма растёт на половину сожжённого с часов', () => {
  let db = freshDb();
  db = L.mergeWatchWorkouts(db, [{ hcId: 'a1', source: 'watch', date: TODAY, kind: 'run', duration: 42, kcal: 380, distanceKm: 5.1 }]);
  const t = L.dayTarget(db, TODAY);
  assert.deepStrictEqual([t.burned, t.bonus, t.total], [380, 190, 1690]);
  // повторная синхронизация не дублирует, а обновляет
  db = L.mergeWatchWorkouts(db, [{ hcId: 'a1', source: 'watch', date: TODAY, kind: 'run', duration: 42, kcal: 400, distanceKm: 5.1 }]);
  assert.equal(db.workouts.length, 1);
  assert.equal(L.dayTarget(db, TODAY).bonus, 200);
  db = { ...db, settings: { ...db.settings, exerciseShare: 0 } };
  assert.equal(L.dayTarget(db, TODAY).total, 1500);
});

ok('подсказка на ужин укладывается в остаток и добирает белок', () => {
  const TODAY = L.today(); // подсказка бывает только на сегодня
  let db = freshDb();
  db = L.mergeWatchWorkouts(db, [{ hcId: 'a1', source: 'watch', date: TODAY, kind: 'run', duration: 42, kcal: 380 }]);
  db = L.setSlot(db, TODAY, 0, 'plan'); db = L.setSlot(db, TODAY, 1, 'plan'); db = L.setSlot(db, TODAY, 2, 'plan');
  const a = L.dinnerAdvice(db, TODAY);
  assert.ok(a, 'есть подсказка');
  assert.ok(a.kcalLeft > 0);
  assert.ok(a.options.length >= 1, 'есть варианты');
  for (const o of a.options) { assert.equal(o.cat, 'Ужин'); assert.ok(o.cal <= a.kcalLeft + 40); }
  console.log('   остаток', a.kcalLeft, 'ккал,', a.proteinLeft, 'г белка →', a.options.map(o => `${L.splitDishName(o.name).title} (${o.cal}/${o.protein})`).join('; '));
  // ужин отмечен — подсказки нет
  db = L.setSlot(db, TODAY, 4, 'plan');
  assert.equal(L.dinnerAdvice(db, TODAY), null);
});

ok('подсчёт по продуктам', () => {
  const db = freshDb();
  const p = L.parseFoodText(db, 'гречка варёная 150 г, 2 яйца, арахисовая паста 1 ст.л., банан');
  assert.deepStrictEqual(p.map(x => [x.product.n, x.grams]), [['Гречка варёная', 150], ['Яйцо', 110], ['Арахисовая паста', 16], ['Банан', 120]]);
  assert.equal(L.parseFoodText(db, 'непонятное 50 г')[0].product, null);
});

ok('вода и неделя', () => {
  let db = freshDb();
  db = L.addWater(db); db = L.addWater(db); db = L.undoWater(db);
  assert.equal(L.waterCount(db, L.today()), 1);
  const w = L.weekStats(db, TODAY);
  assert.equal(w.days.length, 7);
});

ok('тренировки с часов сами не добавляются, только обновляются', () => {
  let db = freshDb();
  const w = { hcId: 'w1', source: 'watch', date: TODAY, start: TODAY + 'T08:00:00Z', kind: 'walk', duration: 30, kcal: 90 };
  db = L.mergeWatchWorkouts(db, [w], false);
  assert.equal(db.workouts.length, 0);
  assert.equal(L.newWatchWorkouts(db, [w]).length, 1);
  db = L.mergeWatchWorkouts(db, [w], true);
  assert.equal(db.workouts.length, 1);
  assert.equal(L.newWatchWorkouts(db, [w]).length, 0);
  db = L.mergeWatchWorkouts(db, [{ ...w, kcal: 120 }], false);
  assert.equal(db.workouts[0].kcal, 120);
  db = L.removeWorkout(db, db.workouts[0]);
  assert.equal(db.workouts.length, 0);
  // старая автоматически добавленная ходьба убирается один раз
  const old = L.normalizeDb({ workouts: [w, { ...w, hcId: 'r1', kind: 'run' }, { date: TODAY, kind: 'walk', duration: 20, source: 'manual' }] });
  assert.deepStrictEqual(old.workouts.map(x => x.hcId || 'manual'), ['r1', 'manual']);
  const again = L.normalizeDb({ ...old, workouts: [...old.workouts, w] });
  assert.equal(again.workouts.length, 3);
});

ok('тарелка: несколько продуктов в одну запись', () => {
  const db = freshDb();
  const p = L.parseFoodText(db, 'лепешка фарш и овощи');
  assert.deepStrictEqual(p.map(x => x.product.n), ['Лепёшка пшеничная', 'Фарш (свинина + говядина)', 'Овощи свежие']);
  assert.deepStrictEqual(L.parseFoodText(db, 'говяжий фарш 100 г').map(x => x.product.n), ['Говяжий фарш']);
  assert.deepStrictEqual(L.parseFoodText(db, 'молоко 3,2% 200 мл').map(x => [x.product.n, x.grams]), [['Молоко 3,2%', 200]]);
  assert.equal(L.parseFoodText(db, 'творог 5%')[0].grams, 100);
  const t = L.plateTotal([{ name: 'Гречка варёная 150 г', cal: 165, protein: 6.3 }, { name: 'Обед: Куриная грудка — 120 г', cal: 164, protein: 35.8 }]);
  assert.deepStrictEqual(t, { name: 'Гречка варёная 150 г + куриная грудка', cal: 329, protein: 42.1 });
  assert.equal(L.plateTotal([{ name: 'Борщ', cal: 250, protein: 10 }]).name, 'Борщ');
  assert.equal(L.plateTotal([{ name: 'Борщ', cal: 250, protein: 10 }], 'Мой обед').name, 'Мой обед — Борщ');
});

ok('крупы по умолчанию — готовые, сухие — только со словом «сухой»/«хлопья»', () => {
  const db = freshDb();
  const n = (q) => L.parseFoodText(db, q)[0].product.n;
  assert.equal(n('овсянка 200'), 'Овсянка готовая (на воде)');
  assert.equal(n('пшенка 200'), 'Пшённая каша готовая (на воде)');
  assert.equal(n('гречка 100'), 'Гречка варёная');
  assert.equal(n('овсяные хлопья 40'), 'Овсяные хлопья (сухие)');
  assert.equal(n('гречка сухая 50'), 'Гречка сухая');
});

// ---------- «✓ Выпила» ----------
ok('свои напоминания: без строчки «Напоминание из приложения», с кнопкой (rid)', () => {
  const p = planReminders({ customReminders: [{ id: 'a1', name: 'Витамин D', type: 'daily', time: '09:30' }] }, at('2026-10-01T08:00:00'));
  assert.equal(p.length, 1);
  assert.equal(p[0].title, '💊 Витамин D');
  assert.equal(p[0].body, '');
  assert.equal(p[0].rid, 'a1');
});
ok('отметка «выпила»: ежедневное — запись времени, «каждые N часов» — отсчёт заново', () => {
  let db = L.normalizeDb({ customReminders: [{ id: 'a', name: 'D', type: 'daily', time: '09:00' }, { id: 'b', name: 'X', type: 'interval', hours: 8, lastLog: '2026-10-01T00:00:00.000Z' }] });
  const t = at('2026-10-01T09:05:00');
  db = L.markReminderDone(L.markReminderDone(db, 'a', t), 'b', t);
  assert.deepStrictEqual(L.doneTimes(db.customReminders[0], '2026-10-01'), ['9:05']);
  assert.equal(db.customReminders[1].lastLog, t.toISOString());
  assert.equal(L.markReminderDone(db, 'нет такого', t), db);
});

console.log(`\nВсе проверки пройдены: ${n} ✓`);
