const express = require("express");
const { rateLimit } = require("express-rate-limit");

const router = express.Router();



const {
  signup,
  login,
  logout,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  createWalletRequest,
  getStudentWalletRequests,
  makePayment,
  getMyTransactions,
  getApprovedVendors,
  getVendorById,
} = require(
  "../controllers/auth.controller"
);
const authMiddleware = require("../middlewares/auth.middleware");
const { registerDevice, unregisterDevice } = require("../controllers/push.controller");
const {
  getNotifications,
  clearNotifications,
} = require("../controllers/notification.controller");

router.post("/signup", signup);

router.post("/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, code: "LOGIN_RATE_LIMITED", message: "Too many login attempts. Please try again later." },
}), login);

router.delete("/logout", authMiddleware, logout);

router.post("/forgot-password", forgotPassword);

router.post("/verify-otp", verifyOtp);

router.post("/reset-password", resetPassword);

router.get("/profile", authMiddleware, getProfile);

router.put("/profile", authMiddleware, updateProfile);
router.put("/password", authMiddleware, changePassword);

router.post("/wallet/request", authMiddleware, authMiddleware.requireRoles("student", "customer"), createWalletRequest);
router.get("/wallet/requests", authMiddleware, authMiddleware.requireRoles("student", "customer"), getStudentWalletRequests);
router.post("/pay", authMiddleware, authMiddleware.requireRoles("student", "customer"), makePayment);
router.get("/transactions", authMiddleware, getMyTransactions);
router.get("/vendors", authMiddleware, authMiddleware.requireRoles("student", "customer"), getApprovedVendors);
router.get("/vendors/:id", authMiddleware, authMiddleware.requireRoles("student", "customer"), getVendorById);
router.get("/notifications", authMiddleware, getNotifications);
router.delete("/notifications", authMiddleware, clearNotifications);
router.post("/push/devices", authMiddleware, authMiddleware.requireRoles("student", "customer"), registerDevice);
router.delete("/push/devices", authMiddleware, authMiddleware.requireRoles("student", "customer"), unregisterDevice);

module.exports = router;
