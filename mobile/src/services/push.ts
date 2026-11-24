import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { HttpClient } from './http';
import { WalletApi } from './walletApi';

const TOKEN_KEY = 'campus-wallet-push-token';
let recipientId: string | null = null;
let operations: Promise<unknown> = Promise.resolve();

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const show = Boolean(recipientId && notification.request.content.data.recipientId === recipientId);
    return { shouldPlaySound: show, shouldSetBadge: false, shouldShowBanner: show, shouldShowList: show };
  },
});

export function setPushRecipient(value: string | null) { recipientId = value; }

function serialized<Result>(operation: () => Promise<Result>): Promise<Result> {
  const pending = operations.catch(() => {}).then(operation);
  operations = pending;
  return pending;
}

function sessionApi(sessionToken: string) {
  const http = new HttpClient(api.http.baseUrl, fetch, 8000);
  http.token = sessionToken;
  return new WalletApi(http);
}

export function registerPushDevice(owner: string, sessionToken: string, requestPermission = true) {
  return serialized(async () => {
    if (await SecureStore.getItemAsync(`push-disabled-${owner}`) === 'true') return false;
    if (!Device.isDevice || !['android', 'ios'].includes(Platform.OS)) throw new Error('Push notifications require a physical Android or iOS device.');
    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error('Push notifications are not configured in this build.');
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('transactions', {
      name: 'Transactions', importance: Notifications.AndroidImportance.HIGH, sound: 'default', lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain && requestPermission) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      const previousToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (previousToken) await sessionApi(sessionToken).unregisterPushDevice(previousToken);
      return false;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (recipientId !== owner || api.http.token !== sessionToken) return false;
    const previousToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (previousToken && previousToken !== token) await sessionApi(sessionToken).unregisterPushDevice(previousToken);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await sessionApi(sessionToken).registerPushDevice(token, Platform.OS as 'android' | 'ios');
    return true;
  });
}

export function unregisterPushDevice(sessionToken: string) {
  return serialized(async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) await sessionApi(sessionToken).unregisterPushDevice(token);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  });
}

export async function setPushPreference(owner: string, enabled: boolean) {
  if (enabled) await SecureStore.deleteItemAsync(`push-disabled-${owner}`);
  else await SecureStore.setItemAsync(`push-disabled-${owner}`, 'true');
}

export { Notifications };