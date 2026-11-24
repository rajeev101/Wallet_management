const { Expo } = require("expo-server-sdk");
const PushDevice = require("../models/pushDevice.model");

exports.registerDevice = async (req, res) => {
  const { token, platform } = req.body || {};
  if (typeof token !== "string" || token.length > 200 || !Expo.isExpoPushToken(token) || !["android", "ios"].includes(platform)) {
    return res.status(400).json({ success: false, message: "A valid Expo push token and platform are required" });
  }
  try {
    await PushDevice.findOneAndUpdate({ token }, {
      $set: { owner: req.user.userId, platform, expiresAt: req.authExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    }, { upsert: true, runValidators: true });
    return res.json({ success: true });
  } catch (error) {
    return res.status(503).json({ success: false, message: "Could not register notifications. Please try again." });
  }
};

exports.unregisterDevice = async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== "string" || token.length > 200 || !Expo.isExpoPushToken(token)) {
    return res.status(400).json({ success: false, message: "A valid Expo push token is required" });
  }
  try {
    await PushDevice.deleteOne({ token, owner: req.user.userId });
    return res.json({ success: true });
  } catch (error) {
    return res.status(503).json({ success: false, message: "Could not disable notifications. Please try again." });
  }
};