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
  createPayment,
  getNotifications,
} = require(
  "../controllers/auth.controller"
);
const authMiddleware = require("../middlewares/auth.middleware");

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
router.post("/payment", authMiddleware, createPayment);
router.get("/notifications", authMiddleware, getNotifications);

module.exports = router;
