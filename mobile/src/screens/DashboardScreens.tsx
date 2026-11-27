import { Fragment } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Detail, Empty, Heading, Icon, ResourceState, Screen, Stat, Txt } from '../components/ui';
import { TransactionRow } from '../components/TransactionRow';
import { VendorQr } from '../components/VendorQr';
import { useAuth } from '../context/AuthContext';
import { useResource } from '../hooks/useResource';
import { useRootNavigation, type StackProps } from '../navigation/types';
import { api } from '../services/api';
import { colors, fonts, styles } from '../styles/theme';
import { currentMonth, money, summarize, todayTransactions, transactionsFor } from '../utils/wallet';

const ds = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 82, gap: 13, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 6, minHeight: 56, backgroundColor: colors.primaryDark, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, overflow: 'hidden' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarHead: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 2 }, avatarBody: { width: 18, height: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: colors.primary, marginTop: 2 },
  greeting: { flex: 1, minWidth: 0, gap: 1 }, greetingTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 13, lineHeight: 21 }, greetingSubtitle: { color: '#eee4ff', fontSize: 10, lineHeight: 16 },
  headerAction: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' }, notificationDot: { position: 'absolute', top: 8, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff5264' },
  walletCard: { minHeight: 158, borderRadius: 22, padding: 20, overflow: 'hidden', backgroundColor: '#eadcff', borderWidth: 1, borderColor: '#ded0ff', justifyContent: 'flex-start', elevation: 3, shadowColor: '#381173', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  walletHeading: { flexDirection: 'row', alignItems: 'center', gap: 13 }, walletTitle: { color: '#17131e', fontSize: 21, fontFamily: fonts.bold }, balanceLabel: { marginTop: 12, color: '#15121a', fontFamily: fonts.medium, fontSize: 16 }, balance: { color: '#080710', fontFamily: fonts.bold, fontSize: 43, lineHeight: 50 },
  actionRow: { flexDirection: 'row', gap: 12 }, actionCell: { flex: 1, minWidth: 0 }, actionButton: { minHeight: 56, borderRadius: 20, backgroundColor: '#f1e9ff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 8 }, actionLabel: { color: colors.primary, fontFamily: fonts.bold, fontSize: 14, flexShrink: 1 },
  promoCard: { minHeight: 88, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 2, shadowColor: '#26104b', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, promoCopy: { flex: 1, minWidth: 0, gap: 2 }, promoTitle: { fontFamily: fonts.bold, fontSize: 18, color: '#101018' }, promoSubtitle: { color: '#555878', fontSize: 11 }, shoppingArt: { width: 60, height: 64 },
  sectionHeading: { marginTop: 2 }, sectionTitle: { color: '#101018', fontFamily: fonts.bold, fontSize: 20, lineHeight: 27 }, summaryRow: { flexDirection: 'row', gap: 7 }, summaryCard: { flex: 1, minWidth: 0, minHeight: 104, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 8, justifyContent: 'center', gap: 3 }, summaryIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }, addedIcon: { backgroundColor: '#e4f8e7' }, summaryLabel: { color: '#15151c', fontSize: 12, lineHeight: 17 }, summaryValue: { color: '#0a0910', fontFamily: fonts.bold, fontSize: 21, lineHeight: 26 },
  quickLink: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, quickLinkText: { flex: 1, color: '#12121a', fontSize: 16 }, recentHeading: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, bottomClearance: { height: 10 },
});

function ShoppingIllustration() {
  return <Svg style={{ width: '100%', height: '100%' }} viewBox="0 0 90 72">
    <Path d="M13 28 L19 20 L43 20 L49 28 L48 65 L12 65Z" fill="#ffbd16" /><Path d="M22 29 C22 44 39 44 39 29" fill="none" stroke="#fff3b7" strokeWidth="2.5" />
    <Path d="M41 20 L48 11 L73 11 L81 20 L79 65 L40 65Z" fill="#5b0fcb" /><Path d="M51 21 C51 1 69 1 69 21" fill="none" stroke="#ac7aff" strokeWidth="4" /><Path d="M20 20 C20 8 39 8 39 20" fill="none" stroke="#ffdc64" strokeWidth="2.5" />
    <Path d="M4 66 Q44 70 87 66" fill="none" stroke="#eadcff" strokeWidth="3" />
  </Svg>;
}

