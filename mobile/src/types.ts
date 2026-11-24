export type Role = 'student' | 'customer' | 'vendor' | 'admin';
export type PayerRole = 'student' | 'customer';
export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  accountType: Role;
  profilePicture?: string;
  walletBalance?: number;
  vendorStatus?: 'approved' | 'pending' | 'rejected';
  accountStatus?: string;
  createdAt?: string;
  student_id?: string;
  samagra_id?: string;
  owner?: string;
  totalSales?: number;
}
export type Party = User | string | null;
export interface Transaction {
  _id: string;
  id?: string;
  type: 'payment' | 'wallet_topup' | 'refund';
  status: 'completed' | 'pending' | 'failed';
  amount: number;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  accountHolder?: Party;
  student?: Party;
  customer?: Party;
  vendor?: Party;
  createdBy?: Party;
  fromWallet?: { owner?: Party };
  toWallet?: { owner?: Party };
  initialBalance?: number;
  balanceBefore?: number;
  walletBalanceBefore?: number;
  totalBalance?: number;
  balanceAfter?: number;
  walletBalanceAfter?: number;
  runningBalance?: number;
}
export interface Notification {
  _id: string;
  text: string;
  type: string;
  createdAt: string;
}
export interface AdminStats {
  totalStudents: number;
  totalCustomers: number;
  totalVendors: number;
  totalTransactions: number;
  totalWalletBalance: number;
  averageWalletBalance: number;
  totalMoneyAdded: number;
  totalPayments: number;
}
export interface Result { success: boolean; message?: string }
export interface ProfileResult extends Result { user: User }
export interface LoginResult extends ProfileResult { token: string }
export interface TransactionResult extends Result { transactions: Transaction[] }
export interface RequestResult extends Result { requests: Transaction[]; hasMore?: boolean }
export type Period = 'all' | '3d' | '7d' | '15d' | '1m' | '3m';
export type AnalyticsKind = 'spend' | 'add' | 'average' | 'today' | 'month' | 'total' | 'orders';