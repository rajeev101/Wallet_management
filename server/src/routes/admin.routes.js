const express = require("express");
const {
  addMoney,
  approveVendor,
  getDashboardStats,
  getStudents,
  getCustomers,
  createVendor,
  getTransactions,
  getVendors,
  rejectVendor,
  getAdminWalletRequests,
  updateWalletRequestStatus,
} = require("../controllers/admin.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { rateLimit } = require("express-rate-limit");
const deviceController = require("../controllers/device.controller");

const router = express.Router();

router.use(authMiddleware.verifyToken, authMiddleware.verifyAdmin);

router.get("/stats", getDashboardStats);
router.get("/students", getStudents);
router.get("/customers", getCustomers);
router.get("/vendors", getVendors);
router.post("/vendors", createVendor);
// Explicit activation names plus legacy approval routes for compatibility.
router.put("/vendor/:id/activate", approveVendor);
router.put("/vendor/:id/deactivate", rejectVendor);
router.put("/vendor/:id/approve", approveVendor);
router.put("/vendor/:id/reject", rejectVendor);
router.post("/add-money", addMoney);
router.get("/transactions", getTransactions);
router.get("/wallet/requests", getAdminWalletRequests);
router.put("/wallet/request/:id", updateWalletRequestStatus);
router.get("/devices", deviceController.listDevices);
router.get("/devices/:id", deviceController.getDevice);
router.get("/devices/:id/history", deviceController.getResetHistory);
router.get("/devices/:id/attempts", deviceController.getBlockedAttempts);
router.post("/devices/:id/reset", rateLimit({
  windowMs: 60 * 60 * 1000, limit: 30, keyGenerator: req => req.user.userId,
  standardHeaders: "draft-7", legacyHeaders: false,
  message: { success: false, message: "Too many device resets. Please try again later." },
}), deviceController.resetUserDevice);

module.exports = router;
