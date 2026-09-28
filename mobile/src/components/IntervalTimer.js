// Интервальный таймер: 5 сек подготовки, работа / отдых, круги. Сигналы — вибрацией.
import { useEffect, useRef, useState } from 'react';
import { Vibration, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { C } from '../theme';
import { Btn, Field, Sheet, T } from '../ui';

const PREP = 5;

function KeepAwake() { useKeepAwake(); return null; }

export default function IntervalTimer({ visible, onClose }) {
  const [cfg, setCfg] = useState({ work: '30', rest: '10', rounds: '5' });
  const [st, setSt] = useState({ phase: 'idle', left: 0, round: 0, running: false });
  const ref = useRef(null);

  useEffect(() => () => clearInterval(ref.current), []);
  useEffect(() => { if (!visible) { clearInterval(ref.current); setSt({ phase: 'idle', left: 0, round: 0, running: false }); } }, [visible]);

  function tick() {
    setSt(prev => {
      const work = Number(cfg.work) || 30, rest = Number(cfg.rest) || 10, rounds = Number(cfg.rounds) || 5;
      if (prev.left > 1) {
        if (prev.left <= 4) Vibration.vibrate(60);
        return { ...prev, left: prev.left - 1 };
      }
      if (prev.phase === 'prep') { Vibration.vibrate(400); return { ...prev, phase: 'work', left: work, round: 1 }; }
      if (prev.phase === 'work') {
        if (prev.round >= rounds) { clearInterval(ref.current); Vibration.vibrate([0, 300, 150, 300, 150, 600]); return { phase: 'done', left: 0, round: prev.round, running: false }; }
        Vibration.vibrate(250); return { ...prev, phase: 'rest', left: rest };
      }
      if (prev.phase === 'rest') { Vibration.vibrate(400); return { ...prev, phase: 'work', left: work, round: prev.round + 1 }; }
      return prev;
    });
  }
  function start() {
    clearInterval(ref.current);
    setSt(prev => (prev.running ? prev : prev.phase === 'idle' || prev.phase === 'done'
      ? { phase: 'prep', left: PREP, round: 0, running: true }
      : { ...prev, running: true }));
    ref.current = setInterval(tick, 1000);
  }
  function pause() { clearInterval(ref.current); setSt(p => ({ ...p, running: false })); }
  function reset() { clearInterval(ref.current); setSt({ phase: 'idle', left: 0, round: 0, running: false }); }

  const label = { idle: 'Готова к старту', prep: 'Приготовься', work: `Работа · круг ${st.round} из ${cfg.rounds}`, rest: `Отдых · круг ${st.round} из ${cfg.rounds}`, done: 'Тренировка завершена!' }[st.phase];
  const mm = String(Math.floor(st.left / 60)).padStart(2, '0'), ss = String(st.left % 60).padStart(2, '0');
  const bg = st.phase === 'work' ? C.accent : st.phase === 'rest' ? '#dbeafe' : C.soft;

  return (
    <Sheet visible={visible} onClose={onClose} title="Интервальный таймер">
      {st.running ? <KeepAwake /> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Работа, сек" keyboardType="number-pad" value={cfg.work} onChangeText={work => setCfg({ ...cfg, work })} style={{ flex: 1 }} editable={st.phase === 'idle' || st.phase === 'done'} />
        <Field label="Отдых, сек" keyboardType="number-pad" value={cfg.rest} onChangeText={rest => setCfg({ ...cfg, rest })} style={{ flex: 1 }} editable={st.phase === 'idle' || st.phase === 'done'} />
        <Field label="Круги" keyboardType="number-pad" value={cfg.rounds} onChangeText={rounds => setCfg({ ...cfg, rounds })} style={{ flex: 1 }} editable={st.phase === 'idle' || st.phase === 'done'} />
      </View>
      <View style={{ backgroundColor: bg, borderRadius: 24, paddingVertical: 28, alignItems: 'center', gap: 4 }}>
        <T w="x" size={64} style={{ fontVariant: ['tabular-nums'] }}>{mm}:{ss}</T>
        <T w="s" size={17} color={C.muted}>{label}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {st.running
          ? <Btn title="Пауза" kind="ghost" style={{ flex: 1 }} onPress={pause} />
          : <Btn title={st.phase === 'idle' || st.phase === 'done' ? 'Старт' : 'Продолжить'} kind="accent" style={{ flex: 1 }} onPress={start} />}
        <Btn title="Сброс" kind="ghost" style={{ flex: 1 }} onPress={reset} />
      </View>
      <T size={13} color={C.muted}>Перед стартом 5 секунд на подготовку. Смена фазы — вибрация, последние 3 секунды — короткие толчки. Экран не гаснет, пока идёт таймер.</T>
    </Sheet>
  );
}
