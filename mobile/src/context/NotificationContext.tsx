import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Linking } from 'react-native';
import { api } from '../services/api';
import { useForegroundPoll } from '../hooks/useResource';
import type { Notification } from '../types';
import { useAuth } from './AuthContext';
import { Notifications, registerPushDevice, setPushPreference, setPushRecipient, unregisterPushDevice } from '../services/push';

interface NotificationValue { notifications: Notification[]; error: string; refresh: () => Promise<void>; clear: () => Promise<void>; pushEnabled: boolean; pushBusy: boolean; pushError: string; togglePush: (enabled: boolean) => Promise<void> }
const NotificationContext = createContext<NotificationValue | null>(null);
export function NotificationProvider({ children, onOpenNotifications }: PropsWithChildren<{ onOpenNotifications: () => void }>) {
  const { user, refreshProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const callbacks = useRef({ onOpenNotifications, refreshProfile });
  callbacks.current = { onOpenNotifications, refreshProfile };
  const active = useRef(false);
  const syncing = useRef(false);
  const generation = useRef(0);
  const refresh = async () => {
    const requestId = ++generation.current;
    try {
      const data = await api.notifications();
      if (requestId === generation.current) { setNotifications(data.notifications || []); setError(''); }
    } catch (failure) { if (requestId === generation.current) setError(failure instanceof Error ? failure.message : 'Notifications are unavailable.'); }
  };
  const clear = async () => { generation.current += 1; await api.clearNotifications(); setNotifications([]); setError(''); };
  const syncPush = async (requestPermission = false) => {
    if (!user || !api.http.token || syncing.current || AppState.currentState !== 'active') return;
    syncing.current = true;
    setPushBusy(true);
    try {
      const enabled = await registerPushDevice(user._id, api.http.token, requestPermission);
      if (active.current) { setPushEnabled(enabled); setPushError(''); }
    } catch (failure) {
      if (active.current) { setPushEnabled(false); setPushError(failure instanceof Error ? failure.message : 'Notifications are unavailable.'); }
    } finally { syncing.current = false; if (active.current) setPushBusy(false); }
  };
  const togglePush = async (enabled: boolean) => {
    if (!user || !api.http.token) return;
    const sessionToken = api.http.token;
    setPushBusy(true); setPushError('');
    try {
      await setPushPreference(user._id, enabled);
      if (enabled) {
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && !permission.canAskAgain) { await Linking.openSettings(); return; }
        await syncPush(true);
      } else { await unregisterPushDevice(sessionToken); setPushEnabled(false); }
    } catch (failure) { setPushError(failure instanceof Error ? failure.message : 'Could not change notifications.'); }
    finally { setPushBusy(false); }
  };
  useEffect(() => {
    active.current = true;
    setPushRecipient(user!._id);
    const handleResponse = (response: Notifications.NotificationResponse) => {
      if (!active.current || response.notification.request.content.data.recipientId !== user!._id) return;
      callbacks.current.onOpenNotifications();
      void refresh();
      void callbacks.current.refreshProfile().catch(() => {});
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    const received = Notifications.addNotificationReceivedListener(notification => {
      if (notification.request.content.data.recipientId !== user!._id) return;
      void refresh(); void callbacks.current.refreshProfile().catch(() => {});
    });
    const response = Notifications.addNotificationResponseReceivedListener(handleResponse);
    const token = Notifications.addPushTokenListener(() => { void syncPush(false); });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void syncPush(false); });
    void Notifications.getLastNotificationResponseAsync().then(last => { if (last) handleResponse(last); }).catch(() => {});
    void syncPush(true);
    return () => { active.current = false; setPushRecipient(null); received.remove(); response.remove(); token.remove(); foreground.remove(); };
  }, [user?._id]);
  useForegroundPoll(refresh, 5000);
  return <NotificationContext.Provider value={{ notifications, error, refresh, clear, pushEnabled, pushBusy, pushError, togglePush }}>{children}</NotificationContext.Provider>;
}
export function useNotifications() { const context = useContext(NotificationContext); if (!context) throw new Error('NotificationProvider is required.'); return context; }