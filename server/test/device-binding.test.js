const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const Module = require("node:module");
const emailServicePath = require.resolve("../src/services/email.service");
const emailServiceStub = new Module(emailServicePath, module);
emailServiceStub.loaded = true;
emailServiceStub.exports = {};
require.cache[emailServicePath] = emailServiceStub;
const app = require("../src/app");
const User = require("../src/models/user.model");
const { authorizeDeviceLogin, resetDevice, digest } = require("../src/services/deviceBinding.service");
const generateToken = require("../src/utils/generateToken");
const bcrypt = require("bcryptjs");
let database;
let server;
let baseUrl;
let admin;
let adminToken;

const device = (platform = "android") => ({ id: crypto.randomUUID(), credential: crypto.randomBytes(32).toString("hex"), platform, name: "QA phone", osVersion: "14", appVersion: "1.0.2" });
const payload = info => ({ clientType: "mobile", device: info });
const createUser = async (accountType = "student") => User.create({ name: "QA account", email: `${crypto.randomUUID()}@example.test`, password: await bcrypt.hash("test-password", 4), accountType, student_id: "ST001", samagra_id: "CU001" });
const loadUser = id => User.findById(id).select("+deviceBinding +deviceResetHistory");
async function request(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
const login = (user, info) => request("/auth/login", { method: "POST", body: { email: user.email, password: "test-password", ...(info ? payload(info) : {}) } });

test.before(async () => {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: "device-binding-tests" });
  await Promise.all([User.init(), require("../src/models/revokedToken.model").init(), require("../src/models/deviceAttempt.model").init()]);
  admin = await createUser("admin");
  adminToken = generateToken(admin._id, { authVersion: 0 });
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});
test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});

for (const [role, platform] of [["student", "android"], ["student", "ios"], ["customer", "android"]]) {
  test(`${role} first ${platform} login binds device and hides credentials`, async () => {
    const user = await createUser(role);
    const info = device(platform);
    const result = await login(user, info);
    assert.equal(result.status, 200);
    const stored = await loadUser(user._id);
    assert.equal(stored.deviceBinding.id, info.id);
    assert.equal(stored.deviceBinding.credentialHash, digest(info.credential));
    assert.equal(stored.deviceLockEnabled, true);
    assert.ok(stored.deviceBinding.registeredAt);
    assert.ok(stored.deviceBinding.lastLoginAt);
    assert.equal(result.body.user.deviceBinding, undefined);
    assert.equal(jwt.verify(result.body.token, process.env.JWT_SECRET).deviceIdHash, digest(info.id));
  });
}

test("logout revokes only that session and preserves same-device re-login", async () => {
  const user = await createUser(); const info = device();
  const first = await login(user, info); const second = await login(user, info);
  assert.equal((await request("/auth/logout", { method: "DELETE", token: first.body.token })).status, 200);
  assert.equal((await request("/auth/profile", { token: first.body.token })).status, 401);
  assert.equal((await request("/auth/profile", { token: second.body.token })).status, 200);
  assert.equal((await loadUser(user._id)).deviceBinding.id, info.id);
  assert.equal((await login(user, info)).status, 200);
});

test("different device and spoofed UUID are blocked, audited and do not invalidate Device A", async () => {
  const user = await createUser(); const info = device(); const first = await login(user, info);
  for (const incoming of [device(), { ...device(), id: info.id }]) {
    const blocked = await login(user, incoming);
    assert.equal(blocked.status, 403); assert.equal(blocked.body.code, "DEVICE_ALREADY_REGISTERED"); assert.equal(blocked.body.token, undefined);
  }
  assert.equal((await loadUser(user._id)).deviceBinding.id, info.id);
  assert.equal((await request("/auth/profile", { token: first.body.token })).status, 200);
  const attempts = await request(`/admin/devices/${user._id}/attempts`, { token: adminToken });
  assert.equal(attempts.body.total, 2);
  assert.equal(JSON.stringify(attempts.body).includes("credential"), false);
});

