const Transaction = require("../models/transaction.model");
const User = require("../models/user.model");
const Wallet = require("../models/wallet.model");

const formatNotificationTime = (value) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;

const getSearchFilter = (search) => {
  if (!search) {
    return {};
  }

  const pattern = new RegExp(search.trim(), "i");

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
    const [totalStudents, totalVendors, totalTransactions, walletSummary] =
      await Promise.all([
        User.countDocuments({ accountType: "student" }),
        User.countDocuments({ accountType: "vendor" }),
        Transaction.countDocuments(),
        Wallet.aggregate([
          { $match: { ownerType: "student" } },
          {
            $group: {
              _id: null,
              totalWalletBalance: { $sum: "$balance" },
              averageWalletBalance: { $avg: "$balance" },
            },
          },
        ]),
      ]);

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalVendors,
        totalTransactions,
        totalWalletBalance: walletSummary[0]?.totalWalletBalance || 0,
        averageWalletBalance: walletSummary[0]?.averageWalletBalance || 0,
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
      walletMap[w.owner.toString()] = w.balance;
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
      message: "Vendor approved successfully",
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
      message: "Vendor rejected successfully",
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
    const { studentId, amount, description } = req.body;
    const parsedAmount = Number(amount);

    if (!studentId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid studentId and amount are required",
      });
    }

    const student = await User.findOne({ _id: studentId, accountType: "student" });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    let wallet = await Wallet.findOne({ owner: studentId });
    if (!wallet) {
      wallet = await Wallet.create({
        owner: studentId,
        balance: 0,
        ownerType: "student",
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
    studentObj.walletBalance = wallet.balance;

    res.status(200).json({
      success: true,
      message: "Money added successfully",
      student: studentObj,
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
    const transactions = await Transaction.find()
      .populate({
        path: "fromWallet",
        populate: { path: "owner", select: "name email" },
      })
      .populate({
        path: "toWallet",
        populate: { path: "owner", select: "name email" },
      })
      .populate("createdBy", "name email accountType")
      .sort({ createdAt: -1 })
      .limit(200);

    const formattedTransactions = transactions.map((t) => {
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

exports.getNotifications = async (req, res) => {
  try {
    const [payments, walletRequests, newUsers] = await Promise.all([
      Transaction.find({
        type: "payment",
        status: "completed",
      })
        .populate("student", "name email")
        .populate("vendor", "name email")
        .sort({ createdAt: -1 })
        .limit(25),
      Transaction.find({
        type: "wallet_topup",
        status: "pending",
      })
        .populate("student", "name email")
        .sort({ createdAt: -1 })
        .limit(25),
      User.find({
        accountType: { $in: ["student", "vendor"] },
      })
        .select("name email accountType vendorStatus createdAt")
        .sort({ createdAt: -1 })
        .limit(25),
    ]);

    const paymentNotifications = payments.map((transaction) => ({
      id: `payment-${transaction._id}`,
      text: `${transaction.student?.name || "Student"} paid ${formatMoney(transaction.amount)} to ${transaction.vendor?.name || "Vendor"}.`,
      time: formatNotificationTime(transaction.createdAt),
      createdAt: transaction.createdAt,
    }));

    const walletRequestNotifications = walletRequests.map((transaction) => ({
      id: `wallet-request-${transaction._id}`,
      text: `${transaction.student?.name || "Student"} requested ${formatMoney(transaction.amount)} wallet top-up approval.`,
      time: formatNotificationTime(transaction.createdAt),
      createdAt: transaction.createdAt,
    }));

    const accountNotifications = newUsers.map((user) => ({
      id: `account-${user._id}`,
      text:
        user.accountType === "vendor"
          ? `New vendor account created: ${user.name || "Vendor"} (${user.email}).`
          : `New student account created: ${user.name || "Student"} (${user.email}).`,
      time: formatNotificationTime(user.createdAt),
      createdAt: user.createdAt,
    }));

    const notifications = [
      ...paymentNotifications,
      ...walletRequestNotifications,
      ...accountNotifications,
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50);

    res.status(200).json({
      success: true,
      notifications,
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
        populate: { path: "owner", select: "name email" },
      })
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map((t) => {
      const tObj = t.toObject();
      tObj.student = tObj.toWallet?.owner;
      return tObj;
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
