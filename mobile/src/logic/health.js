// Тренировки с часов Xiaomi: Mi Fitness → Health Connect → это приложение
import { Platform, Linking } from 'react-native';
import {
  getSdkStatus, initialize, requestPermission, getGrantedPermissions,
  readRecords, aggregateRecord, openHealthConnectSettings,
  SdkAvailabilityStatus, ExerciseType,
} from 'react-native-health-connect';
import { localDate } from './core';

export const PERMISSIONS = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Weight' },
];

const KIND_BY_TYPE = {
  [ExerciseType.RUNNING]: 'run', [ExerciseType.RUNNING_TREADMILL]: 'run',
  [ExerciseType.WALKING]: 'walk', [ExerciseType.HIKING]: 'walk',
  [ExerciseType.STRENGTH_TRAINING]: 'strength', [ExerciseType.WEIGHTLIFTING]: 'strength', [ExerciseType.CALISTHENICS]: 'strength',
  [ExerciseType.HIGH_INTENSITY_INTERVAL_TRAINING]: 'hiit',
  [ExerciseType.BIKING]: 'bike', [ExerciseType.BIKING_STATIONARY]: 'bike',
  [ExerciseType.SWIMMING_POOL]: 'swim', [ExerciseType.SWIMMING_OPEN_WATER]: 'swim',
  [ExerciseType.YOGA]: 'yoga', [ExerciseType.PILATES]: 'yoga', [ExerciseType.STRETCHING]: 'yoga',
  [ExerciseType.ELLIPTICAL]: 'cardio', [ExerciseType.ROWING_MACHINE]: 'cardio', [ExerciseType.STAIR_CLIMBING_MACHINE]: 'cardio', [ExerciseType.DANCING]: 'cardio',
};

let ready = false;
// 'unavailable' — Health Connect нет на телефоне; 'update' — нужно обновить; 'ok'
export async function status() {
  if (Platform.OS !== 'android') return 'unavailable';
  try {
    const s = await getSdkStatus();
    if (s === SdkAvailabilityStatus.SDK_AVAILABLE) {
      if (!ready) ready = await initialize();
      return ready ? 'ok' : 'unavailable';
    }
    if (s === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update';
    return 'unavailable';
  } catch { return 'unavailable'; }
}
export async function hasAccess() {
  if ((await status()) !== 'ok') return false;
  try { const g = await getGrantedPermissions(); return g.some(p => p.recordType === 'ExerciseSession'); }
  catch { return false; }
}
export async function connect() {
  const s = await status();
  if (s === 'update') { Linking.openURL('market://details?id=com.google.android.apps.healthdata'); return false; }
  if (s !== 'ok') return false;
  const g = await requestPermission(PERMISSIONS);
  return g.some(p => p.recordType === 'ExerciseSession');
}
export function openSettings() { try { openHealthConnectSettings(); } catch {} }

async function sum(recordType, field, startTime, endTime) {
  try {
    const r = await aggregateRecord({ recordType, timeRangeFilter: { operator: 'between', startTime, endTime } });
    return r?.[field];
  } catch { return undefined; }
}

// Тренировки за последние N дней в формате записей приложения
export async function readWorkouts(days = 14) {
  if (!(await hasAccess())) return null;
  const end = new Date(); const start = new Date(); start.setDate(start.getDate() - days);
  const { records } = await readRecords('ExerciseSession', {
    timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
  });
  const out = [];
  for (const s of records || []) {
    const st = new Date(s.startTime), en = new Date(s.endTime);
    const active = await sum('ActiveCaloriesBurned', 'ACTIVE_CALORIES_TOTAL', s.startTime, s.endTime);
    const dist = await sum('Distance', 'DISTANCE', s.startTime, s.endTime);
    const kind = KIND_BY_TYPE[s.exerciseType] || 'other';
    out.push({
      hcId: s.metadata?.id || `${s.startTime}-${s.exerciseType}`,
      source: 'watch',
      date: localDate(st),
      start: s.startTime, end: s.endTime,
      kind,
      title: s.title || undefined,
      duration: Math.max(1, Math.round((en - st) / 60000)),
      kcal: active?.inKilocalories ? Math.round(active.inKilocalories) : 0,
      distanceKm: dist?.inKilometers ? Math.round(dist.inKilometers * 10) / 10 : undefined,
    });
  }
  return out;
}

export async function readStepsToday() {
  if (!(await hasAccess())) return null;
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const r = await sum('Steps', 'COUNT_TOTAL', s.toISOString(), new Date().toISOString());
  return typeof r === 'number' ? r : null;
}

// Вес с весов Xiaomi (если есть) — последние 30 дней
export async function readWeights(days = 30) {
  if (!(await hasAccess())) return [];
  const end = new Date(); const start = new Date(); start.setDate(start.getDate() - days);
  try {
    const { records } = await readRecords('Weight', { timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() } });
    return (records || []).filter(w => w.weight).map(w => ({ date: localDate(new Date(w.time)), weight: Math.round((w.weight?.inKilograms ?? w.weight?.value ?? 0) * 10) / 10 }));
  } catch { return []; }
}
