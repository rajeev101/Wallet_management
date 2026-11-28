const mongoose = require("mongoose");

const deviceAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  device: { id: String, name: String, platform: String, osVersion: String, appVersion: String },
  code: { type: String, required: true },
}, { timestamps: true });

deviceAttemptSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model("DeviceAttempt", deviceAttemptSchema);