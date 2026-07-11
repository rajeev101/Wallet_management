const User = require("../models/user.model");
const Wallet = require("../models/wallet.model");

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
    return 0;
  }

  await Wallet.insertMany(missingWallets, { ordered: false });
  return missingWallets.length;
};

module.exports = ensureUserWallets;
