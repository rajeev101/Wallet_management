import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentMonth, filterTransactions, ledgerBalances, loginAllowed, mergeUnique, paymentPayload, positiveAmount, roles, signupPayload, summarize, transactionsFor, validVendorId } from '../src/utils/wallet';
import { ApiError, HttpClient } from '../src/services/http';
import { createIdentityStore, type InstallationIdentity } from '../src/services/installationIdentity';
import { WalletApi } from '../src/services/walletApi';
import { requestInitialPermissions, type PermissionAccess } from '../src/services/permissions';
import type { Transaction, User } from '../src/types';

const payer: User = { _id: '111111111111111111111111', name: 'Test Student', email: 'test@example.invalid', accountType: 'student' };
const vendor: User = { _id: '222222222222222222222222', name: 'Test Vendor', email: 'vendor@example.invalid', accountType: 'vendor' };
const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({ _id: 'tx1', amount: 25, type: 'payment', status: 'completed', createdAt: '2026-11-17T10:00:00Z', student: payer, vendor, ...overrides });

test('startup permissions request camera then location without repeating saved choices', async () => {
  const calls: string[] = [];
  const granted: PermissionAccess = { granted: true, status: 'granted', canAskAgain: true };
  const pending: PermissionAccess = { granted: false, status: 'undetermined', canAskAgain: true };
  const unavailable = await requestInitialPermissions(['Camera', 'Location'].map(name => ({ name,
    get: async () => pending,
    request: async () => { calls.push(name); return granted; },
  })));
  assert.deepEqual(calls, ['Camera', 'Location']);
  assert.deepEqual(unavailable, []);
  calls.length = 0;
  assert.deepEqual(await requestInitialPermissions([
    { name: 'Camera', get: async () => granted, request: async () => { calls.push('Camera'); return granted; } },
    { name: 'Location', get: async () => ({ granted: false, status: 'denied', canAskAgain: false }), request: async () => { calls.push('Location'); return granted; } },
  ]), ['Location']);
  assert.deepEqual(calls, []);
});

test('camera permission failure does not prevent requesting foreground location', async () => {
  let locationRequested = false;
  assert.deepEqual(await requestInitialPermissions([
    { name: 'Camera', get: async () => { throw new Error('Camera unavailable'); }, request: async () => { throw new Error('Unexpected request'); } },
    { name: 'Location', get: async () => ({ granted: false, status: 'undetermined', canAskAgain: true }), request: async () => { locationRequested = true; return { granted: true, status: 'granted', canAskAgain: true }; } },
  ]), ['Camera']);
  assert.equal(locationRequested, true);
});

test('signup preserves distinct Student/Customer identity fields', () => {
  const form = { name: ' Test ', email: 'TEST@example.invalid ', password: 'password', confirmPassword: 'password', identity: ' ID1 ' };
  assert.equal(signupPayload(form, 'student').student_id, 'ID1');
  assert.equal(signupPayload(form, 'customer').samagra_id, 'ID1');
  assert.throws(() => signupPayload({ ...form, identity: '' }, 'customer'), /Samagra/);
  assert.throws(() => signupPayload({ ...form, confirmPassword: 'different' }, 'student'), /match/);
});

test('role boundaries preserve Admin and Vendor restrictions', () => {
  assert.deepEqual(roles, ['student', 'customer']);
  assert.equal(loginAllowed('admin', 'admin'), false);
  assert.equal(loginAllowed('admin', 'vendor'), false);
  assert.equal(loginAllowed('student', 'student'), true);
  assert.equal(loginAllowed('customer', 'customer'), true);
  assert.equal(loginAllowed('vendor', 'vendor'), false);
  assert.equal(loginAllowed('student', 'vendor'), false);
  assert.equal(loginAllowed('customer', 'vendor'), false);
  assert.equal(loginAllowed('vendor', 'student'), false);
  assert.equal(loginAllowed('admin', 'student'), false);
  assert.equal(loginAllowed('vendor', 'customer'), false);
  assert.equal(loginAllowed('student', 'customer'), false);
  assert.equal(loginAllowed('customer', 'student'), false);
  assert.equal(loginAllowed('customer', 'admin'), false);
});

