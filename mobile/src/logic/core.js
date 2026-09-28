// Вся «математика» приложения: даты, меню, что съедено, норма калорий, подсказка на ужин.
// Здесь нет ничего от React — поэтому это можно проверить тестами (scripts/test-logic.js).
import { MENUS, SHOPPING, PREP } from '../data/menus';
import { PRODUCTS, RATION_DISHES } from '../data/foods';

// ---------- Даты ----------
export function localDate(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export const today = () => localDate(new Date());
export function parseDate(s) { return new Date(s + 'T00:00:00'); }
export function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return localDate(d); }
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const DAY_SHORT = { monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср', thursday: 'Чт', friday: 'Пт', saturday: 'Сб', sunday: 'Вс' };
export const DAY_FULL = { monday: 'Понедельник', tuesday: 'Вторник', wednesday: 'Среда', thursday: 'Четверг', friday: 'Пятница', saturday: 'Суббота', sunday: 'Воскресенье' };
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export function weekdayKey(s) { return WEEKDAY_KEYS[parseDate(s).getDay()]; }
export function humanDate(s) { const d = parseDate(s); return `${DAY_FULL[weekdayKey(s)]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; }
export function shortDate(s) { const d = parseDate(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; }
export function r1(x) { return Math.round((x || 0) * 10) / 10; }
// Число с запятой: 14.4 → «14,4»
export function dec(x) { return String(r1(x)).replace('.', ','); }
export function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
export function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
export function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few;
  return many;
}

// ---------- Настройки по умолчанию ----------
export const DEFAULT_SETTINGS = {
  start: 66, target: 58,
  normal: 1500,          // норма ккал в день без тренировки
  exerciseShare: 50,     // сколько % сожжённого на тренировке добавлять к норме
  protein: 110,
  waterGoal: 8,
  weightDays: 7, measureDays: 28,
  waterEnabled: false, waterHours: 2,
};
export function emptyDb() {
  return { workouts: [], food: [], measure: [], settings: { ...DEFAULT_SETTINGS }, waterLog: [], customReminders: [], eaten: {}, myDishes: [], myProducts: [] };
}
// Приводит сохранённые данные (в т.ч. из старой версии-сайта) к нынешнему виду
export function normalizeDb(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const db = { ...emptyDb(), ...d };
  db.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
  for (const k of ['workouts', 'food', 'measure', 'waterLog', 'customReminders', 'myDishes', 'myProducts']) if (!Array.isArray(db[k])) db[k] = [];
  if (!db.eaten || typeof db.eaten !== 'object') db.eaten = {};
  delete db.weekMenu;
  return db;
}

// ---------- Меню (3 меню по очереди, по неделям) ----------
const ROTATION_START = new Date('2026-01-05T00:00:00');
export function menuIndex(s) {
  const w = Math.floor((parseDate(s) - ROTATION_START) / (7 * 86400000));
  return ((w % 3) + 3) % 3;
}
export function planFor(s) { return (MENUS[menuIndex(s)][weekdayKey(s)] || { meals: [] }).meals; }
export function menuDay(idx, key) { return MENUS[idx][key].meals; }
export function shoppingFor(s) { return SHOPPING[menuIndex(s)]; }
export function prepFor(s) { return PREP[menuIndex(s)][weekdayKey(s)] || {}; }

export function mealCategory(name) {
  const m = String(name || '').match(/^\s*(Завтрак|Обед|Перекус|Ужин)\s*:/i);
  return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : 'Перекус';
}
export function splitDishName(name) {
  const s = String(name || '').replace(/^\s*(Завтрак|Обед|Перекус|Ужин)\s*:\s*/i, '');
  const i = s.indexOf(' — ');
  return i > 0 ? { title: s.slice(0, i), details: s.slice(i + 3) } : { title: s, details: '' };
}

// ---------- Что съедено за день ----------
// db.eaten[date].slots[i]: нет ключа — ещё не отмечено; 'plan' — съела по плану;
// 'skip' — не ела; {name, cal, protein} — съела другое.
// Для прошедших дней неотмеченное считается «по плану» (как раньше).
export function dayMeals(db, date, now = today()) {
  const plan = planFor(date);
  const e = (db.eaten && db.eaten[date]) || { slots: {}, extras: [] };
  const past = date < now;
  return plan.map((pm, i) => {
    const o = e.slots ? e.slots[i] : undefined;
    const base = { index: i, cat: mealCategory(pm.name), plan: pm };
    if (o === 'skip') return { ...base, state: 'skip', name: pm.name, cal: 0, protein: 0 };
    if (o && typeof o === 'object') return { ...base, state: 'custom', name: o.name, cal: o.cal || 0, protein: o.protein || 0 };
    if (o === 'plan' || past) return { ...base, state: 'eaten', name: pm.name, cal: pm.cal || 0, protein: pm.protein || 0 };
    return { ...base, state: 'todo', name: pm.name, cal: pm.cal || 0, protein: pm.protein || 0 };
  });
}
export function dayTotals(db, date, now = today()) {
  const meals = dayMeals(db, date, now);
  const e = (db.eaten && db.eaten[date]) || { extras: [] };
  let kcal = 0, protein = 0, planLeftKcal = 0, planLeftProtein = 0;
  for (const m of meals) {
    if (m.state === 'eaten' || m.state === 'custom') { kcal += m.cal; protein += m.protein; }
    if (m.state === 'todo') { planLeftKcal += m.cal; planLeftProtein += m.protein; }
  }
  for (const x of e.extras || []) { kcal += x.cal || 0; protein += x.protein || 0; }
  const changed = meals.some(m => m.state === 'custom' || m.state === 'skip') || (e.extras || []).length > 0;
  return { kcal: Math.round(kcal), protein: r1(protein), planLeftKcal, planLeftProtein: r1(planLeftProtein), changed, meals, extras: e.extras || [] };
}

// ---------- Тренировки и норма ----------
// MET — во сколько раз тренировка «дороже» покоя. Нужен, если часы не прислали калории.
const MET = { run: 9.8, walk: 3.8, strength: 5, hiit: 8, bike: 7.5, swim: 7, yoga: 2.8, cardio: 7, other: 5 };
export const WORKOUT_KINDS = {
  run: 'Бег', walk: 'Ходьба', strength: 'Силовая', hiit: 'Интервальная', bike: 'Велосипед',
  swim: 'Плавание', yoga: 'Йога / растяжка', cardio: 'Кардио', other: 'Тренировка',
};
// Старые записи из версии-сайта: type был строкой по-русски
const OLD_TYPES = {
  'Бег на улице': 'run', 'Беговая дорожка': 'run', 'Кор-тренировка': 'strength', 'Силовая тренировка': 'strength',
  'Тренировка с гантелями': 'strength', 'Кардио': 'cardio', 'Интервальная': 'hiit', 'Другое': 'other',
};
export function workoutKind(w) { return w.kind || OLD_TYPES[w.type] || 'other'; }
export function workoutTitle(w) { return w.title || w.type && !OLD_TYPES[w.type] && w.type || WORKOUT_KINDS[workoutKind(w)]; }
export function currentWeight(db) {
  const m = [...db.measure].filter(x => x.weight).sort((a, b) => b.date.localeCompare(a.date))[0];
  return m ? m.weight : db.settings.start || 65;
}
// Активные калории тренировки: от часов, иначе оценка по MET, весу и длительности
export function workoutKcal(db, w) {
  if (w.kcal > 0) return Math.round(w.kcal);
  const min = Number(w.duration) || 0;
  return Math.round((MET[workoutKind(w)] - 1) * currentWeight(db) * min / 60);
}
export function workoutsOn(db, date) { return db.workouts.filter(w => w.date === date); }
export function dayTarget(db, date) {
  const burned = workoutsOn(db, date).reduce((s, w) => s + workoutKcal(db, w), 0);
  const bonus = Math.round(burned * (db.settings.exerciseShare ?? 50) / 100 / 10) * 10;
  return { base: db.settings.normal, burned, bonus, total: db.settings.normal + bonus };
}

// ---------- Каталог блюд ----------
export function catalog(db, date = today()) {
  const list = [], seen = new Set();
  const add = (d) => { const k = norm(d.name); if (seen.has(k)) return; seen.add(k); list.push(d); };
  (db.myDishes || []).forEach(d => add({ ...d, src: 'Моё блюдо', mine: true }));
  const cur = menuIndex(date);
  [cur, (cur + 1) % 3, (cur + 2) % 3].forEach(mi => DAY_KEYS.forEach(k => (MENUS[mi][k]?.meals || []).forEach(m =>
    add({ cat: mealCategory(m.name), name: m.name, cal: m.cal || 0, protein: m.protein || 0, src: `Меню ${mi + 1} · ${DAY_SHORT[k]}` }))));
  RATION_DISHES.forEach(d => add({ ...d, src: 'Рацион 9 дней' }));
  return list;
}
// Кофе с орешками — отдельный «приём», не смешиваем его с настоящими перекусами
export const isCoffee = (name) => /^\s*кофе/i.test(splitDishName(name).title);
export function forSlot(list, meal) {
  if (!meal) return list;
  const coffee = isCoffee(meal.plan.name);
  return list.filter(d => d.cat === meal.cat && isCoffee(d.name) === coffee);
}
export function searchCatalog(list, q) {
  const words = norm(q).replace(/[\d.,]+\s*(г|гр|мл|шт)?/g, ' ').split(/\s+/).filter(w => w.length > 1);
  return list.filter(d => words.every(w => norm(d.name).includes(w.slice(0, Math.max(3, w.length - 2)))));
}

// ---------- Подсказка на ужин ----------
// Считаем, сколько ккал и белка останется после уже съеденного и оставшихся (не ужин) приёмов по плану,
// и подбираем ужины, которые укладываются в калории и лучше всего добирают белок.
export function dinnerAdvice(db, date = today()) {
  const t = dayTotals(db, date);
  const dinner = t.meals.find(m => m.cat === 'Ужин');
  if (!dinner || dinner.state !== 'todo') return null;
  const target = dayTarget(db, date).total;
  const otherLeft = t.meals.filter(m => m.state === 'todo' && m !== dinner);
  const reservedK = otherLeft.reduce((s, m) => s + m.cal, 0);
  const reservedP = otherLeft.reduce((s, m) => s + m.protein, 0);
  const kcalLeft = Math.round(target - t.kcal - reservedK);
  const proteinLeft = Math.max(0, Math.round(db.settings.protein - t.protein - reservedP));
  const options = catalog(db, date).filter(d => d.cat === 'Ужин' && d.cal <= kcalLeft + 40 && d.cal >= Math.min(200, kcalLeft * 0.4));
  const score = (d) => Math.abs(Math.min(d.protein, proteinLeft + 10) - proteinLeft) * 8 + Math.abs(kcalLeft - d.cal) * 0.15 - (d.mine ? 20 : 0);
  options.sort((a, b) => score(a) - score(b));
  const uniq = [], titles = new Set();
  for (const o of options) { const k = norm(splitDishName(o.name).title); if (!titles.has(k)) { titles.add(k); uniq.push(o); } }
  return { kcalLeft, proteinLeft, options: uniq.slice(0, 2), planDinner: dinner.plan };
}

// ---------- Подсчёт по продуктам: «гречка 150 г, 2 яйца» ----------
export function findProduct(db, text) {
  const t = norm(text);
  let best = null, bestScore = 0;
  [...(db.myProducts || []), ...PRODUCTS].forEach(pr => {
    const keys = pr.k || [norm(pr.n)];
    if (keys.every(k => t.includes(k))) {
      const score = keys.reduce((s, k) => s + k.length, 0) + (pr.mine ? 100 : 0);
      if (score > bestScore) { best = pr; bestScore = score; }
    }
  });
  return best;
}
export function parseFoodText(db, text) {
  return String(text || '').split(/[,;\n]|\s\+\s/).map(s => s.trim()).filter(Boolean).map(part => {
    const t = norm(part);
    const numM = t.match(/(\d+(?:[.,]\d+)?)\s*(кг|г|гр|грамм\S*|мл|л|шт\S*|ст\.?\s*л\S*|ч\.?\s*л\S*|ложк\S*)?(?![а-я])/);
    const product = findProduct(db, numM ? t.replace(numM[0], ' ') : t);
    if (!product) return { text: part, product: null };
    const n = numM ? parseFloat(numM[1].replace(',', '.')) : null;
    const unit = numM ? (numM[2] || '') : '';
    let grams;
    if (n == null) grams = product.pc || 100;
    else if (/^кг/.test(unit) || /^л$/.test(unit)) grams = n * 1000;
    else if (/^(г|гр|грамм|мл)/.test(unit)) grams = n;
    else if (/^шт/.test(unit)) grams = n * (product.pc || 100);
    else if (/^ст/.test(unit) || /^ложк/.test(unit)) grams = n * (product.tb || 15);
    else if (/^ч/.test(unit)) grams = n * Math.round((product.tb || 15) / 3);
    else grams = (product.pc && n <= 12) ? n * product.pc : n;
    return { text: part, product, grams: Math.round(grams), cal: Math.round(product.kcal * grams / 100), protein: r1(product.p * grams / 100) };
  });
}

// ---------- Изменения данных (возвращают новый db) ----------
function withDay(db, date, fn) {
  const eaten = { ...(db.eaten || {}) };
  const day = { slots: { ...((eaten[date] || {}).slots || {}) }, extras: [...((eaten[date] || {}).extras || [])] };
  fn(day);
  eaten[date] = day;
  return syncFood({ ...db, eaten }, date);
}
export function setSlot(db, date, index, value) {
  return withDay(db, date, d => { if (value == null) delete d.slots[index]; else d.slots[index] = value; });
}
export function addExtra(db, date, item) { return withDay(db, date, d => { d.extras.push(item); }); }
export function removeExtra(db, date, i) { return withDay(db, date, d => { d.extras.splice(i, 1); }); }
// Запись дня в db.food — для истории и совместимости со старой версией
export function syncFood(db, date) {
  const t = dayTotals(db, date);
  const item = { date, status: t.changed ? 'changed' : 'yes', kcal: t.kcal, protein: t.protein };
  const food = db.food.filter(x => x.date !== date).concat(item);
  return { ...db, food };
}
export function waterCount(db, date) { return (db.waterLog || []).filter(ts => localDate(new Date(ts)) === date).length; }
export function addWater(db) { return { ...db, waterLog: [...db.waterLog, new Date().toISOString()] }; }
export function undoWater(db) {
  const t = today(), log = [...db.waterLog];
  for (let i = log.length - 1; i >= 0; i--) if (localDate(new Date(log[i])) === t) { log.splice(i, 1); break; }
  return { ...db, waterLog: log };
}
// Тренировки с часов: добавляем новые и обновляем уже известные (по id записи в Health Connect)
export function mergeWatchWorkouts(db, list) {
  const byId = new Map(db.workouts.filter(w => w.hcId).map(w => [w.hcId, w]));
  let changed = false;
  const workouts = db.workouts.map(w => {
    const n = w.hcId && list.find(x => x.hcId === w.hcId);
    if (n && (n.kcal !== w.kcal || n.duration !== w.duration || n.distanceKm !== w.distanceKm)) { changed = true; return { ...w, ...n }; }
    return w;
  });
  for (const n of list) if (!byId.has(n.hcId)) { workouts.push(n); changed = true; }
  return changed ? { ...db, workouts } : db;
}

// ---------- Для экрана «Прогресс» ----------
export function sortedMeasures(db) { return [...db.measure].sort((a, b) => b.date.localeCompare(a.date)); }
export function weekStats(db, date = today()) {
  const d = parseDate(date); const dow = (d.getDay() + 6) % 7;
  const monday = addDays(date, -dow);
  const days = DAY_KEYS.map((k, i) => {
    const ds = addDays(monday, i);
    const kcal = workoutsOn(db, ds).reduce((s, w) => s + workoutKcal(db, w), 0);
    return { key: k, date: ds, kcal, has: workoutsOn(db, ds).length > 0, future: ds > date };
  });
  const past = days.filter(x => !x.future);
  const foodDays = past.filter(x => x.date < date).map(x => dayTotals(db, x.date, date).kcal).filter(k => k > 0);
  return {
    days,
    count: past.reduce((s, x) => s + workoutsOn(db, x.date).length, 0),
    burned: past.reduce((s, x) => s + x.kcal, 0),
    avgKcal: foodDays.length ? Math.round(foodDays.reduce((a, b) => a + b, 0) / foodDays.length) : 0,
  };
}
