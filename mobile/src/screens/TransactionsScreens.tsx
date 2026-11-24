import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Choice, Detail, Empty, Field, Heading, IconButton, Notice, ResourceState, Screen, Stat, Status, Txt } from '../components/ui';
import { Select } from '../components/Select';
import { TransactionRow } from '../components/TransactionRow';
import { useAuth } from '../context/AuthContext';
import { useAction, useResource } from '../hooks/useResource';
import type { StackProps } from '../navigation/types';
import { api } from '../services/api';
import { exportTransactions, shareReceipt } from '../services/exports';
import { styles } from '../styles/theme';
import type { Period, Transaction } from '../types';
import { currentMonth, dateTime, filterTransactions, holder, ledgerBalances, money, partyId, partyName, summarize, titleCase, transactionsFor } from '../utils/wallet';

export function TransactionsScreen() {
  const { user } = useAuth();
  const resource = useResource(async () => (await api.transactions()).transactions || []);
  return <TransactionList resource={resource} vendor={user?.accountType === 'vendor'} />;
}

interface TransactionResource { data: Transaction[] | undefined; loading: boolean; error: string; reload: () => Promise<unknown> }
export function TransactionList({ resource, vendor = false, admin = false, report = false, accountReport = false, title, capped = false }: { resource: TransactionResource; vendor?: boolean; admin?: boolean; report?: boolean; accountReport?: boolean; title?: string; capped?: boolean }) {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('newest');
  const [tab, setTab] = useState('student');
  const [page, setPage] = useState(1);
  const [visible, setVisible] = useState(10);
  const action = useAction();
  const allItems = resource.data || [];
  const items = admin && !report ? allItems.filter(item => {
    if (tab === 'vendor') return Boolean(item.vendor) || item.type === 'payment';
    const payer = holder(item);
    return typeof payer === 'object' && payer ? payer.accountType === tab : tab === 'student' && Boolean(item.student);
  }) : allItems;
  const filtered = filterTransactions(items, { search, period, status, type, sort });
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  const displayed = report ? filtered.slice((currentPage - 1) * 10, currentPage * 10) : filtered.slice(0, visible);
  const summary = summarize(items);
  const balances = accountReport ? ledgerBalances(items) : undefined;
  const reset = () => { setPage(1); setVisible(10); };
  const exportList = () => action.run(() => exportTransactions(filtered, title || (vendor ? 'vendor-transactions' : 'transactions'), accountReport, items));
  const periods: { label: string; value: Period }[] = [{ label: 'All Dates', value: 'all' }, ...(vendor ? [{ label: 'Last 3 Days', value: '3d' as Period }] : []), { label: 'Last 7 Days', value: '7d' }, { label: 'Last 15 Days', value: '15d' }, { label: 'Last 1 Month', value: '1m' }, ...(!vendor ? [{ label: 'Last 3 Months', value: '3m' as Period }] : [])];
  return <Screen scroll={false}><FlatList data={displayed} keyExtractor={item => item._id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshing={resource.loading} onRefresh={resource.reload}
    ListHeaderComponent={<View style={styles.section}>{title && <Heading>{title}</Heading>}
      {capped && <Txt style={styles.small}>Based on the latest 200 records available from the server.</Txt>}
      {accountReport && <Txt style={styles.small}>Missing balance snapshots are derived from available history, starting at zero. These are not authoritative wallet balances.</Txt>}
      {vendor && !report && <View style={styles.summary}><Stat label="Today's Revenue" value={money(summarize(items.filter(item => new Date(item.createdAt).toDateString() === new Date().toDateString())).revenue)} /><Stat label="This Week" value={money(summarize(filterTransactions(items, { period: '7d' })).revenue)} /><Stat label="This Month" value={money(summarize(currentMonth(items)).revenue)} /><Stat label="Total Transactions" value={items.length} /></View>}
      {report && <View style={styles.summary}><Stat label="Total Transactions" value={summary.count} /><Stat label={vendor ? 'Total Received' : 'Total Credit Amount'} value={money(vendor ? summary.spent : summary.credit)} />{!vendor && <Stat label="Total Debit Amount" value={money(summary.debit)} />}{vendor && <Stat label="Latest Payment" value={items[0] ? dateTime(items[0].createdAt) : 'None'} />}</View>}
      {admin && !report && <Choice label="Transaction Category" value={tab} onChange={value => { setTab(value); reset(); }} options={[{ label: 'Student', value: 'student' }, { label: 'Customer', value: 'customer' }, { label: 'Vendor', value: 'vendor' }]} />}
      <Field label="Search by Transaction ID" placeholder="Search transaction ID" value={search} onChangeText={value => { setSearch(value); reset(); }} />
      <Select label="Date Range" value={period} options={periods} onChange={value => { setPeriod(value); reset(); }} />
      {report && <><Select label="Status" value={status} options={['all', 'completed', 'pending', 'failed'].map(value => ({ label: titleCase(value), value }))} onChange={value => { setStatus(value); reset(); }} /><Select label="Transaction Type" value={type} options={(vendor ? ['all', 'payment', 'refund'] : ['all', 'credit', 'debit']).map(value => ({ label: titleCase(value), value }))} onChange={value => { setType(value); reset(); }} /><Select label="Sort by Date" value={sort} options={[{ label: 'Newest', value: 'newest' }, { label: 'Oldest', value: 'oldest' }]} onChange={value => { setSort(value); reset(); }} /></>}
      <View style={styles.between}><Heading>Transactions</Heading><IconButton icon="download" label="Export filtered transactions to Excel" disabled={!filtered.length || action.busy} onPress={exportList} /></View><Notice message={action.error} /><ResourceState loading={resource.loading && !resource.data} error={resource.error} onRetry={resource.reload} />
    </View>}
    renderItem={({ item }) => <TransactionRow transaction={item} vendor={vendor} admin={admin} balance={balances?.get(item._id)} />}
    ListEmptyComponent={!resource.loading && !resource.error ? <Empty text="No transactions match the selected filters." /> : null}
    onEndReached={!report ? () => setVisible(count => Math.min(count + 10, filtered.length)) : undefined} onEndReachedThreshold={0.3}
    ListFooterComponent={report && filtered.length ? <View style={styles.section}><Txt style={styles.small}>Showing {displayed.length} of {filtered.length} transactions</Txt><View style={styles.between}><IconButton icon="chevron-left" label="Previous page" disabled={currentPage === 1} onPress={() => setPage(currentPage - 1)} /><Txt>Page {currentPage} of {totalPages}</Txt><IconButton icon="chevron-right" label="Next page" disabled={currentPage === totalPages} onPress={() => setPage(currentPage + 1)} /></View></View> : null} />
  </Screen>;
}

export function TransactionDetailScreen({ route }: StackProps<'TransactionDetail'>) {
  const { transaction } = route.params;
  const action = useAction();
  return <Screen><Heading>Transaction Details</Heading><Detail label="Transaction ID" value={transaction._id} /><Detail label="Amount" value={money(transaction.amount)} /><Detail label="Status" value={<Status value={transaction.status} />} /><Detail label="Date & Time" value={dateTime(transaction.createdAt)} /><Detail label="Transaction Type" value={titleCase(transaction.type)} /><Detail label="Account Holder" value={partyName(holder(transaction)) || partyId(holder(transaction)) || 'Not available'} /><Detail label="Vendor" value={partyName(transaction.vendor) || 'Not applicable'} /><Detail label="Description" value={transaction.description || titleCase(transaction.type)} /><Detail label="Added By" value={partyName(transaction.createdBy) || 'Not available'} /><Notice message={action.error} /><Button label="Download Receipt" icon="download" busy={action.busy} onPress={() => action.run(() => shareReceipt(transaction))} /></Screen>;
}

export function PersonTransactionsScreen({ route }: StackProps<'PersonTransactions'>) {
  const { person } = route.params;
  const vendor = person.accountType === 'vendor';
  const resource = useResource(async () => {
    const data = await api.adminTransactions(vendor ? person._id : '');
    return transactionsFor(data.transactions || [], person).filter(item => !vendor || item.type === 'payment');
  }, [person._id]);
  return <TransactionList resource={resource} report accountReport={!vendor} vendor={vendor} title={`${person.name} - ${vendor ? 'Received Transactions' : 'Transactions'}`} capped={!vendor} />;
}

export function AllTransactionsScreen() {
  const resource = useResource(async () => (await api.adminTransactions()).transactions || []);
  return <TransactionList resource={resource} report capped title="All Transactions" />;
}

export function AdminTransactionsScreen() {
  const resource = useResource(async () => (await api.adminTransactions()).transactions || []);
  return <TransactionList resource={resource} admin capped />;
}