test('payment validates ObjectIds, precision, positive amount and balance', () => {
  assert.equal(validVendorId(vendor._id), true);
  for (const value of ['0', '-1', 'Infinity', '1e3', '1.001', '']) assert.throws(() => positiveAmount(value));
  assert.throws(() => positiveAmount('1.5', true));
  assert.throws(() => paymentPayload(vendor, '26', 25), /Insufficient/);
  assert.equal(paymentPayload(vendor, '12.50', 25).amount, 12.5);
});

test('period filtering uses raw ISO dates and combines status/type/ID filters', () => {
  const items = [transaction(), transaction({ _id: 'tx2', createdAt: '2026-10-01', status: 'failed' })];
  assert.equal(filterTransactions(items, { period: '7d' }, new Date('2026-11-17')).length, 1);
  assert.equal(filterTransactions(items, { search: 'TX1', status: 'completed', type: 'debit' }).length, 1);
  assert.equal(currentMonth(items, new Date('2026-11-17')).length, 1);
});

test('failed and pending transactions never inflate completed money summaries', () => {
  const summary = summarize([transaction(), transaction({ _id: 'tx2', amount: 100, status: 'failed' }), transaction({ _id: 'tx3', amount: 50, type: 'wallet_topup' })]);
  assert.equal(summary.spent, 25);
  assert.equal(summary.added, 50);
  assert.equal(summary.average, 25);
});

test('party aliases and paginated deduplication are preserved', () => {
  assert.equal(transactionsFor([transaction()], payer).length, 1);
  assert.equal(transactionsFor([transaction({ student: undefined, customer: { ...payer, accountType: 'customer' } })], payer).length, 1);
  assert.equal(transactionsFor([transaction()], vendor).length, 1);
  assert.equal(mergeUnique([transaction()], [transaction(), transaction({ _id: 'tx2' })]).length, 2);
});

test('ledger uses recorded balances and labels missing-history reconstruction', () => {
  const balances = ledgerBalances([transaction({ initialBalance: 100, totalBalance: 75 }), transaction({ _id: 'tx2', type: 'wallet_topup', amount: 50, createdAt: '2026-11-18' })]);
  assert.deepEqual(balances.get('tx1'), { before: 100, after: 75, derived: false });
  assert.deepEqual(balances.get('tx2'), { before: 75, after: 125, derived: true });
});

test('HTTP service preserves methods, payloads, query encoding and Bearer contracts', async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  const transport: typeof fetch = async (input, options) => { calls.push({ url: String(input), options }); return new Response(JSON.stringify({ success: true }), { status: 200 }); };
  const http = new HttpClient('https://example.invalid/api/v1', transport);
  http.token = 'test-token';
  const api = new WalletApi(http);
  await api.login(payer.email, 'password', 'admin');
  await api.pay(paymentPayload(vendor, '5', 10));
  await api.reviewRequest('tx1', 'approved');
  await api.adminStudents('A & B');
  await api.resetPassword(payer.email, 'newpassword', 'reset-grant');
  assert.equal(JSON.parse(calls[0]!.options!.body as string).accountType, 'admin');
  assert.equal((calls[0]!.options!.headers as Record<string, string>).Authorization, undefined);
  assert.equal((calls[1]!.options!.headers as Record<string, string>).Authorization, 'Bearer test-token');
  assert.equal(calls[2]!.options!.method, 'PUT');
  assert.equal(calls[3]!.url, 'https://example.invalid/api/v1/admin/students?search=A%20%26%20B');
  assert.equal(JSON.parse(calls[4]!.options!.body as string).resetToken, 'reset-grant');
});

test('only protected current-token 401 invalidates a session', async () => {
  const http = new HttpClient('https://example.invalid', async () => new Response('{"message":"Expired"}', { status: 401 }));
  http.token = 'token';
  let invalidations = 0;
  http.onUnauthorized = () => { invalidations += 1; };
  await assert.rejects(http.request('/auth/login', 'POST', {}, false));
  assert.equal(invalidations, 0);
  await assert.rejects(http.request('/auth/profile'));
  assert.equal(invalidations, 1);
});

