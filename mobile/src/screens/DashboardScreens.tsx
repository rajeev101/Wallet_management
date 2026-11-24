import { View } from 'react-native';
import { Button, Detail, Empty, Heading, Icon, ResourceState, Screen, Stat, Txt } from '../components/ui';
import { TransactionRow } from '../components/TransactionRow';
import { VendorQr } from '../components/VendorQr';
import { useAuth } from '../context/AuthContext';
import { useResource } from '../hooks/useResource';
import { useRootNavigation, type StackProps } from '../navigation/types';
import { api } from '../services/api';
import { colors, fonts, styles } from '../styles/theme';
import { currentMonth, money, summarize, todayTransactions, transactionsFor } from '../utils/wallet';

export function WalletHomeScreen() {
  const { user, refreshProfile } = useAuth();
  const navigation = useRootNavigation();
  const resource = useResource(async () => { const [, data] = await Promise.all([refreshProfile(), api.transactions()]); return data.transactions || []; });
  const items = resource.data || [];
  const summary = summarize(currentMonth(items));
  return <Screen onRefresh={resource.reload} refreshing={resource.loading}><Txt style={styles.muted}>Welcome back, {user!.name}</Txt>
    <View style={{ backgroundColor: colors.primary, padding: 24, borderRadius: 8, gap: 16 }}><View style={styles.between}><Txt style={{ color: '#e5d7ff' }}>Available Balance</Txt><Icon name="wifi" color={colors.white} /></View><Txt style={{ color: colors.white, fontFamily: fonts.bold, fontSize: 36, lineHeight: 46 }}>{money(user?.walletBalance)}</Txt><Icon name="credit-card" size={32} color="#f6c94c" /><Txt style={{ color: '#e5d7ff' }}>Campus Wallet</Txt></View>
    <View style={styles.row}><View style={styles.fill}><Button label="Scan to Pay" icon="maximize" onPress={() => navigation.navigate('Wallet', { screen: 'Scan' })} /></View><View style={styles.fill}><Button label="Add Money" tone="secondary" icon="plus" onPress={() => navigation.navigate('Wallet', { screen: 'AddMoney' })} /></View></View>
    <View style={[styles.row, { paddingVertical: 16, borderBottomWidth: 1, borderTopWidth: 1, borderColor: colors.line }]}><Icon name="shopping-bag" size={34} color={colors.cyan} /><View style={styles.fill}><Heading>Explore MA-PA</Heading><Txt style={styles.small}>Shop / Order / Services / More</Txt></View></View>
    <ResourceState loading={resource.loading && !resource.data} error={resource.error} onRetry={resource.reload} />
    <View style={styles.summary}><Stat label="This Month Spent" value={money(summary.spent)} icon="bar-chart-2" onPress={() => navigation.navigate('Analytics', { kind: 'spend', title: 'This Month Spend Details' })} /><Stat label="Added This Month" value={money(summary.added)} icon="plus" onPress={() => navigation.navigate('Analytics', { kind: 'add', title: 'Add This Month Details' })} /><Stat label="Avg. Transaction" value={money(summary.average)} icon="clock" onPress={() => navigation.navigate('Analytics', { kind: 'average', title: 'Average Transaction Analytics' })} /></View>
    <View style={styles.between}><Heading>Recent Transactions</Heading><Button label="View All" tone="secondary" onPress={() => navigation.navigate('Wallet', { screen: 'Transactions' })} /></View>
    {items.length ? items.slice(0, 5).map(transaction => <TransactionRow key={transaction._id} transaction={transaction} />) : !resource.loading && <Empty text="No transactions found." />}
  </Screen>;
}

