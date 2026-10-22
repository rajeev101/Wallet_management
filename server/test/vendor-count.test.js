const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/user.model");
const Transaction = require("../src/models/transaction.model");
const Wallet = require("../src/models/wallet.model");
const { getDashboardStats } = require("../src/controllers/admin.controller");

test("dashboard vendor total counts approved vendors only", async () => {
  const originalUserCount = User.countDocuments;
  const originalTransactionCount = Transaction.countDocuments;
  const originalTransactionAggregate = Transaction.aggregate;
  const originalWalletAggregate = Wallet.aggregate;
  const userCountFilters = [];
  const vendorRecords = [
    { accountType: "vendor", vendorStatus: "approved" },
    { accountType: "vendor", vendorStatus: "rejected" },
    { accountType: "vendor", vendorStatus: "unknown" },
  ];

  User.countDocuments = async (filter) => {
    userCountFilters.push(filter);
    return filter.accountType === "vendor"
      ? vendorRecords.filter((vendor) => vendor.vendorStatus === filter.vendorStatus).length
      : 20;
  };
  Transaction.countDocuments = async () => 0;
  Transaction.aggregate = async () => [];
  Wallet.aggregate = async () => [];

  try {
    const res = {
      statusCode: 200,
      body: null,
      status(statusCode) { this.statusCode = statusCode; return this; },
      json(body) { this.body = body; return this; },
    };
    await getDashboardStats({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.stats.totalVendors, 1);
    assert.ok(userCountFilters.some((filter) =>
      filter.accountType === "vendor" && filter.vendorStatus === "approved"
    ));

    vendorRecords[0].vendorStatus = "rejected";
    await getDashboardStats({}, res);
    assert.equal(res.body.stats.totalVendors, 0);

    vendorRecords[0].vendorStatus = "approved";
    await getDashboardStats({}, res);
    assert.equal(res.body.stats.totalVendors, 1);
  } finally {
    User.countDocuments = originalUserCount;
    Transaction.countDocuments = originalTransactionCount;
    Transaction.aggregate = originalTransactionAggregate;
    Wallet.aggregate = originalWalletAggregate;
  }
});
