import { StyleSheet } from 'react-native';

export const colors = {
  ink: '#070d2e', text: '#1a1d2e', muted: '#657398', line: '#d9e2f2',
  background: '#f5f7fa', white: '#ffffff', primary: '#5200c9', primaryDark: '#4300b5',
  cyan: '#1aa9c9', blue: '#2444c2', pale: '#f1ebff', green: '#0c835a',
  greenSoft: '#ecfdf5', red: '#c92d3b', redSoft: '#fef2f2', amber: '#a65b00', amberSoft: '#fffbeb',
};
export const fonts = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' };
export const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 20, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 36 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  section: { gap: 14 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: colors.ink },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.text },
  muted: { color: colors.muted },
  small: { fontSize: 12, lineHeight: 18, color: colors.muted },
  strong: { fontFamily: fonts.semibold },
  divider: { height: 1, backgroundColor: colors.line },
  listRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 8 },
  panel: { padding: 18, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 14 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 140, padding: 16, minHeight: 108, gap: 8, backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 8 },
  statValue: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 30, color: colors.ink },
  empty: { paddingVertical: 32, alignItems: 'center', gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale },
});