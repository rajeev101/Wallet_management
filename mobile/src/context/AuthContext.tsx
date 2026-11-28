import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { api } from '../services/api';
import { ApiError, HttpClient } from '../services/http';
import { WalletApi } from '../services/walletApi';
import { getLoginDevice } from '../services/deviceIdentity';
import type { Role, User } from '../types';
import { loginAllowed, roles } from '../utils/wallet';
import { setPushRecipient, unregisterPushDevice } from '../services/push';

const TOKEN_KEY = 'campus-wallet-session';
type SessionState = 'loading' | 'ready' | 'offline';
interface AuthValue {
  user: User | null;
  status: SessionState;
  error: string;
  restore: () => Promise<void>;
  login: (email: string, password: string, role: Role, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<User>;
  setUser: (user: User) => void;
  recovery: { email: string; role: Role; token: string };
  setRecovery: (value: { email: string; role: Role; token: string }) => void;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SessionState>('loading');
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState<{ email: string; role: Role; token: string }>({ email: '', role: 'student', token: '' });
  const epoch = useRef(0);
  const storageQueue = useRef(Promise.resolve());
  const persist = (token: string | null) => {
    const operation = storageQueue.current.catch(() => {}).then(() => token
      ? SecureStore.setItemAsync(TOKEN_KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
      : SecureStore.deleteItemAsync(TOKEN_KEY));
    storageQueue.current = operation;
    return operation;
  };
  const logout = async (revokeSession = true) => {
    epoch.current += 1;
    const sessionToken = api.http.token;
    setPushRecipient(null);
    const revokePush = sessionToken && revokeSession ? unregisterPushDevice(sessionToken).catch(() => {
      Alert.alert('Notification Settings', 'Signed out, but this phone could not be disconnected from transaction alerts. Reconnect and sign in to update notification settings.');
    }) : Promise.resolve();
    api.http.token = null;
    setUser(null); setStatus('ready'); setRecovery({ email: '', role: 'student', token: '' });
    await persist(null);
    await revokePush;
    if (sessionToken && revokeSession) {
      const http = new HttpClient(api.http.baseUrl, fetch, 8000);
      http.token = sessionToken;
      try { await new WalletApi(http).logout(); }
      catch (failure) {
        if (!(failure instanceof ApiError && failure.status === 401)) Alert.alert('Signed Out Locally', 'The server could not end this session. Reconnect before signing out when possible; the token will expire automatically. Your registered device has not changed.');
      }
    }
  };
  const refreshProfile = async () => {
    const session = epoch.current;
    const { user: profile } = await api.profile();
    if (!profile || !roles.includes(profile.accountType)) throw new ApiError('Invalid account.', 401);
    if (session === epoch.current) setUser(profile);
    return profile;
  };
  const restore = async () => {
    setStatus('loading'); setError('');
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) { setStatus('ready'); return; }
      api.http.token = token;
      await refreshProfile();
      setStatus('ready');
    } catch (failure) {
      if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) {
        await logout(false).catch(() => {});
      } else {
        setStatus('offline'); setError(failure instanceof Error ? failure.message : 'Could not restore your session.');
      }
    }
  };
  useEffect(() => {
    api.http.onUnauthorized = () => { void logout(false).catch(() => setError('Could not remove the saved session. Please try signing out again.')); };
    void restore();
    return () => { api.http.onUnauthorized = undefined; };
  }, []);
  const login = async (email: string, password: string, role: Role, remember: boolean) => {
    if (!roles.includes(role)) throw new Error('This app is for Student and Customer accounts only.');
    const device = await getLoginDevice();
    const result = await api.login(email.trim().toLowerCase(), password, role, device);
    if (!result.token || !result.user || !roles.includes(result.user.accountType)) throw new Error('Unable to sign in. Please try again.');
    if (!loginAllowed(role, result.user.accountType)) throw new Error('Access denied. Use the sign-in option for your account type.');
    await persist(remember ? result.token : null);
    epoch.current += 1;
    api.http.token = result.token;
    setUser(result.user); setRecovery({ email: '', role, token: '' }); setStatus('ready');
  };
  return <AuthContext.Provider value={{ user, status, error, restore, login, logout, refreshProfile, setUser, recovery, setRecovery }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('AuthProvider is required.'); return context; }