test('malformed proxy responses, network failures and timeouts surface safe errors', async () => {
  const proxy = new HttpClient('https://example.invalid', async () => new Response('<html>bad gateway</html>', { status: 502 }));
  await assert.rejects(proxy.request('/login', 'POST', {}, false), /unexpected response/);
  const offline = new HttpClient('https://example.invalid', async () => { throw new TypeError('Network failed'); });
  await assert.rejects(offline.request('/login', 'POST', {}, false), /internet connection/);
  const timeout = new HttpClient('https://example.invalid', async (_input, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('abort')))), 5);
  await assert.rejects(timeout.request('/login', 'POST', {}, false), /timed out/);
});

test('installation identity persists across restarts and concurrent reads without logout rotation', async () => {
  let saved: string | null = null;
  let generations = 0;
  const storage = { get: async () => saved, set: async (value: string) => { saved = value; } };
  const generate = async (): Promise<InstallationIdentity> => { generations += 1; return { id: '12345678-1234-4123-8123-123456789abc', credential: 'a'.repeat(64) }; };
  const identity = createIdentityStore(storage, generate);
  const [first, concurrent] = await Promise.all([identity(), identity()]);
  assert.deepEqual(first, concurrent); assert.equal(generations, 1);
  assert.deepEqual(await createIdentityStore(storage, generate)(), first);
  assert.equal(generations, 1);
});

test('corrupted secure device identity is not silently replaced', async () => {
  let generated = false;
  const read = createIdentityStore({ get: async () => '{invalid', set: async () => {} }, async () => { generated = true; return { id: '', credential: '' }; });
  await assert.rejects(read(), /contact admin/);
  assert.equal(generated, false);
});

test('mobile login sends device metadata and retains structured device errors', async () => {
  const device = { id: '12345678-1234-4123-8123-123456789abc', credential: 'a'.repeat(64), name: 'Phone', platform: 'ios' as const, osVersion: '18', appVersion: '1.0.2' };
  let payload: Record<string, unknown> = {};
  const http = new HttpClient('https://example.invalid', async (_input, options) => {
    payload = JSON.parse(options!.body as string);
    return new Response(JSON.stringify({ success: false, code: 'DEVICE_ALREADY_REGISTERED', message: 'Your account is already registered on another device. Please contact admin.' }), { status: 403 });
  });
  await assert.rejects(new WalletApi(http).login(payer.email, 'password', 'student', device), failure => failure instanceof ApiError && failure.code === 'DEVICE_ALREADY_REGISTERED' && /contact admin/.test(failure.message));
  assert.equal(payload.clientType, 'mobile'); assert.deepEqual(payload.device, device); assert.equal(payload.accountType, undefined);
});

test('device storage failures fail closed before an identity is returned', async () => {
  let generated = false;
  const blocked = createIdentityStore({ get: async () => { throw new Error('Keychain locked'); }, set: async () => {} }, async () => { generated = true; return { id: '', credential: '' }; });
  await assert.rejects(blocked(), /Keychain locked/); assert.equal(generated, false);
  const identity = { id: '12345678-1234-4123-8123-123456789abc', credential: 'a'.repeat(64) };
  const unwritable = createIdentityStore({ get: async () => null, set: async () => { throw new Error('Storage unavailable'); } }, async () => identity);
  await assert.rejects(unwritable(), /Storage unavailable/);
});

test('a cleared installation receives a new identity instead of reusing an account binding', async () => {
  let saved: string | null = null;
  const storage = { get: async () => saved, set: async (value: string) => { saved = value; } };
  const first = { id: '12345678-1234-4123-8123-123456789abc', credential: 'a'.repeat(64) };
  assert.deepEqual(await createIdentityStore(storage, async () => first)(), first);
  saved = null;
  const replacement = { id: '87654321-4321-4123-8123-123456789abc', credential: 'b'.repeat(64) };
  assert.deepEqual(await createIdentityStore(storage, async () => replacement)(), replacement);
});