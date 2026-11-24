import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps, type TextProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, styles } from '../styles/theme';
import { initials, titleCase } from '../utils/wallet';

export type IconName = React.ComponentProps<typeof Feather>['name'];
export const Icon = ({ name, size = 20, color = colors.primary }: { name: IconName; size?: number; color?: string }) => <Feather name={name} size={size} color={color} />;
export function Txt({ style, ...props }: TextProps) { return <Text {...props} style={[styles.body, style]} />; }
export function Heading({ children }: PropsWithChildren) { return <Txt accessibilityRole="header" style={styles.heading}>{children}</Txt>; }

export function Screen({ children, refreshing = false, onRefresh, scroll = true }: PropsWithChildren<{ refreshing?: boolean; onRefresh?: () => void; scroll?: boolean }>) {
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.fill, { backgroundColor: colors.background }]}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}>{children}</ScrollView> : children}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function Button({ label, onPress, icon, busy, disabled, tone = 'primary' }: { label: string; onPress: () => void; icon?: IconName; busy?: boolean; disabled?: boolean; tone?: 'primary' | 'secondary' | 'danger' }) {
  const foreground = tone === 'primary' ? colors.white : tone === 'danger' ? colors.red : colors.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [local.button, { backgroundColor: tone === 'primary' ? colors.primary : tone === 'danger' ? colors.redSoft : colors.pale, opacity: disabled || busy ? 0.55 : pressed ? 0.8 : 1 }]}>
    {busy ? <ActivityIndicator color={foreground} /> : icon ? <Icon name={icon} color={foreground} /> : null}
    <Txt style={{ color: foreground, fontFamily: fonts.semibold, textAlign: 'center', flexShrink: 1 }}>{label}</Txt>
  </Pressable>;
}

export function IconButton({ icon, label, onPress, disabled, badge }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; badge?: number }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} notifications` : label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.5 : 1 })}>
    <Icon name={icon} />{badge ? <View style={local.badge}><Txt style={{ color: colors.white, fontSize: 9, lineHeight: 13 }}>{badge > 99 ? '99+' : badge}</Txt></View> : null}
  </Pressable>;
}

export function Field({ label, secureTextEntry, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  return <View style={{ gap: 7 }}>
    <Txt style={styles.strong}>{label}</Txt>
    <View style={[local.inputRow, props.editable === false && { backgroundColor: '#eceff4' }, error && { borderColor: colors.red }]}>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.muted} autoCapitalize={props.autoCapitalize || 'none'} secureTextEntry={secureTextEntry && !visible} style={[local.input, props.style]} />
      {secureTextEntry && <IconButton icon={visible ? 'eye-off' : 'eye'} label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onPress={() => setVisible(!visible)} />}
    </View>
    {error && <Notice message={error} />}
  </View>;
}

export function Notice({ message, success = false }: { message?: string; success?: boolean }) {
  if (!message) return null;
  return <View accessibilityRole={success ? undefined : 'alert'} accessibilityLiveRegion="polite" style={{ padding: 12, borderRadius: 8, backgroundColor: success ? colors.greenSoft : colors.redSoft }}><Txt style={{ color: success ? colors.green : colors.red }}>{message}</Txt></View>;
}

export function Status({ value }: { value: string }) {
  const positive = ['completed', 'approved', 'active'].includes(value.toLowerCase());
  const negative = ['failed', 'rejected', 'inactive'].includes(value.toLowerCase());
  return <View style={{ alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: positive ? colors.greenSoft : negative ? colors.redSoft : colors.amberSoft }}><Txt style={{ fontSize: 12, lineHeight: 18, fontFamily: fonts.medium, color: positive ? colors.green : negative ? colors.red : colors.amber }}>{titleCase(value)}</Txt></View>;
}

export function Empty({ text = 'No records found.', icon = 'inbox' }: { text?: string; icon?: IconName }) {
  return <View style={styles.empty}><Icon name={icon} size={30} color={colors.muted} /><Txt style={styles.muted}>{text}</Txt></View>;
}

export function Loading({ text = 'Loading...' }: { text?: string }) { return <View style={styles.empty}><ActivityIndicator color={colors.primary} /><Txt style={styles.muted}>{text}</Txt></View>; }

export function ResourceState({ loading, error, onRetry }: { loading: boolean; error: string; onRetry: () => void }) {
  return loading ? <Loading /> : error ? <View style={styles.section}><Notice message={error} /><Button label="Retry" icon="refresh-cw" tone="secondary" onPress={onRetry} /></View> : null;
}

export function Stat({ label, value, onPress, icon }: { label: string; value: string | number; onPress?: () => void; icon?: IconName }) {
  const content = <><View style={styles.between}><Txt style={[styles.small, { flexShrink: 1 }]}>{label}</Txt>{icon && <Icon name={icon} size={18} />}</View><Txt style={styles.statValue}>{value}</Txt></>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. View details`} onPress={onPress} style={styles.stat}>{content}</Pressable> : <View style={styles.stat}>{content}</View>;
}

export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return <View style={{ gap: 4, paddingVertical: 8 }}><Txt style={styles.small}>{label}</Txt>{typeof value === 'string' || typeof value === 'number' ? <Txt selectable style={styles.strong}>{value || 'Not available'}</Txt> : value}</View>;
}

export function Avatar({ name, uri, size = 72 }: { name: string; uri?: string; size?: number }) {
  return uri ? <Image accessibilityLabel={`${name} profile photo`} source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} /> : <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Txt style={{ fontFamily: fonts.bold, color: colors.primary, fontSize: size / 3 }}>{initials(name)}</Txt></View>;
}

export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { label: string; value: T }[]; onChange: (value: T) => void }) {
  return <View style={{ gap: 8 }}><Txt style={styles.small}>{label}</Txt><View accessibilityRole="radiogroup" style={styles.row}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => onChange(option.value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingRight: 8 }}><Icon name={value === option.value ? 'check-circle' : 'circle'} size={18} color={value === option.value ? colors.primary : colors.muted} /><Txt style={{ color: value === option.value ? colors.primary : colors.muted }}>{option.label}</Txt></Pressable>)}</View></View>;
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <View style={styles.between}><Txt style={{ flex: 1 }}>{label}</Txt><Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.line }} /></View>; }
export function Brand() { return <View style={[styles.row, { marginBottom: 12 }]}><Image source={require('../../assets/logo.png')} accessibilityLabel="Campus Wallet logo" resizeMode="contain" style={{ width: 52, height: 52, borderRadius: 8 }} /><View><Txt style={styles.heading}>Campus Wallet</Txt><Txt style={styles.small}>Secure Campus Payments</Txt></View></View>; }

const local = StyleSheet.create({
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.white, overflow: 'hidden' },
  input: { flex: 1, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.red },
});