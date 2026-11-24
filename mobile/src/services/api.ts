import { HttpClient } from './http';
import { WalletApi } from './walletApi';

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://www.mapawallet.in/api/v1';
if (!__DEV__ && !baseUrl.startsWith('https://')) throw new Error('Production API connections require HTTPS.');
export const api = new WalletApi(new HttpClient(baseUrl));