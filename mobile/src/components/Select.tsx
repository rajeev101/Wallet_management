import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading, Icon, IconButton, Txt } from './ui';
import { colors, styles } from '../styles/theme';

export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { label: string; value: T }[]; onChange: (value: T) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 7 }}><Txt style={styles.small}>{label}</Txt><Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${options.find(option => option.value === value)?.label}`} onPress={() => setOpen(true)} style={{ minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.white }}><Txt style={{ flex: 1 }}>{options.find(option => option.value === value)?.label}</Txt><Icon name="chevron-down" size={18} /></Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#070d2e77' }}><SafeAreaView style={{ backgroundColor: colors.white, maxHeight: '80%', padding: 20 }}><View style={styles.between}><Heading>{label}</Heading><IconButton icon="x" label="Close options" onPress={() => setOpen(false)} /></View><ScrollView>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => { onChange(option.value); setOpen(false); }} style={[styles.listRow, styles.between]}><Txt>{option.label}</Txt><Icon name={option.value === value ? 'check-circle' : 'circle'} size={18} /></Pressable>)}</ScrollView></SafeAreaView></View></Modal>
  </View>;
}