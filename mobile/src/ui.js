// Общие элементы интерфейса
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C, F } from './theme';

export function T({ style, w = 'r', size = 15, color = C.ink, ...p }) {
  return <Text {...p} style={[{ fontFamily: F[w], fontSize: size, color }, style]} />;
}

export function Card({ style, dark, children }) {
  return <View style={[s.card, dark && { backgroundColor: C.dark }, style]}>{children}</View>;
}

export function Btn({ title, onPress, kind = 'primary', style, small, disabled }) {
  const k = {
    primary: { bg: C.dark, fg: '#fff', bd: C.dark },
    accent: { bg: C.accent, fg: C.ink, bd: C.accent },
    ghost: { bg: C.card, fg: C.ink, bd: C.border },
    clear: { bg: 'transparent', fg: C.ink, bd: C.border },
    danger: { bg: C.badBg, fg: C.bad, bd: '#f3c6c6' },
    darkGhost: { bg: 'transparent', fg: '#fff', bd: '#5b554d' },
  }[kind];
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: k.bg, borderColor: k.bd, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}>
      <T w="b" size={small ? 14 : 15} color={k.fg}>{title}</T>
    </Pressable>
  );
}

export function Chip({ text, color = C.ok, bg = C.okBg }) {
  return <View style={[s.chip, { backgroundColor: bg }]}><T w="b" size={12} color={color}>{text}</T></View>;
}

export function Round({ onPress, label, bg = C.card, children, size = 44 }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Field({ label, style, inputStyle, ...p }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <T size={13} color={C.muted}>{label}</T> : null}
      <TextInput placeholderTextColor="#a39b90" {...p} style={[s.input, p.multiline && { height: 90, textAlignVertical: 'top', paddingTop: 12 }, inputStyle]} />
    </View>
  );
}

export function Progress({ value, color = C.ink, height = 6 }) {
  return (
    <View style={{ height, backgroundColor: C.track, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, height, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

// Нижняя «шторка» для выбора блюда, ввода веса и т.п.
export function Sheet({ visible, onClose, title, children, footer }) {
  const ins = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
        <View style={[s.sheet, { paddingBottom: 16 + ins.bottom }]}>
          <View style={s.sheetHead}>
            <T w="x" size={20} style={{ flex: 1 }}>{title}</T>
            <Round label="Закрыть" onPress={onClose} bg={C.soft} size={40}><Icon name="close" size={18} /></Round>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>{children}</ScrollView>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Кольцо калорий
export function Ring({ value, size = 150, stroke = 16, color = C.accent, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.line} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={StyleSheet.absoluteFill}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View></View>
    </View>
  );
}

// Иконки (тонкие линии, как в макете)
const PATHS = {
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  today: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 8v4l2.5 2',
  food: 'M4 11h16a8 8 0 0 1-16 0zM8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3',
  progress: 'M4 19l5-6 4 3 7-9',
  check: 'M5 12l5 5L20 7',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  watch: 'M9 6V3h6v3M9 18v3h6v-3M12 10v2l1.5 1',
  run: 'M14 6.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM8 21l3-6 3 2 1-5 3 2M10 9l3-2 2 3',
  gym: 'M3 12h2M19 12h2M6 8v8M18 8v8M9 10v4M15 10v4M9 12h6',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M9 2h6',
  cart: 'M3 4h2l2.4 11h10.2L20 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  pot: 'M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h20M9 6c0-1 1-1.5 1-2.5M14 6c0-1 1-1.5 1-2.5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
};
export function Icon({ name, size = 20, color = C.ink, width = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {name === 'watch' ? <Rect x="6" y="6" width="12" height="12" rx="3" /> : null}
      <Path d={PATHS[name]} />
    </Svg>
  );
}

export function Section({ title, action, onAction }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 8, paddingHorizontal: 4 }}>
      <T w="x" size={20}>{title}</T>
      {action ? <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button"><T w="s" size={14} color={C.run}>{action}</T></Pressable> : null}
    </View>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 24, padding: 18 },
  btn: { height: 48, borderRadius: 24, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnSmall: { height: 44, borderRadius: 22, paddingHorizontal: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' },
  input: { height: 52, borderRadius: 16, backgroundColor: C.soft, paddingHorizontal: 16, fontFamily: F.r, fontSize: 16, color: C.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: '88%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
