const User = require("../models/user.model");
const Wallet = require("../models/wallet.model");
const Transaction = require("../models/transaction.model");

const ensureUserWallets = async () => {
  const users = await User.find({}, "_id accountType").lean();

  if (!users.length) {
    return 0;
  }

  const existingWallets = await Wallet.find(
    { owner: { $in: users.map((user) => user._id) } },
    "owner"
  ).lean();
  const ownersWithWallets = new Set(
    existingWallets.map((wallet) => wallet.owner.toString())
  );
  const missingWallets = users
    .filter((user) => !ownersWithWallets.has(user._id.toString()))
    .map((user) => ({
      owner: user._id,
      balance: 0,
      ownerType: user.accountType,
      status: "active",
    }));

  if (!missingWallets.length) {
    // Sanitize any corrupt or overflow balances
    await Wallet.updateMany(
      { $or: [{ balance: { $gte: 1e12 } }, { balance: { $lt: 0 } }] },
      { $set: { balance: 0 } }
    );

    const completedTxCount = await Transaction.countDocuments({ status: "completed" });
    if (completedTxCount === 0) {
      // If transactions were cleared/empty, reset non-admin wallets to 0
      await Wallet.updateMany({ ownerType: { $ne: "admin" } }, { $set: { balance: 0 } });
    }
    return 0;
  }

  await Wallet.insertMany(missingWallets, { ordered: false });

  // Sanitize any corrupt or overflow balances
  await Wallet.updateMany(
    { $or: [{ balance: { $gte: 1e12 } }, { balance: { $lt: 0 } }] },
    { $set: { balance: 0 } }
  );

  const completedTxCount = await Transaction.countDocuments({ status: "completed" });
  if (completedTxCount === 0) {
    await Wallet.updateMany({ ownerType: { $ne: "admin" } }, { $set: { balance: 0 } });
  }

  return missingWallets.length;
};

module.exports = ensureUserWallets;
