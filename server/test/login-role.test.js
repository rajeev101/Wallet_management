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

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const withLoginStubs = async ({ accountType, password = "correct-password", body = {} }, run) => {
  const originalFindOne = User.findOne;
  const originalWalletFindOne = Wallet.findOne;
  const originalCompare = bcrypt.compare;
  User.findOne = async ({ email }) => email === "known@example.test" ? {
    _id: `${accountType}-id`,
    email,
    name: "Test Account",
    password: "hashed-password",
    accountType,
    vendorStatus: "approved",
    toObject() {
      return { _id: this._id, email: this.email, name: this.name, password: this.password, accountType: this.accountType };
    },
  } : null;
  Wallet.findOne = async () => ({ balance: 10 });
  bcrypt.compare = async (candidate) => candidate === password;

  try {
    const req = { body: { email: "known@example.test", password, ...body } };
    const res = createResponse();
    await login(req, res);
    await run(res);
  } finally {
    User.findOne = originalFindOne;
    Wallet.findOne = originalWalletFindOne;
    bcrypt.compare = originalCompare;
  }
};

test("student login trusts the database role when a legacy client role differs", async () => {
  process.env.JWT_SECRET = "role-login-test-secret";
  await withLoginStubs({ accountType: "student", body: { accountType: "customer" } }, (res) => {
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.accountType, "student");
    assert.ok(res.body.token);
  });
});

test("customer login trusts the database role when a legacy client role differs", async () => {
  process.env.JWT_SECRET = "role-login-test-secret";
  await withLoginStubs({ accountType: "customer", body: { accountType: "student" } }, (res) => {
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.accountType, "customer");
    assert.ok(res.body.token);
  });
});

test("student and customer invalid passwords are rejected", async () => {
  for (const accountType of ["student", "customer"]) {
    await withLoginStubs({ accountType, password: "correct-password", body: { password: "wrong-password" } }, (res) => {
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.message, "Invalid credentials");
    });
  }
});

test("unknown email is rejected", async () => {
  const originalFindOne = User.findOne;
  User.findOne = async () => null;
  try {
    const res = createResponse();
    await login({ body: { email: "unknown@example.test", password: "anything" } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "User not found");
  } finally {
    User.findOne = originalFindOne;
  }
});
