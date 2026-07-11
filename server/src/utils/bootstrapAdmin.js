const bcrypt = require("bcryptjs");
const User = require("../models/user.model");

const DEFAULT_ADMIN = {
  name: "Super Admin",
  email: "admin@campuswallet.com",
  password: "Admin@123456",
};

const bootstrapAdmin = async () => {
  const isDisabled = String(process.env.BOOTSTRAP_ADMIN || "").toLowerCase() === "false";

  if (isDisabled) {
    console.log("Admin bootstrap skipped.");
    return;
  }

  const adminName = process.env.ADMIN_NAME || DEFAULT_ADMIN.name;
  const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN.email).toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN.password;

  if (!adminEmail || !adminPassword) {
    console.warn("Admin bootstrap skipped: ADMIN_EMAIL or ADMIN_PASSWORD is missing.");
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await User.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        accountType: "admin",
        isVerified: true,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  const Wallet = require("../models/wallet.model");
  let wallet = await Wallet.findOne({ owner: adminUser._id });
  if (!wallet) {
    await Wallet.create({
      owner: adminUser._id,
      balance: 0,
      ownerType: "admin",
      status: "active",
    });
  }

  console.log(`Admin account ready: ${adminEmail}`);
};

module.exports = bootstrapAdmin;
