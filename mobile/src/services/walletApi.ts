import type { AdminStats, LoginResult, Notification, ProfileResult, RequestResult, Result, Role, TransactionResult, User } from '../types';
import { HttpClient } from './http';
import type { MobileLoginDevice } from './installationIdentity';

export class WalletApi {
  constructor(public readonly http: HttpClient) {}
  login = (email: string, password: string, accountType: Role, device?: MobileLoginDevice) => this.http.request<LoginResult>('/auth/login', 'POST', { email, password, ...(accountType === 'admin' || accountType === 'vendor' ? { accountType } : {}), ...(device ? { clientType: 'mobile', device } : {}) }, false);
  logout = () => this.http.request<Result>('/auth/logout', 'DELETE');
  signup = (payload: unknown) => this.http.request<ProfileResult>('/auth/signup', 'POST', payload, false);
  forgotPassword = (email: string) => this.http.request<Result>('/auth/forgot-password', 'POST', { email }, false);
  verifyOtp = (email: string, otp: string) => this.http.request<Result & { resetToken: string }>('/auth/verify-otp', 'POST', { email, otp }, false);
  resetPassword = (email: string, newPassword: string, resetToken: string) => this.http.request<Result>('/auth/reset-password', 'POST', { email, newPassword, resetToken }, false);
  profile = () => this.http.request<ProfileResult>('/auth/profile');
  updateProfile = (payload: { name: string; profilePicture: string; email?: string; phone?: string }) => this.http.request<ProfileResult>('/auth/profile', 'PUT', payload);
  changePassword = (currentPassword: string, newPassword: string) => this.http.request<Result>('/auth/password', 'PUT', { currentPassword, newPassword });
  requestFunds = (amount: number) => this.http.request<Result>('/auth/wallet/request', 'POST', { amount });
  walletRequests = (page = 1, limit = 5) => this.http.request<RequestResult>(`/auth/wallet/requests?page=${page}&limit=${limit}`);
  pay = (payload: { vendorId: string; amount: number; description: string }) => this.http.request<Result & { transaction?: unknown }>('/auth/pay', 'POST', payload);
  transactions = () => this.http.request<TransactionResult>('/auth/transactions');
  vendors = () => this.http.request<Result & { vendors: User[] }>('/auth/vendors');
  vendor = (id: string) => this.http.request<Result & { vendor: User }>(`/auth/vendors/${encodeURIComponent(id)}`);
  notifications = () => this.http.request<Result & { notifications: Notification[] }>('/auth/notifications');
  clearNotifications = () => this.http.request<Result>('/auth/notifications', 'DELETE');
  registerPushDevice = (token: string, platform: 'android' | 'ios') => this.http.request<Result>('/auth/push/devices', 'POST', { token, platform });
  unregisterPushDevice = (token: string) => this.http.request<Result>('/auth/push/devices', 'DELETE', { token });
  adminStats = () => this.http.request<Result & { stats: AdminStats }>('/admin/stats');
  adminStudents = (search = '') => this.http.request<Result & { students: User[] }>(`/admin/students${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  adminCustomers = (search = '') => this.http.request<Result & { customers: User[] }>(`/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  adminVendors = (search = '') => this.http.request<Result & { vendors: User[] }>(`/admin/vendors${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  createVendor = (payload: { name: string; email: string; phone: string; active: boolean }) => this.http.request<ProfileResult>('/admin/vendors', 'POST', payload);
  setVendorActive = (id: string, active: boolean) => this.http.request<Result>(`/admin/vendor/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`, 'PUT');
  adminTransactions = (vendorId = '') => this.http.request<TransactionResult>(`/admin/transactions${vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : ''}`);
  adminWalletRequests = () => this.http.request<RequestResult>('/admin/wallet/requests');
  reviewRequest = (id: string, status: 'approved' | 'rejected') => this.http.request<Result>(`/admin/wallet/request/${encodeURIComponent(id)}`, 'PUT', { status });
}