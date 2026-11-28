import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { createIdentityStore, type MobileLoginDevice } from './installationIdentity';

const IDENTITY_KEY = 'campus-wallet-installation';
const identity = createIdentityStore({
  get: () => SecureStore.getItemAsync(IDENTITY_KEY),
  set: value => SecureStore.setItemAsync(IDENTITY_KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
}, async () => ({ id: Crypto.randomUUID(), credential: Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('') }));

export async function getLoginDevice(): Promise<MobileLoginDevice> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('Mobile sign-in requires Android or iOS.');
  return { ...await identity(), platform: Platform.OS, name: (Device.deviceName || Device.modelName || 'Mobile device').slice(0, 120),
    osVersion: (Device.osVersion || String(Platform.Version)).slice(0, 120), appVersion: (Constants.expoConfig?.version || 'Unknown').slice(0, 120) };
}