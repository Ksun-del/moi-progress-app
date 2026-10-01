// Расчёт напоминаний: какие уведомления и на какое время поставить.
// Чистая функция без Expo — её легко проверить отдельно.
//
// s — данные для напоминаний (reminderPayload в src/logic/notify.js):
// { waterEnabled, waterHours, lastWaterLog, weightDays, measureDays,
//   lastWeightLog, lastMeasureLog, customReminders: [{id, name, type, time | hours, lastLog}] }
//
// Возвращает список:
//   { kind: 'date',  at: Date, title, body }            — один раз в указанное время
//   { kind: 'daily', hour, minute, title, body }        — каждый день
// У своих напоминаний есть ещё rid — по нему кнопка «✓ Выпила» в уведомлении понимает, что отметить.

const NIGHT_FROM = 23; // с 23:00 до 8:00 про воду не напоминаем
const NIGHT_TO = 8;
const WATER_REPEATS = 3; // если не отметила воду — напомнить ещё пару раз

function moveOutOfNight(d) {
  const h = d.getHours();
  if (h >= NIGHT_FROM || h < NIGHT_TO) {
    const r = new Date(d);
    if (h >= NIGHT_FROM) r.setDate(r.getDate() + 1);
    r.setHours(NIGHT_TO, 0, 0, 0);
    return r;
  }
  return d;
}

// 'YYYY-MM-DD' + N дней, в 9:00 по времени телефона
function dayAt9(dateStr, plusDays) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, m - 1, d + plusDays, 9, 0, 0, 0);
}

function planReminders(s, now = new Date()) {
  const out = [];
  if (!s) return out;

  // Вода
  if (s.waterEnabled && s.waterHours > 0) {
    const step = s.waterHours * 3600000;
    const base = s.lastWaterLog ? new Date(s.lastWaterLog).getTime() : now.getTime();
    let t = base + step;
    while (t <= now.getTime()) t += step; // пропущенные не шлём пачкой
    const seen = new Set();
    for (let i = 0; i < WATER_REPEATS; i++, t += step) {
      const at = moveOutOfNight(new Date(t));
      if (seen.has(at.getTime())) continue;
      seen.add(at.getTime());
      out.push({ kind: 'date', at, title: '💧 Пора попить воды', body: 'Не забудь про воду!' });
    }
  }

  // Взвешивание и замеры — в 9:00 нужного дня
  if (s.lastWeightLog && s.weightDays > 0) {
    const at = dayAt9(s.lastWeightLog, s.weightDays);
    if (at > now) out.push({ kind: 'date', at, title: '⚖️ Сегодня взвешивание', body: 'Не забудь внести вес в приложение.' });
  }
  if (s.lastMeasureLog && s.measureDays > 0) {
    const at = dayAt9(s.lastMeasureLog, s.measureDays);
    if (at > now) out.push({ kind: 'date', at, title: '📏 Сегодня замеры', body: 'Не забудь внести параметры в приложение.' });
  }

  // Свои напоминания (таблетки и т.п.)
  (s.customReminders || []).forEach(r => {
    const title = '💊 ' + (r.name || 'Напоминание');
    const body = ''; // только название — без лишней строчки
    const extra = { rid: r.id };
    if (r.type === 'daily') {
      const [hour, minute] = String(r.time || '09:00').split(':').map(Number);
      out.push({ kind: 'daily', hour: hour || 0, minute: minute || 0, title, body, ...extra });
    } else if (r.type === 'interval' && r.lastLog && r.hours > 0) {
      const at = new Date(new Date(r.lastLog).getTime() + r.hours * 3600000);
      if (at > now) out.push({ kind: 'date', at, title, body, ...extra });
    }
  });

  return out;
}

export { planReminders };