test("Admin reset atomically revokes all old sessions, records history and locks the next device", async () => {
  const user = await createUser("customer"); const oldInfo = device();
  const first = await login(user, oldInfo); const second = await login(user, oldInfo);
  const before = await loadUser(user._id);
  const result = await request(`/admin/devices/${user._id}/reset`, { token: adminToken, method: "POST", body: { expectedVersion: before.authVersion, reason: "Customer replaced a broken phone" } });
  assert.equal(result.status, 200); assert.equal(result.body.code, "DEVICE_RESET_SUCCESS");
  const reset = await loadUser(user._id);
  assert.equal(reset.deviceBinding, null); assert.equal(reset.deviceLockEnabled, true);
  assert.equal(reset.deviceResetHistory[0].adminName, admin.name);
  assert.equal(reset.deviceResetHistory[0].previousDevice.credentialHash, undefined);
  for (const token of [first.body.token, second.body.token]) assert.equal((await request("/auth/profile", { token })).status, 401);
  const next = device("ios"); assert.equal((await login(user, next)).status, 200);
  assert.equal((await login(user, oldInfo)).body.code, "DEVICE_ALREADY_REGISTERED");
  assert.equal((await login(user, device())).status, 403);
  assert.equal((await loadUser(user._id)).deviceBinding.id, next.id);
  const history = await request(`/admin/devices/${user._id}/history`, { token: adminToken });
  assert.equal(history.body.history[0].reason, "Customer replaced a broken phone");
});

test("simultaneous first logins from different devices admit exactly one", async () => {
  const user = await createUser();
  const first = device(); const second = device();
  const results = await Promise.allSettled([authorizeDeviceLogin(await loadUser(user._id), payload(first)), authorizeDeviceLogin(await loadUser(user._id), payload(second))]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.find(result => result.status === "rejected").reason.code, "DEVICE_ALREADY_REGISTERED");
});

test("simultaneous same-device registration succeeds consistently", async () => {
  const user = await createUser(); const info = device();
  const results = await Promise.all([authorizeDeviceLogin(await loadUser(user._id), payload(info)), authorizeDeviceLogin(await loadUser(user._id), payload(info))]);
  assert.equal(results[0].authVersion, results[1].authVersion);
  assert.equal((await loadUser(user._id)).authVersion, 1);
});

test("reset/login races preserve a single binding and invalidate any pre-reset token", async () => {
  const user = await createUser(); const info = device(); await login(user, info);
  const snapshot = await loadUser(user._id);
  const results = await Promise.allSettled([authorizeDeviceLogin(snapshot, payload(info)), resetDevice(snapshot, admin, "Concurrent device replacement test")]);
  assert.equal(results[1].status, "fulfilled");
  const stored = await loadUser(user._id);
  assert.equal(stored.deviceBinding, null);
  if (results[0].status === "fulfilled") {
    const token = generateToken(user._id, results[0].value);
    assert.equal((await request("/auth/profile", { token })).status, 401);
  } else assert.equal(results[0].reason.code, "AUTH_STATE_CHANGED");
});

test("unauthorized resets and stale Admin versions cannot modify bindings", async () => {
  const user = await createUser(); const result = await login(user, device());
  const path = `/admin/devices/${user._id}/reset`;
  const body = { reason: "Attempt unauthorized device reset", expectedVersion: 1 };
  assert.equal((await request(path, { method: "POST", body })).status, 401);
  assert.equal((await request(path, { method: "POST", body, token: result.body.token })).status, 403);
  assert.equal((await request(path, { method: "POST", body: { ...body, expectedVersion: 0 }, token: adminToken })).status, 409);
  assert.equal((await request(path, { method: "POST", body: { ...body, reason: "short" }, token: adminToken })).status, 400);
  assert.equal((await loadUser(user._id)).authVersion, 1);
});

test("legacy unbound browser users work until first mobile binding; no browser bypass after reset", async () => {
  const user = await createUser();
  await User.collection.updateOne({ _id: user._id }, { $unset: { authVersion: "", deviceBinding: "", deviceLockEnabled: "" } });
  const legacyToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  assert.equal((await request("/auth/profile", { token: legacyToken })).status, 200);
  assert.equal((await login(user)).status, 200);
  await login(user, device());
  assert.equal((await request("/auth/profile", { token: legacyToken })).status, 401);
  assert.equal((await login(user)).body.code, "DEVICE_ALREADY_REGISTERED");
  await resetDevice(await loadUser(user._id), admin, "Legacy account device replacement");
  assert.equal((await login(user)).body.code, "MOBILE_DEVICE_REQUIRED");
});

test("reinstall/data-clear identity is rejected; multiple accounts may use one device", async () => {
  const info = device(); const first = await createUser(); const second = await createUser("customer");
  assert.equal((await login(first, info)).status, 200);
  assert.equal((await login(second, info)).status, 200);
  assert.equal((await login(first, device())).body.code, "DEVICE_ALREADY_REGISTERED");
});

