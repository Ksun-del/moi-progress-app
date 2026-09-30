// «Мой прогресс» — облако для данных приложения (Cloudflare Worker + KV).
// Настройка в дашборде Cloudflare:
//   KV namespace → привязка (Binding) с именем PROGRESS_KV
//   Секрет SYNC_KEY — длинный пароль, тот же, что вводится в приложении.
// Что хранится: последняя версия данных ('db') и копия за каждый день ('backup:ГГГГ-ММ-ДД', 90 дней).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/') return json({ ok: true, app: 'moi-progress', kv: !!env.PROGRESS_KV, key: !!env.SYNC_KEY });
    if (!env.PROGRESS_KV) return json({ error: 'Не привязано хранилище KV с именем PROGRESS_KV' }, 500);
    if (!env.SYNC_KEY) return json({ error: 'Не задан секрет SYNC_KEY' }, 500);
    if (req.headers.get('Authorization') !== 'Bearer ' + env.SYNC_KEY) return json({ error: 'Неверный ключ' }, 401);
    const kv = env.PROGRESS_KV;

    // Последняя версия данных
    if (url.pathname === '/data' && req.method === 'GET') {
      const v = await kv.get('db');
      return v ? new Response(v, { headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } }) : json({ db: null, updatedAt: 0 });
    }
    if (url.pathname === '/data' && req.method === 'PUT') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'Плохие данные' }, 400); }
      if (!body || typeof body.db !== 'object' || !body.db || !(body.updatedAt > 0)) return json({ error: 'Плохие данные' }, 400);
      const cur = await kv.get('db', 'json');
      // В облаке версия новее (например, с другого телефона) — не затираем, телефон её скачает
      if (cur && cur.updatedAt > body.updatedAt && !url.searchParams.has('force')) return json({ error: 'newer', updatedAt: cur.updatedAt }, 409);
      const text = JSON.stringify({ db: body.db, updatedAt: body.updatedAt });
      await kv.put('db', text);
      // Копия за день: первая запись дня сохраняет состояние на начало дня (то, что было до изменений)
      const day = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // Москва
      const bk = 'backup:' + day;
      if (!(await kv.get(bk)) ) await kv.put(bk, cur ? JSON.stringify(cur) : text, { expirationTtl: 90 * 86400 });
      return json({ ok: true, updatedAt: body.updatedAt });
    }
    // Список копий по дням и одна копия
    if (url.pathname === '/backups' && req.method === 'GET') {
      const list = await kv.list({ prefix: 'backup:' });
      return json({ days: list.keys.map(k => k.name.slice(7)).sort().reverse() });
    }
    if (url.pathname === '/backup' && req.method === 'GET') {
      const v = await kv.get('backup:' + url.searchParams.get('day'));
      return v ? new Response(v, { headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } }) : json({ error: 'Нет такой копии' }, 404);
    }
    return json({ error: 'Не найдено' }, 404);
  },
};
