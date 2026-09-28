// Проверка расчёта напоминаний: node scripts/test-reminders.js
const assert = require('assert');
const { planReminders } = require('../reminders');
const at = (s) => new Date(s);
const fmt = (d) => `${d.getDate()}.${d.getMonth()+1} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

// 1. Вода: отметила в 10:00, каждые 2 часа -> 12:00, 14:00, 16:00
let p = planReminders({ waterEnabled: true, waterHours: 2, lastWaterLog: at('2026-09-28T10:00:00').toISOString() }, at('2026-09-28T10:30:00'));
assert.deepStrictEqual(p.map(r => fmt(r.at)), ['28.9 12:00', '28.9 14:00', '28.9 16:00']);

// 2. Вода поздно вечером: не будить ночью, перенести на 8:00
p = planReminders({ waterEnabled: true, waterHours: 2, lastWaterLog: at('2026-09-28T21:30:00').toISOString() }, at('2026-09-28T21:40:00'));
assert.ok(p.every(r => r.at.getHours() >= 8 && r.at.getHours() < 23), 'ночью не напоминаем: ' + p.map(r => fmt(r.at)));
assert.strictEqual(fmt(p[0].at), '29.9 08:00');

// 3. Вода выключена — ничего
assert.strictEqual(planReminders({ waterEnabled: false, waterHours: 2, lastWaterLog: '2026-09-28T10:00:00Z' }).length, 0);

// 4. Давно не отмечала воду — ближайшее в будущем, без пачки старых
p = planReminders({ waterEnabled: true, waterHours: 2, lastWaterLog: at('2026-09-27T09:00:00').toISOString() }, at('2026-09-28T12:10:00'));
assert.ok(p[0].at > at('2026-09-28T12:10:00') && p[0].at <= at('2026-09-28T14:10:00'));

// 5. Взвешивание: 22.09 + 7 дней -> 29.09 в 9:00; замеры: 01.09 + 28 дней -> тоже 29.09
p = planReminders({ lastWeightLog: '2026-09-22', weightDays: 7, lastMeasureLog: '2026-09-01', measureDays: 28 }, at('2026-09-28T20:00:00'));
assert.deepStrictEqual(p.map(r => r.title + ' ' + fmt(r.at)), ['⚖️ Сегодня взвешивание 29.9 09:00', '📏 Сегодня замеры 29.9 09:00']);

// 6. Взвешивание уже прошло — не ставим
assert.strictEqual(planReminders({ lastWeightLog: '2026-09-01', weightDays: 7 }, at('2026-09-28T20:00:00')).length, 0);

// 7. Свои напоминания: ежедневно в 21:30 и каждые 8 часов
p = planReminders({ customReminders: [
  { id: '1', name: 'Витамин D', type: 'daily', time: '21:30' },
  { id: '2', name: 'Таблетка', type: 'interval', hours: 8, lastLog: at('2026-09-28T08:00:00').toISOString() },
  { id: '3', name: 'Ни разу не отмечено', type: 'interval', hours: 8, lastLog: null },
] }, at('2026-09-28T10:00:00'));
assert.deepStrictEqual(p.map(r => r.kind === 'daily' ? `${r.title} каждый день ${r.hour}:${r.minute}` : `${r.title} ${fmt(r.at)}`),
  ['💊 Витамин D каждый день 21:30', '💊 Таблетка 28.9 16:00']);

console.log('Все проверки напоминаний пройдены ✓');