test("invalid mobile metadata and wrong passwords never bind or issue tokens", async () => {
  const user = await createUser();
  for (const body of [ { clientType: "mobile" }, payload({ ...device(), platform: "web" }), payload({ ...device(), credential: "invalid" }) ]) {
    const result = await request("/auth/login", { method: "POST", body: { email: user.email, password: "test-password", ...body } });
    assert.equal(result.status, 400); assert.equal(result.body.token, undefined);
  }
  const invalidPassword = await request("/auth/login", { method: "POST", body: { email: user.email, password: "wrong-password", ...payload(device()) } });
  assert.equal(invalidPassword.status, 401);
  assert.equal((await loadUser(user._id)).deviceBinding, null);
});

test("expired tokens and absent refresh API cannot extend a revoked session", async () => {
  const user = await createUser();
  const expired = jwt.sign({ userId: user._id, authVersion: 0 }, process.env.JWT_SECRET, { expiresIn: -1 });
  assert.equal((await request("/auth/profile", { token: expired })).status, 401);
  const response = await fetch(`${baseUrl}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: expired }) });
  assert.equal(response.status, 404);
});

test("Admin list supports account/state filters, literal search, sorting and pagination without exposing hashes", async () => {
  const result = await request("/admin/devices?role=customer&status=locked&limit=1&page=1&sort=lastLoginAt&direction=desc", { token: adminToken });
  assert.equal(result.status, 200); assert.equal(result.body.devices.length, 1);
  assert.equal(result.body.devices[0].accountType, "customer"); assert.equal(result.body.devices[0].lockStatus, "locked");
  assert.equal(JSON.stringify(result.body).includes("credentialHash"), false);
  assert.equal((await request("/admin/devices?search=%5B", { token: adminToken })).status, 200);
  assert.equal((await request("/admin/devices?role=admin", { token: adminToken })).status, 400);
  assert.equal((await request("/admin/devices?page=-1", { token: adminToken })).status, 400);
  assert.equal((await request("/admin/devices/not-an-id", { token: adminToken })).status, 400);
});

test("Student cannot read Admin device details, history or blocked attempts", async () => {
  const user = await createUser(); const result = await login(user, device());
  for (const path of ["/admin/devices", `/admin/devices/${user._id}`, `/admin/devices/${user._id}/history`, `/admin/devices/${user._id}/attempts`]) {
    assert.equal((await request(path, { token: result.body.token })).status, 403);
  }
});

test("Admin reset excludes stale push-device registrations without sending to Expo", async () => {
  const user = await createUser(); await login(user, device());
  const before = await loadUser(user._id);
  const PushDevice = require("../src/models/pushDevice.model");
  const PushDelivery = require("../src/models/pushDelivery.model");
  await PushDevice.create({ token: `ExponentPushToken[${crypto.randomUUID()}]`, owner: user._id, platform: "android", authVersion: before.authVersion, expiresAt: new Date(Date.now() + 3600000) });
  await resetDevice(before, admin, "Verify old device push revocation");
  const job = await PushDelivery.create({ eventKey: crypto.randomUUID(), recipient: user._id, transactionId: new mongoose.Types.ObjectId(), title: "Test transaction", body: "Generic wallet alert" });
  const { Expo } = require("expo-server-sdk");
  const originalSend = Expo.prototype.sendPushNotificationsAsync;
  let sent = false;
  Expo.prototype.sendPushNotificationsAsync = async () => { sent = true; throw new Error("Real push delivery is forbidden in tests"); };
  try {
    await require("../src/services/push.service").runPushWorkerOnce();
    assert.equal(sent, false);
    assert.equal((await PushDelivery.findById(job._id)).status, "sent");
  } finally { Expo.prototype.sendPushNotificationsAsync = originalSend; }
});

test("login throttles repeated invalid credentials without issuing a token", async () => {
  let last;
  for (let attempt = 0; attempt < 35; attempt += 1) {
    last = await request("/auth/login", { method: "POST", body: { email: "missing@example.test", password: "invalid-password" } });
    if (last.status === 429) break;
  }
  assert.equal(last.status, 429); assert.equal(last.body.code, "LOGIN_RATE_LIMITED"); assert.equal(last.body.token, undefined);
});