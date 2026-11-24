import { useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Button, Detail, Empty, Field, Heading, Loading, Notice, Screen, Status, Txt } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useResource';
import { api } from '../services/api';
import { styles } from '../styles/theme';
import type { Transaction } from '../types';
import { dateTime, mergeUnique, money, positiveAmount } from '../utils/wallet';

export function AddMoneyScreen() {
  const { user, refreshProfile } = useAuth();
  const [amount, setAmount] = useState('');
  const [requests, setRequests] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const page = useRef(1);
  const pending = useRef(false);
  const generation = useRef(0);
  const action = useAction();
  const load = async (reset = false) => {
    if (pending.current && !reset) return;
    const requestId = ++generation.current;
    pending.current = true; setLoading(true); setError('');
    try {
      const currentPage = reset ? 1 : page.current;
      const data = await api.walletRequests(currentPage, 5);
      if (requestId !== generation.current) return;
      setRequests(current => reset ? data.requests || [] : mergeUnique(current, data.requests || []));
      page.current = currentPage + 1; setHasMore(Boolean(data.hasMore) && data.requests.length > 0);
    } catch (failure) { if (requestId === generation.current) setError(failure instanceof Error ? failure.message : 'Unable to load requests.'); }
    finally { if (requestId === generation.current) { pending.current = false; setLoading(false); } }
  };
  useFocusEffect(useCallback(() => { void load(true); void refreshProfile().catch(() => {}); return () => { generation.current += 1; pending.current = false; }; }, []));
  const submit = () => action.run(async () => {
    await api.requestFunds(positiveAmount(amount, true));
    setAmount(''); action.setMessage('Your add money request has been submitted to the admin.'); await load(true);
  });
  return <Screen scroll={false}><FlatList data={requests} keyExtractor={item => item._id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshing={loading && page.current <= 2} onRefresh={() => { void load(true); void refreshProfile().catch(() => {}); }}
    ListHeaderComponent={<View style={styles.section}><Heading>Request Add Money</Heading><Field label="Amount to Add (INR)" value={amount} onChangeText={value => setAmount(value.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" maxLength={10} editable={!action.busy} /><Detail label="Current Balance" value={money(user?.walletBalance)} /><Notice message={action.error} /><Notice message={action.message} success /><Button label="Submit Request" icon="plus" busy={action.busy} onPress={submit} /><Heading>Request History</Heading></View>}
    renderItem={({ item }) => <View style={styles.listRow}><View style={styles.between}><Txt style={styles.heading}>{money(item.amount)}</Txt><Status value={item.status === 'completed' ? 'approved' : item.status === 'failed' ? 'rejected' : 'pending'} /></View><Txt style={styles.small}>{dateTime(item.createdAt)}</Txt><Txt selectable style={styles.small}>{item._id}</Txt></View>}
    ListEmptyComponent={loading ? <Loading /> : !error ? <Empty text="No request history found." /> : null}
    onEndReached={() => { if (hasMore && !error) void load(); }} onEndReachedThreshold={0.25}
    ListFooterComponent={<View style={styles.section}><Notice message={error} />{error ? <Button label="Retry" icon="refresh-cw" tone="secondary" onPress={() => { void load(!requests.length); }} /> : loading && requests.length ? <Loading /> : !hasMore && requests.length ? <Txt style={styles.small}>No more requests</Txt> : null}</View>} />
  </Screen>;
}