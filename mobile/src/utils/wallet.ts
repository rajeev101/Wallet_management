import type { Party, Period, Role, Transaction, User } from '../types';

export const roles: Role[] = ['student', 'customer'];
export const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
export const partyId = (party?: Party) => typeof party === 'string' ? party : party?._id || party?.id || '';
export const partyName = (party?: Party) => typeof party === 'object' && party ? party.name : '';
export const holder = (transaction: Transaction) => transaction.accountHolder || transaction.student || transaction.customer;
export const money = (value: number | undefined) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0));
export const dateTime = (value?: string) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('en-IN') : 'Not available';
export const userCode = (user: User) => `${({ student: 'STU', customer: 'CUS', vendor: 'VEN', admin: 'ADM' })[user.accountType]}${(user._id || user.id || '').slice(-5).toUpperCase()}`;
export const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).map(part => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
export const emailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export const validVendorId = (value: string) => /^[a-f\d]{24}$/i.test(value.trim());

export function loginAllowed(requested: Role, actual: Role) {
  return roles.includes(requested) && roles.includes(actual) && requested === actual;
}

export function signupPayload(form: { name: string; email: string; password: string; confirmPassword: string; identity: string }, accountType: 'student' | 'customer') {
  if (!form.name.trim()) throw new Error('Full name is required.');
  if (!emailValid(form.email)) throw new Error('Enter a valid email address.');
  if (!form.identity.trim()) throw new Error(`${accountType === 'student' ? 'Student' : 'Samagra'} ID is required.`);
  if (!form.password) throw new Error('Password is required.');
  if (form.password !== form.confirmPassword) throw new Error('Passwords do not match.');
  return { name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, accountType,
    [accountType === 'student' ? 'student_id' : 'samagra_id']: form.identity.trim() };
}

export function positiveAmount(value: string, integerOnly = false) {
  if (!(integerOnly ? /^\d{1,10}$/ : /^\d+(?:\.\d{1,2})?$/).test(value)) throw new Error(integerOnly ? 'Enter a whole amount greater than zero (up to 10 digits).' : 'Enter a positive amount with at most two decimal places.');
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.');
  return amount;
}

export function paymentPayload(vendor: User, value: string, balance: number) {
  if (!validVendorId(vendor._id)) throw new Error('Invalid vendor QR code.');
  const amount = positiveAmount(value);
  if (amount > balance) throw new Error('Insufficient wallet balance.');
  return { vendorId: vendor._id, amount, description: `Paid ${money(amount)} to ${vendor.name}` };
}

export function passwordError(password: string, confirmation: string) {
  return password.length < 8 ? 'Use at least 8 characters.' : password !== confirmation ? 'Passwords do not match.' : '';
}

export function transactionsFor(items: Transaction[], user: User) {
  const id = user._id || user.id;
  return items.filter(transaction => user.accountType === 'vendor'
    ? partyId(transaction.vendor || transaction.toWallet?.owner) === id
    : partyId(holder(transaction) || (transaction.type === 'payment' ? transaction.fromWallet?.owner : transaction.toWallet?.owner)) === id);
}

export function filterTransactions(items: Transaction[], options: { search?: string; period?: Period; status?: string; type?: string; sort?: string } = {}, now = new Date()) {
  const cutoff = new Date(now);
  const period = options.period || 'all';
  if (period.endsWith('m')) cutoff.setMonth(cutoff.getMonth() - Number.parseInt(period));
  if (period.endsWith('d')) cutoff.setDate(cutoff.getDate() - Number.parseInt(period));
  cutoff.setHours(0, 0, 0, 0);
  const search = options.search?.trim().toLowerCase() || '';
  return items.filter(transaction => {
    const type = transaction.type === 'payment' ? 'debit' : 'credit';
    return (!search || transaction._id.toLowerCase().includes(search)) &&
      (period === 'all' || new Date(transaction.createdAt) >= cutoff) &&
      (!options.status || options.status === 'all' || transaction.status === options.status) &&
      (!options.type || options.type === 'all' || options.type === transaction.type || options.type === type);
  }).sort((left, right) => (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * (options.sort === 'oldest' ? 1 : -1));
}

export function summarize(items: Transaction[]) {
  const completed = items.filter(item => item.status === 'completed');
  const payments = completed.filter(item => item.type === 'payment');
  const topups = completed.filter(item => item.type === 'wallet_topup');
  const refunds = completed.filter(item => item.type === 'refund');
  const sum = (records: Transaction[]) => records.reduce((total, item) => total + Number(item.amount), 0);
  const spent = sum(payments);
  const added = sum(topups);
  return { count: items.length, completed: completed.length, pending: items.filter(item => item.status === 'pending').length,
    failed: items.filter(item => item.status === 'failed').length, spent, added,
    credit: added + sum(refunds), debit: spent, revenue: spent - sum(refunds),
    average: payments.length ? spent / payments.length : 0,
    highest: payments.length ? Math.max(...payments.map(item => item.amount)) : 0,
    lowest: payments.length ? Math.min(...payments.map(item => item.amount)) : 0 };
}

export function currentMonth(items: Transaction[], now = new Date()) {
  return items.filter(item => { const date = new Date(item.createdAt); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); });
}

export function todayTransactions(items: Transaction[], now = new Date()) {
  return items.filter(item => new Date(item.createdAt).toDateString() === now.toDateString());
}

export function ledgerBalances(items: Transaction[]) {
  const balances = new Map<string, { before: number; after: number; derived: boolean }>();
  let running = 0;
  const stored = (item: Transaction, fields: (keyof Transaction)[]) => {
    for (const field of fields) if (typeof item[field] === 'number' && Number.isFinite(item[field])) return item[field] as number;
    return undefined;
  };
  [...items].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()).forEach(item => {
    const recordedBefore = stored(item, ['initialBalance', 'balanceBefore', 'walletBalanceBefore']);
    const recordedAfter = stored(item, ['totalBalance', 'balanceAfter', 'walletBalanceAfter', 'runningBalance']);
    const before = recordedBefore ?? running;
    const after = recordedAfter ?? (item.status === 'completed' ? before + (item.type === 'payment' ? -item.amount : item.amount) : before);
    balances.set(item._id, { before, after, derived: recordedBefore === undefined || recordedAfter === undefined });
    if (item.status === 'completed') running = after;
  });
  return balances;
}

export function mergeUnique(current: Transaction[], next: Transaction[]) {
  const records = new Map(current.map(item => [item._id, item]));
  next.forEach(item => records.set(item._id, item));
  return [...records.values()];
}