export function VendorHomeScreen() {
  const { user, refreshProfile } = useAuth();
  const navigation = useRootNavigation();
  const resource = useResource(async () => { const [profile, data] = await Promise.all([refreshProfile(), api.transactions()]); return transactionsFor(data.transactions || [], profile); });
  const items = resource.data || [];
  const summary = summarize(items);
  return <Screen onRefresh={resource.reload} refreshing={resource.loading}><Heading>{user!.name}</Heading><ResourceState loading={resource.loading && !resource.data} error={resource.error} onRetry={resource.reload} />
    <View style={styles.summary}><Stat label="Today's Sales" value={money(summarize(todayTransactions(items)).spent)} icon="shopping-cart" onPress={() => navigation.navigate('Analytics', { kind: 'today', title: "Today's Completed Sales" })} /><Stat label="This Month" value={money(summarize(currentMonth(items)).spent)} icon="calendar" onPress={() => navigation.navigate('Analytics', { kind: 'month', title: 'Monthly Sales Analytics' })} /><Stat label="Total Transactions" value={summary.count} icon="repeat" onPress={() => navigation.navigate('Analytics', { kind: 'total', title: 'Total Transactions History' })} /><Stat label="Avg. Order Value" value={money(summary.average)} icon="bar-chart-2" onPress={() => navigation.navigate('Analytics', { kind: 'orders', title: 'Average Order Value Analytics' })} /></View>
    <Heading>Payment QR Code</Heading><VendorQr vendor={user!} compact /><Detail label="Your Vendor ID" value={user!._id} /><Button label="QR Code Details" icon="maximize" tone="secondary" onPress={() => navigation.navigate('Vendor', { screen: 'QR' })} />
    <View style={styles.between}><Heading>Recent Transactions</Heading><Button label="View All" tone="secondary" onPress={() => navigation.navigate('Vendor', { screen: 'Transactions' })} /></View>{items.length ? items.slice(0, 5).map(transaction => <TransactionRow key={transaction._id} vendor transaction={transaction} />) : !resource.loading && <Empty text="No transactions found." />}
  </Screen>;
}

export function VendorQrScreen() { const { user } = useAuth(); return <Screen><Heading>Your Payment QR Code</Heading><VendorQr vendor={user!} /></Screen>; }

export function AnalyticsScreen({ route }: StackProps<'Analytics'>) {
  const { user } = useAuth();
  const vendor = user?.accountType === 'vendor';
  const resource = useResource(async () => { const data = await api.transactions(); return vendor ? transactionsFor(data.transactions || [], user!) : data.transactions || []; });
  const kind = route.params.kind;
  const allItems = resource.data || [];
  const scoped = kind === 'today' ? todayTransactions(allItems) : ['spend', 'add', 'average', 'month'].includes(kind) ? currentMonth(allItems) : allItems;
  const items = kind === 'add' ? scoped.filter(item => item.type === 'wallet_topup') : kind === 'total' ? scoped : scoped.filter(item => item.type === 'payment' && (!['average', 'orders'].includes(kind) || item.status === 'completed'));
  const summary = summarize(items);
  return <Screen onRefresh={resource.reload} refreshing={resource.loading}><Heading>{route.params.title}</Heading><ResourceState loading={resource.loading && !resource.data} error={resource.error} onRetry={resource.reload} />
    <View style={styles.summary}><Stat label={kind === 'add' ? 'Total Added' : 'Total Payments'} value={money(kind === 'add' ? summary.added : summary.spent)} /><Stat label="Transactions" value={summary.count} /><Stat label="Completed" value={summary.completed} />{kind === 'total' ? <><Stat label="Pending" value={summary.pending} /><Stat label="Failed" value={summary.failed} /></> : <><Stat label="Average" value={money(summary.average)} /><Stat label="Highest Payment" value={money(summary.highest)} /><Stat label="Lowest Payment" value={money(summary.lowest)} /></>}</View>
    <Heading>{kind === 'add' ? 'Top-up Request History' : 'Transactions List'}</Heading>{items.length ? items.map(transaction => <TransactionRow key={transaction._id} transaction={transaction} vendor={vendor} />) : !resource.loading && <Empty />}
  </Screen>;
}