const Notification = require("../models/notification.model");

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.clearNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user.userId });
    res.status(200).json({ success: true, message: "Notifications cleared successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
