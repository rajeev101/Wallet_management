const express = require("express");
const {
  addMoney,
  approveVendor,
  getDashboardStats,
  getStudents,
  getTransactions,
  getVendors,
  rejectVendor,
  getAdminWalletRequests,
  updateWalletRequestStatus,
} = require("../controllers/admin.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware.verifyToken, authMiddleware.verifyAdmin);

router.get("/stats", getDashboardStats);
router.get("/students", getStudents);
router.get("/vendors", getVendors);
router.put("/vendor/:id/approve", approveVendor);
router.put("/vendor/:id/reject", rejectVendor);
router.post("/add-money", addMoney);
router.get("/transactions", getTransactions);
router.get("/wallet/requests", getAdminWalletRequests);
router.put("/wallet/request/:id", updateWalletRequestStatus);

module.exports = router;
