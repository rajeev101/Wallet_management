const mongoose = require("mongoose");

const pushDeliverySchema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  status: { type: String, enum: ["pending", "sending", "sent", "failed"], default: "pending" },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  lockedUntil: Date,
  tickets: [{ token: String, receiptId: String }],
  completedAt: Date,
}, { timestamps: true });

pushDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
pushDeliverySchema.index({ completedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("PushDelivery", pushDeliverySchema);