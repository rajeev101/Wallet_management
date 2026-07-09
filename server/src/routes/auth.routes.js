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

router.post("/wallet/request", authMiddleware, createWalletRequest);
router.get("/wallet/requests", authMiddleware, getStudentWalletRequests);
router.post("/pay", authMiddleware, makePayment);
router.get("/transactions", authMiddleware, getMyTransactions);
router.get("/vendors", authMiddleware, getApprovedVendors);
router.get("/vendors/:id", authMiddleware, getVendorById);
router.get("/notifications", authMiddleware, getNotifications);
router.delete("/notifications", authMiddleware, clearNotifications);

module.exports = router;
