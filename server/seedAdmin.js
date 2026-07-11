const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

const User = require("./src/models/user.model");
const Wallet = require("./src/models/wallet.model");

dotenv.config();

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const existingAdmin = await User.findOne({
      email: "admin@gmail.com",
    });

    if (existingAdmin) {
      console.log("✅ Admin already exists.");
      process.exit();
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    const admin = await User.create({
      name: "Super Admin",
      email: "admin@gmail.com",
      password: hashedPassword,
      accountType: "admin",
      isVerified: true,
    });

    await Wallet.create({
      owner: admin._id,
      balance: 0,
      ownerType: "admin",
      status: "active",
    });

    console.log("✅ Admin created successfully.");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedAdmin();