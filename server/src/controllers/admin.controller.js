const Transaction = require("../models/transaction.model");
const User = require("../models/user.model");
const Wallet = require("../models/wallet.model");
const Notification = require("../models/notification.model");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { WALLET_PAYER_ROLES, formatTransaction } = require("../utils/walletRoles");
const onboarding = require("../services/vendorOnboarding.service");

const getSearchFilter = (search) => {
  if (!search) {
    return {};
  }

  const pattern = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  return {
    $or: [
      { name: pattern },
      { email: pattern },
      { phone: pattern },
    ],
  };
};

exports.getDashboardStats = async (req, res) => {
  try {
    const [totalStudents, totalVendors, totalTransactions, transactionSummary, walletSummary, totalCustomers] =
      await Promise.all([
        User.countDocuments({ accountType: "student" }),
        User.countDocuments({ accountType: "vendor", vendorStatus: "approved" }),
        Transaction.countDocuments(),
        Transaction.aggregate([
          { $match: { status: "completed" } },
          {
            $group: {
              _id: null,
              totalMoneyAdded: {
                $sum: {
                  $cond: [{ $eq: ["$type", "wallet_topup"] }, "$amount", 0],
                },
              },
              totalPayments: {
                $sum: {
                  $cond: [{ $eq: ["$type", "payment"] }, "$amount", 0],
                },
              },
              totalRefunds: {
                $sum: {
                  $cond: [{ $eq: ["$type", "refund"] }, "$amount", 0],
                },
              },
            },
          },
        ]),
        Wallet.aggregate([
          { $match: { ownerType: { $in: WALLET_PAYER_ROLES } } },
          {
            $group: {
              _id: null,
              totalWalletBalance: { $sum: "$balance" },
              averageWalletBalance: { $avg: "$balance" },
            },
          },
        ]),
        User.countDocuments({ accountType: "customer" }),
      ]);

    const txSummary = transactionSummary[0] || {
      totalMoneyAdded: 0,
      totalPayments: 0,
      totalRefunds: 0,
    };

    // Existing balances are authoritative even when historical transactions are incomplete.
    const totalWalletBalance = walletSummary[0]?.totalWalletBalance || 0;

    const averageWalletBalance =
      totalStudents + totalCustomers > 0
        ? totalWalletBalance / (totalStudents + totalCustomers)
        : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalCustomers,
        totalVendors,
        totalTransactions,
        totalWalletBalance,
        averageWalletBalance,
        totalMoneyAdded: txSummary.totalMoneyAdded,
        totalPayments: txSummary.totalPayments,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const students = await User.find({
      accountType: "student",
      ...getSearchFilter(req.query.search),
    })
      .select("-password")
      .sort({ createdAt: -1 });

    const studentIds = students.map((s) => s._id);
    const wallets = await Wallet.find({ owner: { $in: studentIds } });
    const walletMap = {};
    wallets.forEach((w) => {
      const bal = Number(w.balance || 0);
      walletMap[w.owner.toString()] = Number.isFinite(bal) && bal >= 0 && bal < 1e12 ? bal : 0;
    });

    const studentsWithBalance = students.map((s) => {
      const sObj = s.toObject();
      sObj.walletBalance = walletMap[s._id.toString()] || 0;
      return sObj;
    });

    res.status(200).json({
      success: true,
      students: studentsWithBalance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ accountType: "customer", ...getSearchFilter(req.query.search) })
      .select("-password -resetPasswordToken -verificationToken").sort({ createdAt: -1 });
    const wallets = await Wallet.find({ owner: { $in: customers.map((user) => user._id) } });
    const balances = new Map(wallets.map((wallet) => [String(wallet.owner), wallet.balance]));
    res.json({ success: true, customers: customers.map((user) => ({ ...user.toObject(), walletBalance: balances.get(String(user._id)) || 0 })) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createVendor = async (req, res) => {
  let vendor;
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Vendor name and valid email are required" });
    }
    if (await User.findOne({ email })) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }
    const password = crypto.randomBytes(24).toString("base64url");
    vendor = await User.create({
      name, email, phone: String(req.body.phone || "").trim(),
      password: await bcrypt.hash(password, 10),
      accountType: "vendor", vendorStatus: req.body.active === false ? "rejected" : "approved",
    });
    const wallet = await Wallet.create({ owner: vendor._id, ownerType: "vendor", balance: 0 });
    try {
      await onboarding.sendVendorOnboardingEmail({ email, password });
    } catch {
      await Wallet.deleteOne({ _id: wallet._id });
      await User.deleteOne({ _id: vendor._id });
      vendor = null;
      return res.status(503).json({ success: false, message: "Onboarding email could not be sent. No vendor account was retained. Configure email delivery and try again." });
    }
    const safeVendor = vendor.toObject();
    delete safeVendor.password;
    res.status(201).json({ success: true, message: "Vendor created and onboarding email sent", vendor: { ...safeVendor, walletBalance: 0 } });
  } catch (error) {
    if (vendor) {
      await Wallet.deleteOne({ owner: vendor._id });
      await User.deleteOne({ _id: vendor._id });
    }
    res.status(error.code === 11000 ? 409 : 500).json({ success: false, message: error.code === 11000 ? "Email already exists" : "Vendor could not be created" });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const vendors = await User.find({
      accountType: "vendor",
      ...getSearchFilter(req.query.search),
    })
      .select("-password")
      .sort({ createdAt: -1 });

    const vendorIds = vendors.map((v) => v._id);
    const wallets = await Wallet.find({ owner: { $in: vendorIds } });
    const walletMap = {};
    wallets.forEach((w) => {
      walletMap[w.owner.toString()] = w.balance;
    });

    const vendorsWithBalance = vendors.map((v) => {
      const vObj = v.toObject();
      vObj.walletBalance = walletMap[v._id.toString()] || 0;
      return vObj;
    });

    res.status(200).json({
      success: true,
      vendors: vendorsWithBalance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.approveVendor = async (req, res) => {
  try {
    const vendor = await User.findOneAndUpdate(
      { _id: req.params.id, accountType: "vendor" },
      { vendorStatus: "approved" },
      { new: true, runValidators: true }
    ).select("-password");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor activated successfully",
      vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.rejectVendor = async (req, res) => {
  try {
    const vendor = await User.findOneAndUpdate(
      { _id: req.params.id, accountType: "vendor" },
      { vendorStatus: "rejected" },
      { new: true, runValidators: true }
    ).select("-password");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor deactivated successfully",
      vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addMoney = async (req, res) => {
  try {
    const { amount, description } = req.body;
    const studentId = req.body.studentId || req.body.customerId;
    const parsedAmount = Number(amount);

    if (!studentId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid studentId and amount are required",
      });
    }

    const student = await User.findOne({ _id: studentId, accountType: req.body.customerId ? "customer" : "student" });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: req.body.customerId ? "Customer not found" : "Student not found",
      });
    }

    let wallet = await Wallet.findOne({ owner: studentId });
    if (!wallet) {
      wallet = await Wallet.create({
        owner: studentId,
        balance: 0,
        ownerType: student.accountType,
        status: "active",
      });
    }

    wallet.balance += parsedAmount;
    await wallet.save();

    const transaction = await Transaction.create({
      toWallet: wallet._id,
      type: "wallet_topup",
      amount: parsedAmount,
      status: "completed",
      description: description || "Wallet top-up by admin",
      createdBy: req.admin?._id || req.user?.userId,
    });

    const studentObj = student.toObject();
    delete studentObj.password;
    studentObj.walletBalance = wallet.balance;

    res.status(200).json({
      success: true,
      message: "Money added successfully",
      [student.accountType]: studentObj,
      transaction,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { vendorId } = req.query;
    let queryObj = {};

    if (vendorId) {
      const wallet = await Wallet.findOne({ owner: vendorId });
      if (!wallet) {
        return res.status(200).json({
          success: true,
          transactions: [],
        });
      }
      queryObj = {
        $or: [{ fromWallet: wallet._id }, { toWallet: wallet._id }],
      };
    }

    let dbQuery = Transaction.find(queryObj)
      .populate({
        path: "fromWallet",
        populate: { path: "owner", select: "name email accountType" },
      })
      .populate({
        path: "toWallet",
        populate: { path: "owner", select: "name email accountType" },
      })
      .populate("createdBy", "name email accountType")
      .sort({ createdAt: -1 });

    if (!vendorId) {
      dbQuery = dbQuery.limit(200);
    }

    const transactions = await dbQuery;

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

exports.getAdminWalletRequests = async (req, res) => {
  try {
    const requests = await Transaction.find({ type: "wallet_topup" })
      .populate({
        path: "toWallet",
        populate: { path: "owner", select: "name email accountType" },
      })
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map(formatTransaction);

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

exports.updateWalletRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "approved" or "rejected"

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    if (transaction.type !== "wallet_topup") {
      return res.status(400).json({ success: false, message: "Only wallet top-up requests can be reviewed" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${transaction.status}`,
      });
    }

    if (status === "approved") {
      const wallet = await Wallet.findOne({ _id: transaction.toWallet });
      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: "Wallet associated with this request not found",
        });
      }

      wallet.balance += transaction.amount;
      await wallet.save();

      transaction.status = "completed";
      transaction.createdBy = req.admin?._id || req.user?.userId;
      await transaction.save();
    } else {
      transaction.status = "failed"; // rejected maps to failed in the DB schema
      transaction.createdBy = req.admin?._id || req.user?.userId;
      await transaction.save();
    }

    const requestWallet = await Wallet.findById(transaction.toWallet).select("owner");
    if (requestWallet?.owner) {
      await Notification.create({
        recipient: requestWallet.owner,
        type: "wallet_status",
        text: `Wallet Recharge: Your request for ₹${Number(transaction.amount).toFixed(2)} was ${status}.`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Request ${status} successfully`,
      transaction,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
