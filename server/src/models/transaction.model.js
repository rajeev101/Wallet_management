const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    fromWallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      default: null,
    },
    toWallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      default: null,
    },
    type: {
      type: String,
      enum: ["wallet_topup", "payment", "refund"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);
