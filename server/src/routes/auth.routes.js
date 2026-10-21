const express = require("express");

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
const {
  getNotifications,
  clearNotifications,
} = require("../controllers/notification.controller");

router.post("/signup", signup);

router.post("/login", login);

router.delete("/logout", logout);

router.post("/forgot-password", forgotPassword);

router.post("/verify-otp", verifyOtp);

router.post("/reset-password", resetPassword);

router.get("/profile", authMiddleware, getProfile);

router.put("/profile", authMiddleware, updateProfile);

router.post("/wallet/request", authMiddleware, authMiddleware.requireRoles("student"), createWalletRequest);
router.get("/wallet/requests", authMiddleware, authMiddleware.requireRoles("student"), getStudentWalletRequests);
router.post("/pay", authMiddleware, authMiddleware.requireRoles("student"), makePayment);
router.get("/transactions", authMiddleware, getMyTransactions);
router.get("/vendors", authMiddleware, authMiddleware.requireRoles("student"), getApprovedVendors);
router.get("/vendors/:id", authMiddleware, authMiddleware.requireRoles("student"), getVendorById);
router.get("/notifications", authMiddleware, getNotifications);
router.delete("/notifications", authMiddleware, clearNotifications);

module.exports = router;