export function WalletHomeScreen() {
  const { user, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useRootNavigation();
  const resource = useResource(async () => { const [, data] = await Promise.all([refreshProfile(), api.transactions()]); return data.transactions || []; });
  const items = resource.data || [];
  const summary = summarize(currentMonth(items));
  return <Screen scroll={false} backgroundColor={colors.white}>
    <View style={[ds.header, { paddingTop: 6 + insets.top }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => navigation.navigate('Wallet', { screen: 'Profile' })} style={ds.avatar}>{user?.profilePicture ? <Image accessibilityLabel={`${user.name} profile photo`} source={{ uri: user.profilePicture }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : <><View style={ds.avatarHead} /><View style={ds.avatarBody} /></>}</Pressable>
      <View style={ds.greeting}><Txt numberOfLines={1} style={ds.greetingTitle}>Hello, {user!.name} 👋</Txt><Txt style={ds.greetingSubtitle}>{user?.accountType === 'customer' ? 'Customer Account' : 'Student Account'}</Txt></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => navigation.navigate('Notifications')} style={ds.headerAction}><Icon name="bell" size={23} color={colors.white} /><View style={ds.notificationDot} /></Pressable>
    </View>
    <ScrollView style={{ backgroundColor: colors.white }} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, ds.content]} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={resource.reload} tintColor={colors.primary} />}>
    <View style={ds.walletCard}>
      <View style={ds.walletHeading}><Icon name="credit-card" size={28} color={colors.primary} /><Txt style={ds.walletTitle}>Campus Wallet</Txt></View>
      <Txt style={ds.balanceLabel}>Available Balance</Txt><Txt style={ds.balance}>{money(user?.walletBalance)}</Txt>
    </View>
    <View style={ds.actionRow}>
      <View style={ds.actionCell}><Pressable accessibilityRole="button" onPress={() => navigation.navigate('Wallet', { screen: 'Scan' })} style={ds.actionButton}><Icon name="maximize" size={23} color={colors.primary} /><Txt numberOfLines={1} style={ds.actionLabel}>Scan to Pay</Txt></Pressable></View>
      <View style={ds.actionCell}><Pressable accessibilityRole="button" onPress={() => navigation.navigate('Wallet', { screen: 'AddMoney' })} style={ds.actionButton}><Icon name="plus" size={27} color={colors.primary} /><Txt numberOfLines={1} style={ds.actionLabel}>Add Money</Txt></Pressable></View>
    </View>
    <View style={ds.promoCard}>
      <Icon name="shopping-bag" size={38} color={colors.primary} />
      <View style={ds.promoCopy}><Txt style={ds.promoTitle}>Explore MA-PA</Txt><Txt numberOfLines={1} style={ds.promoSubtitle}>Shop • Order • Services • More</Txt></View>
      <View style={ds.shoppingArt}><ShoppingIllustration /></View><Icon name="chevron-right" size={24} color={colors.ink} />
    </View>
    <ResourceState loading={resource.loading && !resource.data} error={resource.error} onRetry={resource.reload} />
    <View style={ds.sectionHeading}><Txt accessibilityRole="header" style={ds.sectionTitle}>This Month</Txt></View>
    <View style={ds.summaryRow}>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Analytics', { kind: 'spend', title: 'This Month Spend Details' })} style={ds.summaryCard}><View style={ds.summaryIcon}><Icon name="credit-card" size={23} /></View><Txt style={ds.summaryLabel}>Spent</Txt><Txt style={ds.summaryValue}>{money(summary.spent)}</Txt></Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Analytics', { kind: 'add', title: 'Add This Month Details' })} style={ds.summaryCard}><View style={[ds.summaryIcon, ds.addedIcon]}><Icon name="plus-square" size={23} color="#12a52d" /></View><Txt style={ds.summaryLabel}>Added</Txt><Txt style={ds.summaryValue}>{money(summary.added)}</Txt></Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Analytics', { kind: 'total', title: 'Total Transactions History' })} style={ds.summaryCard}><View style={ds.summaryIcon}><Icon name="repeat" size={23} /></View><Txt style={ds.summaryLabel}>Transactions</Txt><Txt style={ds.summaryValue}>{summary.count}</Txt></Pressable>
    </View>
    <View style={ds.sectionHeading}><Txt accessibilityRole="header" style={ds.sectionTitle}>Quick Links</Txt></View>
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Wallet', { screen: 'Profile' })} style={ds.quickLink}><Icon name="user" size={26} color={colors.primary} /><Txt style={ds.quickLinkText}>My Profile</Txt><Icon name="chevron-right" size={22} color={colors.ink} /></Pressable>
    <View style={ds.quickLink}><Icon name="help-circle" size={26} color={colors.primary} /><Txt style={ds.quickLinkText}>Help &amp; Support</Txt><Icon name="chevron-right" size={22} color={colors.ink} /></View>
    <View style={ds.quickLink}><Icon name="info" size={26} color={colors.primary} /><Txt style={ds.quickLinkText}>About Campus Wallet</Txt><Icon name="chevron-right" size={22} color={colors.ink} /></View>
    <View style={ds.bottomClearance} />
    <View style={ds.recentHeading}><Heading>Recent Transactions</Heading><Button label="View All" tone="secondary" onPress={() => navigation.navigate('Wallet', { screen: 'Transactions' })} /></View>
    {items.length ? items.slice(0, 5).map(transaction => <TransactionRow key={transaction._id} transaction={transaction} />) : !resource.loading && <Empty text="No transactions found." />}
    </ScrollView>
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
