const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/user.model");
const Wallet = require("../src/models/wallet.model");
const bcrypt = require("bcryptjs");
const Module = require("node:module");
const emailServicePath = require.resolve("../src/services/email.service");
const emailServiceStub = new Module(emailServicePath, module);
emailServiceStub.filename = emailServicePath;
emailServiceStub.loaded = true;
emailServiceStub.exports = {};
require.cache[emailServicePath] = emailServiceStub;
const { login } = require("../src/controllers/auth.controller");

const makeResponse = () => {
  const response = { statusCode: 200, body: null };
  response.status = (statusCode) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (body) => {
    response.body = body;
    return response;
  };
  return response;
};

const makeUser = (accountType, vendorStatus) => ({
  _id: "vendor-id",
  name: "Test Vendor",
  email: "vendor@example.test",
  password: "hashed-password",
  accountType,
  vendorStatus,
  toObject() {
    return {
      _id: this._id,
      name: this.name,
      email: this.email,
      password: this.password,
      accountType: this.accountType,
      vendorStatus: this.vendorStatus,
    };
  },
});

const withLoginStubs = async (accountType, vendorStatus, run) => {
  const originalFindOne = User.findOne;
  const originalWalletFindOne = Wallet.findOne;
  const originalCompare = bcrypt.compare;
  let walletLookupCount = 0;
  User.findOne = async () => makeUser(accountType, vendorStatus);
  Wallet.findOne = async () => {
    walletLookupCount += 1;
    return { balance: 35 };
  };
  bcrypt.compare = async (password, hash) => password === "valid-password" && hash === "hashed-password";

  try {
    const req = { body: { email: "vendor@example.test", password: "valid-password" } };
    const res = makeResponse();
    await login(req, res);
    await run(res, () => walletLookupCount);
  } finally {
    User.findOne = originalFindOne;
    Wallet.findOne = originalWalletFindOne;
    bcrypt.compare = originalCompare;
  }
};

test("approved vendor can log in with valid credentials", async () => {
  process.env.JWT_SECRET = "vendor-login-test-secret";
  await withLoginStubs("vendor", "approved", (res, walletLookups) => {
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(walletLookups(), 1);
  });
});

test("non-approved vendor login is rejected before issuing a token or loading wallet", async () => {
  await withLoginStubs("vendor", "rejected", (res, walletLookups) => {
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /vendor account is inactive/i);
    assert.equal(res.body.token, undefined);
    assert.equal(walletLookups(), 0);
  });
});

test("unknown vendor status is rejected at login", async () => {
  await withLoginStubs("vendor", "unknown", (res, walletLookups) => {
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.token, undefined);
    assert.equal(walletLookups(), 0);
  });
});

test("reactivating a rejected vendor restores login", async () => {
  await withLoginStubs("vendor", "rejected", (res) => {
    assert.equal(res.statusCode, 403);
  });
  await withLoginStubs("vendor", "approved", (res) => {
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.token);
  });
});

test("student and admin login are not affected by vendor status enforcement", async () => {
  for (const accountType of ["student", "admin"]) {
    await withLoginStubs(accountType, "rejected", (res) => {
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.token);
    });
  }
});
