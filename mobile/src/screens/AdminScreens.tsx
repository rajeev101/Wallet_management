import { useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Avatar, Button, Detail, Empty, Field, Heading, Icon, IconButton, Notice, ResourceState, Screen, Stat, Status, Toggle, Txt } from '../components/ui';
import { Select } from '../components/Select';
import { TransactionRow } from '../components/TransactionRow';
import { VendorQr } from '../components/VendorQr';
import { useAuth } from '../context/AuthContext';
import { useAction, useForegroundPoll, useResource } from '../hooks/useResource';
import { useRootNavigation, type StackProps } from '../navigation/types';
import { api } from '../services/api';
import { colors, styles } from '../styles/theme';
import type { PayerRole, Transaction, User } from '../types';
import { dateTime, emailValid, holder, money, partyName, summarize, titleCase, todayTransactions, transactionsFor, userCode } from '../utils/wallet';

export function AdminHomeScreen() {
  const { user } = useAuth();
  const navigation = useRootNavigation();
  const focused = useIsFocused();
  const resource = useResource(async () => {
    const [stats, transactions] = await Promise.all([api.adminStats(), api.adminTransactions()]);
    return { stats: stats.stats, transactions: transactions.transactions || [] };
  });
  useForegroundPoll(resource.reload, 6000, focused);
  const stats = resource.data?.stats;
  return <Screen onRefresh={resource.reload} refreshing={resource.loading}><View style={{ paddingVertical: 16, gap: 8 }}><Txt style={styles.muted}>Welcome back, {user!.name}</Txt><Heading>Manage Your Campus Wallet</Heading><Txt style={styles.small}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Txt></View>
    <ResourceState loading={resource.loading && !resource.data} error={resource.error} onRetry={resource.reload} />
    {stats && <View style={styles.summary}><Stat label="Total Students" value={stats.totalStudents} icon="users" onPress={() => navigation.navigate('Admin', { screen: 'Students' })} /><Stat label="Total Customers" value={stats.totalCustomers} icon="users" onPress={() => navigation.navigate('Admin', { screen: 'Customers' })} /><Stat label="Total Vendors" value={stats.totalVendors} icon="shopping-bag" onPress={() => navigation.navigate('Admin', { screen: 'Vendors' })} /><Stat label="Total Transactions" value={stats.totalTransactions} icon="repeat" onPress={() => navigation.navigate('AllTransactions')} /><Stat label="Total Wallet Balance" value={money(stats.totalWalletBalance)} icon="credit-card" onPress={() => navigation.navigate('WalletBalances')} /><Stat label="Total Money Added" value={money(stats.totalMoneyAdded)} /><Stat label="Total Payments" value={money(stats.totalPayments)} /></View>}
    <View style={styles.between}><Heading>Recent Transactions</Heading><IconButton icon="arrow-right" label="View all transactions" onPress={() => navigation.navigate('Admin', { screen: 'AdminTransactions' })} /></View>
    {resource.data?.transactions.length ? resource.data.transactions.slice(0, 4).map(transaction => <TransactionRow key={transaction._id} transaction={transaction} admin />) : !resource.loading && <Empty text="No transactions found." />}
  </Screen>;
}

