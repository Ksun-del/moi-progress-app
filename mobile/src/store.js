// Хранилище данных: весь «db» лежит в памяти телефона (AsyncStorage) под тем же ключом,
// что и в прошлых версиях, поэтому после обновления приложения ничего не теряется.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeDb, emptyDb } from './logic/core';

const KEY = 'myProgressV2';
const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [db, setDb] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => setDb(normalizeDb(raw ? JSON.parse(raw) : emptyDb())))
      .catch(() => setDb(emptyDb()));
  }, []);

  // Сохраняем с небольшой задержкой, чтобы частые нажатия не писали на диск каждый раз
  useEffect(() => {
    if (!db) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { AsyncStorage.setItem(KEY, JSON.stringify(db)).catch(() => {}); }, 300);
  }, [db]);

  const update = useCallback((fn) => setDb(prev => (prev ? fn(prev) : prev)), []);
  const replace = useCallback((next) => setDb(normalizeDb(next)), []);
  return <Ctx.Provider value={{ db, update, replace }}>{children}</Ctx.Provider>;
}

export function useStore() { return useContext(Ctx); }
