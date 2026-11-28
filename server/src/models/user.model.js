const mongoose = require("mongoose");

const deviceBindingSchema = new mongoose.Schema({
  id: { type: String, required: true },
  credentialHash: { type: String, required: true },
  name: String,
  platform: { type: String, enum: ["android", "ios"], required: true },
  osVersion: String,
  appVersion: String,
  registeredAt: { type: Date, required: true },
  lastLoginAt: { type: Date, required: true },
}, { _id: false });

const deviceResetSchema = new mongoose.Schema({
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  adminName: { type: String, required: true },
  reason: { type: String, required: true },
  resetAt: { type: Date, required: true },
  previousDevice: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: true });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    accountType: {
      type: String,
      enum: ["student", "customer", "vendor", "admin"],
      default: "student",
    },

    // Required for new signups by the controller, optional for legacy accounts.
    // Strings preserve leading zeros and alphanumeric Student IDs.
    student_id: {
      type: String,
      trim: true,
    },

    samagra_id: {
      type: String,
      trim: true,
    },

    vendorStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    profilePicture: {
      type: String,
      default: "",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationToken: {
      type: String,
      default: null,
    },

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpiresAt: {
      type: Date,
      default: null,
    },
    authVersion: { type: Number, default: 0, min: 0 },
    deviceLockEnabled: { type: Boolean, default: true },
    deviceBinding: { type: deviceBindingSchema, default: null, select: false },
    deviceResetHistory: { type: [deviceResetSchema], default: [], select: false },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ accountType: 1, "deviceBinding.id": 1 });
userSchema.set("toObject", { transform: (document, result) => {
  delete result.deviceBinding;
  delete result.deviceResetHistory;
  return result;
} });

module.exports = mongoose.model("User", userSchema);
