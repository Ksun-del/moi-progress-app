// Связь с облаком (Cloudflare Worker, код в папке cloud/ репозитория).
// Адрес и ключ хранятся отдельно от данных, в памяти телефона.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CFG_KEY = 'myProgressCloud';

export async function loadConfig() {
  try { const c = JSON.parse(await AsyncStorage.getItem(CFG_KEY)); return c && c.url && c.key ? c : null; } catch { return null; }
}
export async function saveConfig(c) {
  if (c) await AsyncStorage.setItem(CFG_KEY, JSON.stringify(c)); else await AsyncStorage.removeItem(CFG_KEY);
}
export function cleanUrl(u) {
  let s = String(u || '').trim().replace(/\/+$/, '');
  if (s && !/^https?:\/\//.test(s)) s = 'https://' + s;
  return s;
}

async function call(cfg, path, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(cfg.url + path, {
      ...opts, signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    let body = null; try { body = await r.json(); } catch {}
    if (r.status === 401) throw new Error('Неверный ключ');
    if (!r.ok && r.status !== 409) throw new Error((body && body.error) || `Ошибка сервера ${r.status}`);
    return { status: r.status, body };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Нет связи с облаком');
    if (e.message === 'Network request failed') throw new Error('Нет интернета или неверный адрес');
    throw e;
  } finally { clearTimeout(t); }
}

// {db, updatedAt} — последняя версия в облаке (db: null, если пусто)
export async function pull(cfg) { return (await call(cfg, '/data')).body || { db: null, updatedAt: 0 }; }
// true — сохранено; false — в облаке уже есть версия новее
export async function push(cfg, db) {
  const r = await call(cfg, '/data', { method: 'PUT', body: JSON.stringify({ db, updatedAt: db._updatedAt }) });
  return r.status !== 409;
}
export async function backups(cfg) { return ((await call(cfg, '/backups')).body || {}).days || []; }
export async function backup(cfg, day) { return (await call(cfg, '/backup?day=' + encodeURIComponent(day))).body; }
