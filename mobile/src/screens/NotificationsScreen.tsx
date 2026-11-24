import { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { Button, Empty, Heading, Notice, Screen, Txt } from '../components/ui';
import { useNotifications } from '../context/NotificationContext';
import { useAction } from '../hooks/useResource';
import { styles } from '../styles/theme';
import { dateTime } from '../utils/wallet';

export function NotificationsScreen() {
  const notifications = useNotifications();
  const action = useAction();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); try { await notifications.refresh(); } finally { setRefreshing(false); } };
  const clear = () => Alert.alert('Clear Notifications', 'Clear all your notifications?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear All', style: 'destructive', onPress: () => { void action.run(notifications.clear); } }]);
  return <Screen scroll={false}><FlatList data={notifications.notifications} keyExtractor={item => item._id} contentContainerStyle={styles.content} refreshing={refreshing} onRefresh={refresh}
    ListHeaderComponent={<View style={styles.section}><Heading>Notifications</Heading><Notice message={notifications.error || action.error} />{notifications.notifications.length > 0 && <Button label="Clear All" icon="trash-2" tone="danger" busy={action.busy} onPress={clear} />}</View>}
    renderItem={({ item }) => <View style={styles.listRow}><Txt>{item.text}</Txt><Txt style={styles.small}>{dateTime(item.createdAt)}</Txt></View>}
    ListEmptyComponent={<Empty text="No new notifications" icon="bell" />} />
  </Screen>;
}