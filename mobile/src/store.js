// Хранилище данных. Главная копия — в облаке (Cloudflare), в телефоне лежит рабочая копия,
// чтобы приложение работало и без интернета. Каждое изменение через несколько секунд уходит в облако.
// Кто новее (поле _updatedAt), тот и главный.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeDb, emptyDb, DB_KEY } from './logic/core';
import { setLiveUpdate } from './logic/notify';
import * as Cloud from './logic/cloud';

const KEY = DB_KEY;
const Ctx = createContext(null);
const stamp = (d) => ({ ...d, _updatedAt: Date.now() });

export function StoreProvider({ children }) {
  const [db, setDb] = useState(null);
  const [cloud, setCloud] = useState({ cfg: null, status: 'off', at: null, error: null }); // off | saving | ok | error
  const cfgRef = useRef(null);
  const dbRef = useRef(null);
  const pushed = useRef(0);        // _updatedAt последней версии, которая точно есть в облаке
  const timer = useRef(null);
  const cloudTimer = useRef(null);
  dbRef.current = db;

  const setStatus = (status, error = null) => setCloud(c => ({ ...c, cfg: cfgRef.current, status, error, at: status === 'ok' ? new Date() : c.at }));

  // Скачать из облака, если там новее; если новее в телефоне — отправить
  const syncNow = useCallback(async () => {
    const cfg = cfgRef.current; const local = dbRef.current;
    if (!cfg || !local) return;
    setStatus('saving');
    try {
      const remote = await Cloud.pull(cfg);
      const lt = local._updatedAt || 0;
      if (remote.db && remote.updatedAt > lt) {
        pushed.current = remote.updatedAt;
        setDb(normalizeDb({ ...remote.db, _updatedAt: remote.updatedAt }));
      } else if (!remote.db || lt > remote.updatedAt) {
        const d = lt ? local : stamp(local);
        if (!lt) setDb(d);
        await Cloud.push(cfg, d);
        pushed.current = d._updatedAt;
      } else pushed.current = lt;
      setStatus('ok');
    } catch (e) { setStatus('error', e.message); }
  }, []);

  useEffect(() => {
    (async () => {
      let local;
      try { const raw = await AsyncStorage.getItem(KEY); local = normalizeDb(raw ? JSON.parse(raw) : emptyDb()); }
      catch { local = emptyDb(); }
      dbRef.current = local; setDb(local);
      cfgRef.current = await Cloud.loadConfig();
      if (cfgRef.current) syncNow(); else setStatus('off');
    })();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') syncNow(); });
    return () => sub.remove();
  }, [syncNow]);

  // Сохраняем в телефон почти сразу, в облако — через 3 секунды тишины
  useEffect(() => {
    if (!db) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { AsyncStorage.setItem(KEY, JSON.stringify(db)).catch(() => {}); }, 300);
    const cfg = cfgRef.current;
    if (!cfg || !db._updatedAt || db._updatedAt <= pushed.current) return;
    clearTimeout(cloudTimer.current);
    cloudTimer.current = setTimeout(async () => {
      const d = dbRef.current;
      setStatus('saving');
      try {
        if (await Cloud.push(cfg, d)) { pushed.current = d._updatedAt; setStatus('ok'); }
        else await syncNow(); // в облаке новее — берём оттуда
      } catch (e) { setStatus('error', e.message); }
    }, 3000);
  }, [db, syncNow]);

  const update = useCallback((fn) => setDb(prev => { if (!prev) return prev; const n = fn(prev); return n === prev ? prev : stamp(n); }), []);
  // Кнопка «✓ Выпила» в уведомлении, пока приложение открыто или свёрнуто, пишет сюда
  useEffect(() => { setLiveUpdate(update); return () => setLiveUpdate(null); }, [update]);
  const replace = useCallback((next) => setDb(stamp(normalizeDb(next))), []);

  // Подключить облако. Сначала checkCloud (проверка адреса и ключа, что уже лежит в облаке),
  // потом connectCloud с выбором: 'cloud' — взять данные из облака, 'phone' — отправить данные телефона.
  const checkCloud = useCallback(async (url, key) => {
    const cfg = { url: Cloud.cleanUrl(url), key: String(key || '').trim() };
    const remote = await Cloud.pull(cfg); // бросит ошибку, если адрес или ключ неверны
    return { cfg, remote };
  }, []);
  const connectCloud = useCallback(async (cfg, remote, mode) => {
    await Cloud.saveConfig(cfg);
    cfgRef.current = cfg;
    if (mode === 'cloud' && remote && remote.db) {
      pushed.current = remote.updatedAt;
      setDb(normalizeDb({ ...remote.db, _updatedAt: remote.updatedAt }));
      setStatus('ok');
      return;
    }
    const d = { ...dbRef.current, _updatedAt: Math.max(Date.now(), ((remote && remote.updatedAt) || 0) + 1) };
    dbRef.current = d; pushed.current = d._updatedAt; setDb(d);
    setStatus('saving');
    try { await Cloud.push(cfg, d); setStatus('ok'); }
    catch (e) { setStatus('error', e.message); }
  }, []);
  const disconnectCloud = useCallback(async () => { await Cloud.saveConfig(null); cfgRef.current = null; setStatus('off'); }, []);

  return (
    <Ctx.Provider value={{ db, update, replace, cloud, syncNow, checkCloud, connectCloud, disconnectCloud }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() { return useContext(Ctx); }