type PeopleKind = PayerRole | 'vendor' | 'wallet';
export function PeopleScreen({ kind }: { kind: PeopleKind }) {
  const navigation = useRootNavigation();
  const [search, setSearch] = useState('');
  const focused = useIsFocused();
  const action = useAction();
  const resource = useResource(async () => {
    if (kind === 'vendor') return (await api.adminVendors()).vendors || [];
    if (kind === 'student') return (await api.adminStudents()).students || [];
    if (kind === 'customer') return (await api.adminCustomers()).customers || [];
    const [students, customers] = await Promise.all([api.adminStudents(), api.adminCustomers()]);
    return [...students.students || [], ...customers.customers || []];
  }, [kind]);
  useForegroundPoll(resource.reload, 6000, focused);
  const people = resource.data || [];
  const query = search.trim().toLowerCase();
  const filtered = people.filter(person => [person.name, person.email, person.phone, person._id, userCode(person)].some(value => String(value || '').toLowerCase().includes(query)));
  const totalBalance = people.reduce((sum, person) => sum + Number(person.walletBalance || 0), 0);
  const title = kind === 'wallet' ? 'Wallet Balances' : `${titleCase(kind)}s`;
  const vendorStatus = (person: User, active: boolean) => Alert.alert(active ? 'Activate Vendor' : 'Deactivate Vendor', `${active ? 'Allow' : 'Block'} sign-in and payments for ${person.name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: active ? 'Activate' : 'Deactivate', style: active ? 'default' : 'destructive', onPress: () => { void action.run(async () => { await api.setVendorActive(person._id, active); action.setMessage(`Vendor ${active ? 'activated' : 'deactivated'} successfully.`); await resource.reload(); }); } }]);
  return <Screen scroll={false}><FlatList data={filtered} keyExtractor={person => person._id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshing={resource.loading} onRefresh={resource.reload}
    ListHeaderComponent={<View style={styles.section}><Heading>{title}</Heading><View style={styles.summary}><Stat label={`Total ${title}`} value={people.length} /><Stat label={kind === 'vendor' ? 'Active Vendors' : 'Active Users'} value={kind === 'vendor' ? people.filter(person => person.vendorStatus === 'approved').length : people.length} /><Stat label="Total Balance" value={money(totalBalance)} /><Stat label="Avg. Balance" value={money(people.length ? totalBalance / people.length : 0)} /></View>
      <Field label={`Search ${title}`} placeholder="Name, email, phone, or ID" value={search} onChangeText={setSearch} />
      {kind !== 'wallet' && <Button label={`Add ${titleCase(kind)}`} icon="user-plus" onPress={() => kind === 'vendor' ? navigation.navigate('CreateVendor') : navigation.navigate('Register', { role: kind, adminHandoff: true })} />}
      <Notice message={action.error} /><Notice message={action.message} success /><ResourceState loading={resource.loading && !resource.data} error={resource.error} onRetry={resource.reload} />
    </View>}
    renderItem={({ item }) => <View style={styles.listRow}><Pressable accessibilityRole="button" accessibilityLabel={`View ${item.name}`} onPress={() => navigation.navigate('PersonDetail', { person: item })} style={styles.between}><Avatar name={item.name} uri={item.profilePicture} size={44} /><View style={{ flex: 1, gap: 4 }}><Txt style={styles.strong}>{item.name}</Txt><Txt style={styles.small}>{item.email}</Txt><Txt style={styles.small}>{userCode(item)}</Txt></View><Icon name="chevron-right" size={18} /></Pressable>
      <Detail label="Phone" value={item.phone || 'Not available'} /><View style={styles.between}><Txt style={styles.strong}>{money(item.walletBalance)}</Txt><Status value={kind === 'vendor' ? item.vendorStatus === 'approved' ? 'active' : item.vendorStatus === 'rejected' ? 'inactive' : 'pending' : 'active'} /></View>
      {kind === 'vendor' ? <><Detail label="Total Sales" value={money(item.totalSales || item.walletBalance)} /><View style={styles.row}><Button label="Activate" tone="secondary" icon="check-circle" disabled={action.busy || item.vendorStatus === 'approved'} onPress={() => vendorStatus(item, true)} /><Button label="Deactivate" tone="danger" icon="slash" disabled={action.busy || item.vendorStatus === 'rejected'} onPress={() => vendorStatus(item, false)} /></View></> : kind !== 'wallet' && <Button label="Add Money" tone="secondary" icon="plus" onPress={() => navigation.navigate('Admin', { screen: 'WalletRequests' })} />}
    </View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <Empty text={`No ${title.toLowerCase()} found.`} /> : null} />
  </Screen>;
}

export function StudentsScreen() { return <PeopleScreen kind="student" />; }
export function CustomersScreen() { return <PeopleScreen kind="customer" />; }
export function VendorsScreen() { return <PeopleScreen kind="vendor" />; }
export function WalletBalancesScreen() { return <PeopleScreen kind="wallet" />; }

export function PersonDetailScreen({ route, navigation }: StackProps<'PersonDetail'>) {
  const initial = route.params.person;
  const vendor = initial.accountType === 'vendor';
  const resource = useResource(async () => {
    const [people, transactions] = await Promise.all([vendor ? api.adminVendors().then(data => data.vendors) : initial.accountType === 'customer' ? api.adminCustomers().then(data => data.customers) : api.adminStudents().then(data => data.students), api.adminTransactions(vendor ? initial._id : '')]);
    const person = people.find(person => person._id === initial._id) || initial;
    return { person, transactions: transactionsFor(transactions.transactions || [], person) };
  }, [initial._id]);
  const person = resource.data?.person || initial;
  return <Screen onRefresh={resource.reload} refreshing={resource.loading}><View style={styles.row}><Avatar name={person.name} uri={person.profilePicture} /><View style={styles.fill}><Heading>{person.name}</Heading><Txt style={styles.muted}>{titleCase(person.accountType)}</Txt></View></View><ResourceState loading={resource.loading && !resource.data} error={resource.error} onRetry={resource.reload} />
    <Detail label="Name" value={person.name} /><Detail label="Email" value={person.email} /><Detail label="Phone" value={person.phone || 'Not available'} /><Detail label="Account Type" value={titleCase(person.accountType)} /><Detail label="Account Status" value={<Status value={vendor ? person.vendorStatus === 'approved' ? 'active' : person.vendorStatus === 'rejected' ? 'inactive' : 'pending' : person.accountStatus || 'active'} />} /><Detail label="Wallet Balance" value={money(person.walletBalance)} />
    {vendor && <Detail label="Total Amount Received" value={money(summarize(resource.data?.transactions || []).spent)} />}<Detail label={vendor ? 'Transactions' : 'Transactions in available history'} value={String(resource.data?.transactions.length || 0)} /><Detail label="Joined" value={dateTime(person.createdAt)} />
    <Button label="Show Transactions" icon="list" onPress={() => navigation.navigate('PersonTransactions', { person })} />{vendor && <><Heading>Payment QR Code</Heading><VendorQr vendor={person} /></>}
  </Screen>;
}

export function CreateVendorScreen({ navigation }: StackProps<'CreateVendor'>) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', active: true });
  const action = useAction();
  const submit = () => action.run(async () => {
    if (!form.name.trim() || !emailValid(form.email)) throw new Error('Shop name and a valid email address are required.');
    const data = await api.createVendor({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() });
    action.setMessage(data.message || 'Vendor created and onboarding email sent.');
    setForm({ name: '', email: '', phone: '', active: true });
  });
  return <Screen><Heading>Create Vendor</Heading><Field label="Shop Name" value={form.name} onChangeText={name => setForm(current => ({ ...current, name }))} maxLength={120} autoCapitalize="words" editable={!action.busy} /><Field label="Email Address" value={form.email} onChangeText={email => setForm(current => ({ ...current, email }))} keyboardType="email-address" editable={!action.busy} /><Field label="Phone Number" value={form.phone} onChangeText={phone => setForm(current => ({ ...current, phone }))} keyboardType="phone-pad" editable={!action.busy} /><Toggle label="Activate Account Immediately" value={form.active} onChange={active => setForm(current => ({ ...current, active }))} /><Notice message={action.error} /><Notice message={action.message} success /><Button label="Create Vendor & Send Email" icon="send" busy={action.busy} onPress={submit} /><Button label="Done" tone="secondary" disabled={action.busy} onPress={() => navigation.goBack()} /></Screen>;
}

export function WalletRequestsScreen() {
  const resource = useResource(async () => (await api.adminWalletRequests()).requests || []);
  const action = useAction();
  const focused = useIsFocused();
  const [status, setStatus] = useState('all');
  useForegroundPoll(resource.reload, 6000, focused);
  const requests = resource.data || [];
  const today = todayTransactions(requests);
  const approved = today.filter(item => item.status === 'completed');
  const filtered = requests.filter(item => status === 'all' || item.status === status);
  const review = (request: Transaction, nextStatus: 'approved' | 'rejected') => Alert.alert(`${nextStatus === 'approved' ? 'Approve' : 'Reject'} Request`, `${money(request.amount)} for ${partyName(holder(request)) || 'account holder'}?`, [{ text: 'Cancel', style: 'cancel' }, { text: nextStatus === 'approved' ? 'Approve' : 'Reject', style: nextStatus === 'approved' ? 'default' : 'destructive', onPress: () => { void action.run(async () => { await api.reviewRequest(request._id, nextStatus); action.setMessage(`Request ${nextStatus} successfully.`); await resource.reload(); }); } }]);
  return <Screen scroll={false}><FlatList data={filtered} keyExtractor={item => item._id} contentContainerStyle={styles.content} refreshing={resource.loading} onRefresh={resource.reload}
    ListHeaderComponent={<View style={styles.section}><Heading>Add Money Requests</Heading><View style={styles.summary}><Stat label="Pending Requests" value={requests.filter(item => item.status === 'pending').length} /><Stat label="Approved Requests Created Today" value={approved.length} /><Stat label="Added From Today's Requests" value={money(approved.reduce((sum, item) => sum + item.amount, 0))} /><Stat label="Avg. Request" value={money(requests.length ? requests.reduce((sum, item) => sum + item.amount, 0) / requests.length : 0)} /></View><Select label="Request Status" value={status} options={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'completed' }, { label: 'Rejected', value: 'failed' }]} onChange={setStatus} /><Notice message={action.error} /><Notice message={action.message} success /><ResourceState loading={resource.loading && !resource.data} error={resource.error} onRetry={resource.reload} /></View>}
    renderItem={({ item }) => <View style={styles.listRow}><View style={styles.between}><Txt style={[styles.strong, { flex: 1 }]}>{partyName(holder(item)) || 'Account holder'}</Txt><Txt style={styles.heading}>{money(item.amount)}</Txt></View><Txt selectable style={styles.small}>{item._id}</Txt><Txt style={styles.small}>{dateTime(item.createdAt)}</Txt><Status value={item.status === 'completed' ? 'approved' : item.status === 'failed' ? 'rejected' : 'pending'} />{item.status === 'pending' && <View style={styles.row}><Button label="Approve" icon="check" tone="secondary" disabled={action.busy} onPress={() => review(item, 'approved')} /><Button label="Reject" icon="x" tone="danger" disabled={action.busy} onPress={() => review(item, 'rejected')} /></View>}</View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <Empty text="No funding requests found." /> : null} />
  </Screen>;
}