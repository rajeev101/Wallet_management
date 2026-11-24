const mongoose = require("mongoose");

const pushDeviceSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  platform: { type: String, enum: ["android", "ios"], required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model("PushDevice", pushDeviceSchema);