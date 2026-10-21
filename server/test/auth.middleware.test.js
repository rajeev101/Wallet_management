const test = require("node:test");
const assert = require("node:assert/strict");
const authMiddleware = require("../src/middlewares/auth.middleware");
const User = require("../src/models/user.model");
const jwt = require("jsonwebtoken");

const invokeRoleGuard = (role, allowedRole) => {
  const req = { user: role ? { userId: "user-id", accountType: role } : null };
  let nextCalled = false;
  let responseStatus;
  let responseBody;
  const res = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  authMiddleware.requireRoles(allowedRole)(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled, responseStatus, responseBody };
};

test("role guard allows the authenticated role", () => {
  assert.equal(invokeRoleGuard("student", "student").nextCalled, true);
});

test("role guard rejects a different authenticated role with 403", () => {
  const result = invokeRoleGuard("vendor", "student");
  assert.equal(result.nextCalled, false);
  assert.equal(result.responseStatus, 403);
});

test("role guard rejects a missing identity with 401", () => {
  const result = invokeRoleGuard(null, "student");
  assert.equal(result.nextCalled, false);
  assert.equal(result.responseStatus, 401);
});

test("protected requests reject a vendor deactivated after login", async () => {
  const originalFindById = User.findById;
  process.env.JWT_SECRET = "vendor-status-test-secret";
  User.findById = () => ({
    select: async () => ({
      _id: { toString: () => "vendor-id" },
      accountType: "vendor",
      vendorStatus: "rejected",
    }),
  });

  try {
    const token = jwt.sign({ userId: "vendor-id" }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    let responseStatus;
    let responseBody;
    let nextCalled = false;
    const res = {
      status(status) { responseStatus = status; return this; },
      json(body) { responseBody = body; return this; },
    };

    await authMiddleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(responseStatus, 403);
    assert.match(responseBody.message, /vendor account is inactive/i);
  } finally {
    User.findById = originalFindById;
  }
});

test("protected requests allow an approved vendor", async () => {
  const originalFindById = User.findById;
  process.env.JWT_SECRET = "vendor-status-test-secret";
  User.findById = () => ({
    select: async () => ({
      _id: { toString: () => "vendor-id" },
      accountType: "vendor",
      vendorStatus: "approved",
    }),
  });

  try {
    const token = jwt.sign({ userId: "vendor-id" }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    let nextCalled = false;
    const res = { status() { return this; }, json() { return this; } };

    await authMiddleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.accountType, "vendor");
  } finally {
    User.findById = originalFindById;
  }
});
