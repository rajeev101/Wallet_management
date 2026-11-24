import { Pressable, View } from 'react-native';
import { Icon, Status, Txt } from './ui';
import { useRootNavigation } from '../navigation/types';
import { colors, styles } from '../styles/theme';
import type { Transaction } from '../types';
import { dateTime, holder, money, partyName } from '../utils/wallet';

export function TransactionRow({ transaction, vendor = false, admin = false, balance }: { transaction: Transaction; vendor?: boolean; admin?: boolean; balance?: { before: number; after: number; derived: boolean } }) {
  const navigation = useRootNavigation();
  const credit = vendor ? transaction.type === 'payment' : transaction.type !== 'payment';
  const name = vendor || admin ? partyName(holder(transaction)) || 'Account holder' : transaction.type === 'payment' ? partyName(transaction.vendor) || 'Campus Vendor' : transaction.description || (transaction.type === 'refund' ? 'Refund' : 'Wallet Recharge');
  return <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${money(transaction.amount)}, ${transaction.status}. View transaction`} onPress={() => navigation.navigate('TransactionDetail', { transaction })} style={styles.listRow}>
    <View style={styles.between}><View style={{ flex: 1, gap: 4 }}><Txt style={styles.strong}>{name}</Txt>{admin && <Txt style={styles.small}>{partyName(transaction.vendor) || 'Wallet Top-up'}</Txt>}</View><Txt style={{ color: credit ? colors.green : colors.red, fontFamily: styles.strong.fontFamily }}>{credit ? '+' : '-'}{money(transaction.amount)}</Txt><Icon name="chevron-right" size={18} color={colors.muted} /></View>
    <Txt selectable style={styles.small}>{transaction._id}</Txt><View style={styles.between}><Txt style={[styles.small, { flexShrink: 1 }]}>{dateTime(transaction.createdAt)}</Txt><Status value={transaction.status} /></View>
    {balance && <Txt style={styles.small}>Initial: {money(balance.before)} / Total: {money(balance.after)}{balance.derived ? ' (derived)' : ''}</Txt>}
  </Pressable>;
}