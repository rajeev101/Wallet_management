const mongoose = require("mongoose");

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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
