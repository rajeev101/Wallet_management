const User = require("../models/user.model");
const Wallet = require("../models/wallet.model");
const OTP = require("../models/otp.model");
const Transaction = require("../models/transaction.model");
const Notification = require("../models/notification.model");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const { sendOTPEmail, sendPasswordResetSuccessEmail } = require("../utils/email");

const crypto = require("crypto");
const transporter = require("../services/email.service");

const notifyAdmins = async ({ type, text }) => {
  const admins = await User.find({ accountType: "admin" }).select("_id");
  if (!admins.length) return;

  await Notification.insertMany(
    admins.map((admin) => ({
      recipient: admin._id,
      type,
      text,
    }))
  );
};

// SIGNUP
exports.signup = async (req, res) => {
  try {
    const { name, email, password, accountType } = req.body;
    const requestedAccountType = String(accountType || "student").toLowerCase();

    if (!["student", "vendor"].includes(requestedAccountType)) {
      return res.status(400).json({
        success: false,
        message: "Account type must be student or vendor",
      });
    }

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      accountType: requestedAccountType,
    });

    let wallet;

    try {
      wallet = await Wallet.create({
        owner: user._id,
        balance: 0,
        ownerType: requestedAccountType,
        status: "active",
      });
    } catch (walletError) {
      await User.deleteOne({ _id: user._id });
      throw walletError;
    }

    const safeUser = user.toObject();
    delete safeUser.password;
    safeUser.walletBalance = wallet.balance;

    await notifyAdmins({
      type: "wallet_request",
      text: `New ${requestedAccountType} account: ${safeUser.name} (${safeUser.email}) registered.`,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: safeUser,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// LOGIN
exports.login = async (req, res) => {
  try {

    const email = String(req.body.email || "").toLowerCase().trim();
    const { password } = req.body;

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user._id);

    let wallet = await Wallet.findOne({ owner: user._id });
    if (!wallet) {
      wallet = await Wallet.create({
        owner: user._id,
        balance: 0,
        ownerType: user.accountType,
        status: "active",
      });
    }

    const safeUser = user.toObject();
    delete safeUser.password;
    safeUser.walletBalance = wallet.balance;

    res.status(200).json({
      success: true,
      token,
      user: safeUser,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// GET PROFILE
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let wallet = await Wallet.findOne({ owner: user._id });
    if (!wallet) {
      wallet = await Wallet.create({
        owner: user._id,
        balance: 0,
        ownerType: user.accountType,
        status: "active",
      });
    }

    const userObj = user.toObject();
    userObj.walletBalance = wallet.balance;

    res.status(200).json({
      success: true,
      user: userObj,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phone, profilePicture } = req.body;

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const profileUpdates = {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || "",
    };

    if (profilePicture !== undefined) {
      profileUpdates.profilePicture = profilePicture || "";
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      profileUpdates,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let wallet = await Wallet.findOne({ owner: updatedUser._id });
    if (!wallet) {
      wallet = await Wallet.create({
        owner: updatedUser._id,
        balance: 0,
        ownerType: updatedUser.accountType,
        status: "active",
      });
    }

    const userObj = updatedUser.toObject();
    userObj.walletBalance = wallet.balance;

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: userObj,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// LOGOUT
exports.logout = async (req, res) => {
  try {

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email: email.toLowerCase() });

    // Save OTP with 5-minute expiry
    await OTP.create({
      email: email.toLowerCase(),
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Send OTP via email
    await sendOTPEmail(email, otp);

    res.status(200).json({
      success: true,
      message: "OTP sent to your email",
      email: email,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// VERIFY OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate inputs
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      otp,
    });

    if (!otpRecord) {
      // Increment attempts
      const failedRecord = await OTP.findOne({
        email: email.toLowerCase(),
      });

      if (failedRecord) {
        failedRecord.attempts += 1;
        await failedRecord.save();

        if (failedRecord.attempts >= failedRecord.maxAttempts) {
          await OTP.deleteOne({ _id: failedRecord._id });
          return res.status(401).json({
            success: false,
            message: "Too many failed attempts. Please request a new OTP.",
          });
        }

        return res.status(401).json({
          success: false,
          message: `Invalid OTP. ${failedRecord.maxAttempts - failedRecord.attempts} attempts remaining.`,
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(401).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // OTP is valid
    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      email: email,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Validate inputs
    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required",
      });
    }

    // Validate password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Find user
    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Delete OTP record
    await OTP.deleteMany({ email: email.toLowerCase() });

    // Send success email
    try {
      await sendPasswordResetSuccessEmail(email, user.name);
    } catch (emailError) {
      console.error("Email sending failed but password was reset:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Wallet request handlers
exports.createWalletRequest = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { amount } = req.body;
    const parsedAmount = Number(amount);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    let wallet = await Wallet.findOne({ owner: userId });
    if (!wallet) {
      wallet = await Wallet.create({
        owner: userId,
        balance: 0,
        ownerType: req.user?.accountType || "student",
        status: "active",
      });
    }

    const transaction = await Transaction.create({
      toWallet: wallet._id,
      type: "wallet_topup",
      amount: parsedAmount,
      status: "pending",
      description: "Requested add money to admin",
    });

    const [requester, admins] = await Promise.all([
      User.findById(userId).select("name"),
      User.find({ accountType: "admin" }).select("_id"),
    ]);

    if (admins.length) {
      await Notification.insertMany(
        admins.map((admin) => ({
          recipient: admin._id,
          type: "wallet_request",
          text: `Money Request: ${requester?.name || "A student"} requested ₹${parsedAmount.toFixed(2)}.`,
        }))
      );
    }

    res.status(201).json({
      success: true,
      message: "Wallet request submitted successfully",
      transaction,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getStudentWalletRequests = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let wallet = await Wallet.findOne({ owner: userId });
    if (!wallet) {
      return res.status(200).json({
        success: true,
        requests: [],
      });
    }

    const requests = await Transaction.find({
      toWallet: wallet._id,
      type: "wallet_topup",
    })
      .populate({
        path: "toWallet",
        populate: { path: "owner", select: "name email" }
      })
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map(reqObj => {
      const r = reqObj.toObject();
      r.student = r.toWallet?.owner;
      return r;
    });

    res.status(200).json({
      success: true,
      requests: formattedRequests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.makePayment = async (req, res) => {
  try {
    const studentId = req.user?.userId;
    const { vendorId, amount } = req.body;
    const parsedAmount = Number(amount);

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!vendorId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID and valid positive amount are required",
      });
    }

    // Find student
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Find student's wallet
    let studentWallet = await Wallet.findOne({ owner: studentId });
    if (!studentWallet) {
      studentWallet = await Wallet.create({
        owner: studentId,
        balance: 0,
        ownerType: "student",
        status: "active",
      });
    }

    // Check student balance
    if (studentWallet.balance < parsedAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    // Find vendor
    const vendor = await User.findOne({ _id: vendorId, accountType: "vendor" });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or invalid account type",
      });
    }

    if (vendor.vendorStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Vendor is not approved to accept payments",
      });
    }

    // Find vendor's wallet
    let vendorWallet = await Wallet.findOne({ owner: vendorId });
    if (!vendorWallet) {
      vendorWallet = await Wallet.create({
        owner: vendorId,
        balance: 0,
        ownerType: "vendor",
        status: "active",
      });
    }

    // Perform transaction (deduct student wallet, add vendor wallet)
    studentWallet.balance -= parsedAmount;
    vendorWallet.balance += parsedAmount;

    await studentWallet.save();
    await vendorWallet.save();

    // Create payment transaction
    const transaction = await Transaction.create({
      fromWallet: studentWallet._id,
      toWallet: vendorWallet._id,
      type: "payment",
      amount: parsedAmount,
      status: "completed",
      description: `Payment to ${vendor.name}`,
    });

    await Promise.all([
      Notification.create({
        recipient: vendor._id,
        type: "payment",
        text: `Payment Received: ₹${parsedAmount.toFixed(2)} from ${student.name}.`,
      }),
      notifyAdmins({
        type: "payment",
        text: `Payment alert: ${student.name} paid ₹${parsedAmount.toFixed(2)} to ${vendor.name}.`,
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Payment completed successfully",
      transaction,
      newBalance: studentWallet.balance,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getMyTransactions = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const userType = req.user?.accountType;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let wallet = await Wallet.findOne({ owner: userId });
    if (!wallet) {
      wallet = await Wallet.create({
        owner: userId,
        balance: 0,
        ownerType: userType,
        status: "active",
      });
    }

    const transactions = await Transaction.find({
      $or: [{ fromWallet: wallet._id }, { toWallet: wallet._id }],
    })
      .populate({
        path: "fromWallet",
        populate: { path: "owner", select: "name email" }
      })
      .populate({
        path: "toWallet",
        populate: { path: "owner", select: "name email" }
      })
      .sort({ createdAt: -1 });

    const formattedTransactions = transactions.map(t => {
      const tObj = t.toObject();
      if (tObj.type === "wallet_topup") {
        tObj.student = tObj.toWallet?.owner;
      } else if (tObj.type === "payment") {
        tObj.student = tObj.fromWallet?.owner;
        tObj.vendor = tObj.toWallet?.owner;
      } else if (tObj.type === "refund") {
        tObj.student = tObj.toWallet?.owner;
        tObj.vendor = tObj.fromWallet?.owner;
      }
      return tObj;
    });

    res.status(200).json({
      success: true,
      transactions: formattedTransactions,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getApprovedVendors = async (req, res) => {
  try {
    const vendors = await User.find({
      accountType: "vendor",
      vendorStatus: "approved",
    }).select("name email phone profilePicture description address");

    res.status(200).json({
      success: true,
      vendors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await User.findOne({
      _id: id,
      accountType: "vendor",
      vendorStatus: "approved",
    }).select("name email phone profilePicture description address");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
