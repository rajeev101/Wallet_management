const User = require("../models/user.model");
const Wallet = require("../models/wallet.model");
const OTP = require("../models/otp.model");
const Transaction = require("../models/transaction.model");
const Notification = require("../models/notification.model");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const { WALLET_PAYER_ROLES, formatTransaction } = require("../utils/walletRoles");
const { sendOTPEmail, sendPasswordResetSuccessEmail } = require("../utils/email");

const crypto = require("crypto");
const transporter = require("../services/email.service");
exports.changePassword = require("./password.controller").changePassword;

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

    if (!WALLET_PAYER_ROLES.includes(requestedAccountType)) {
      return res.status(400).json({
        success: false,
        message: "Public registration is available for students and customers only. Vendors are created by an administrator.",
      });
    }

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const identityField = requestedAccountType === "student" ? "student_id" : "samagra_id";
    const identityValue = req.body[identityField];
    if (typeof identityValue !== "string" || !identityValue.trim()) {
      return res.status(400).json({
        success: false,
        message: requestedAccountType === "student" ? "Student ID is required" : "Samagra ID is required",
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
      [identityField]: identityValue.trim(),
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

    if (user.accountType === "vendor" && user.vendorStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Your vendor account is inactive. Please contact the administrator.",
      });
    }

    // Student/customer roles always come from the database, regardless of any
    // legacy role field in a request. Preserve existing vendor/admin checks.
    if (!["student", "customer"].includes(user.accountType) && req.body.accountType && String(req.body.accountType).toLowerCase() !== user.accountType) {
      return res.status(403).json({ success: false, message: "Use the login page for your account type." });
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
    const { name, profilePicture } = req.body;

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const currentUser = await User.findById(userId).select("email phone accountType");

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const requestedEmail = req.body.email;
    const requestedPhone = req.body.phone;

    const profileUpdates = {
      name: name.trim(),
    };

    if (["student", "customer", "vendor"].includes(currentUser.accountType)) {
      if (
        requestedEmail !== undefined &&
        String(requestedEmail).toLowerCase().trim() !== currentUser.email
      ) {
        return res.status(400).json({
          success: false,
          message: "Email address cannot be changed",
        });
      }

      if (
        requestedPhone !== undefined &&
        String(requestedPhone).trim() !== (currentUser.phone || "")
      ) {
        return res.status(400).json({
          success: false,
          message: "Phone number cannot be changed",
        });
      }
    } else {
      const normalizedEmail = requestedEmail?.toLowerCase().trim();

      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: "Name and email are required",
        });
      }

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

      profileUpdates.email = normalizedEmail;
      profileUpdates.phone = requestedPhone?.trim() || "";
    }

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
    const otp = crypto.randomInt(100000, 1000000).toString();
    user.resetPasswordToken = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

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

    // Exchange the OTP for a short-lived, single-use reset grant.
    const resetToken = crypto.randomBytes(32).toString("hex");
    await User.findOneAndUpdate({ email: email.toLowerCase() }, {
      resetPasswordToken: crypto.createHash("sha256").update(resetToken).digest("hex"),
      resetPasswordExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    await OTP.deleteOne({ _id: otpRecord._id });
    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      email: email,
      resetToken,
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
    const { email, newPassword, resetToken } = req.body;

    // Validate inputs
    if (!email || !newPassword || typeof resetToken !== "string" || !resetToken) {
      return res.status(400).json({
        success: false,
        message: "Email, new password, and verified reset token are required",
      });
    }

    // Validate password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await User.findOneAndUpdate({
      email: email.toLowerCase(),
      resetPasswordToken: crypto.createHash("sha256").update(resetToken).digest("hex"),
      resetPasswordExpiresAt: { $gt: new Date() },
    }, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
    }, { returnDocument: "after" });
    if (!user) {
      return res.status(401).json({ success: false, message: "Password reset authorization expired or invalid. Verify a new OTP." });
    }

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

    if (!WALLET_PAYER_ROLES.includes(req.user?.accountType)) {
      return res.status(403).json({ success: false, message: "Only students and customers may request wallet funds" });
    }

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
          text: `Money Request: ${requester?.name || `A ${req.user.accountType}`} requested ₹${parsedAmount.toFixed(2)}.`,
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
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 5));

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
        page,
        limit,
        hasMore: false,
      });
    }

    const requests = await Transaction.find({
      toWallet: wallet._id,
      type: "wallet_topup",
    })
      .populate({
        path: "toWallet",
        populate: { path: "owner", select: "name email accountType" }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1);

    const hasMore = requests.length > limit;
    const formattedRequests = requests.slice(0, limit).map(formatTransaction);

    res.status(200).json({
      success: true,
      requests: formattedRequests,
      page,
      limit,
      hasMore,
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
        message: "Account not found",
      });
    }

    if (!WALLET_PAYER_ROLES.includes(student.accountType)) {
      return res.status(403).json({ success: false, message: "Only students and customers can pay vendors" });
    }

    // Find the payer's independently owned wallet.
    let studentWallet = await Wallet.findOne({ owner: studentId });
    if (!studentWallet) {
      studentWallet = await Wallet.create({
        owner: studentId,
        balance: 0,
        ownerType: student.accountType,
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
        message: "Vendor is inactive and cannot accept payments",
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

    // Conditional debit prevents concurrent requests from overdrawing a wallet.
    studentWallet = await Wallet.findOneAndUpdate(
      { _id: studentWallet._id, balance: { $gte: parsedAmount } },
      { $inc: { balance: -parsedAmount } },
      { returnDocument: "after" }
    );
    if (!studentWallet) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }
    let transaction;
    let credited = false;
    try {
      const recipientWallet = await Wallet.findByIdAndUpdate(vendorWallet._id,
        { $inc: { balance: parsedAmount } }, { returnDocument: "after" });
      if (!recipientWallet) throw new Error("Vendor wallet no longer exists");
      credited = true;
      transaction = await Transaction.create({
        fromWallet: studentWallet._id,
        toWallet: vendorWallet._id,
        type: "payment",
        amount: parsedAmount,
        status: "completed",
        description: `Payment to ${vendor.name}`,
        createdBy: student._id,
      });
    } catch (error) {
      if (credited) await Wallet.updateOne({ _id: vendorWallet._id }, { $inc: { balance: -parsedAmount } });
      await Wallet.updateOne({ _id: studentWallet._id }, { $inc: { balance: parsedAmount } });
      throw error;
    }

    await Promise.allSettled([
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
        populate: { path: "owner", select: "name email accountType" }
      })
      .populate({
        path: "toWallet",
        populate: { path: "owner", select: "name email accountType" }
      })
      .sort({ createdAt: -1 });

    const formattedTransactions = transactions.map(formatTransaction);

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
