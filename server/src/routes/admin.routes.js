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

module.exports = router;
