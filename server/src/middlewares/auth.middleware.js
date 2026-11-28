const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const RevokedToken = require("../models/revokedToken.model");
const { digest } = require("../services/deviceBinding.service");

const authMiddleware = async (
  req,
  res,
  next
) => {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Invalid authorization header" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.userId).select("accountType vendorStatus authVersion +deviceBinding");
    if (!user) {
      return res.status(401).json({ message: "Session user no longer exists" });
    }

    if (user.accountType === "vendor" && user.vendorStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Your vendor account is inactive. Please contact the administrator.",
      });
    }

    if ((decoded.authVersion || 0) !== (user.authVersion || 0)
      || (user.deviceBinding && decoded.deviceIdHash !== digest(user.deviceBinding.id))) {
      return res.status(401).json({ success: false, code: "SESSION_REVOKED", message: "Your session was revoked. Please sign in again." });
    }
    const tokenHash = digest(token);
    if (await RevokedToken.exists({ tokenHash })) {
      return res.status(401).json({ success: false, code: "SESSION_REVOKED", message: "Your session has ended. Please sign in again." });
    }
    req.authSession = { tokenHash, authVersion: decoded.authVersion || 0, deviceIdHash: decoded.deviceIdHash };
    // Role is always read from the current database record, never trusted from a token or client.
    req.user = { userId: user._id.toString(), accountType: user.accountType };
    req.authExpiresAt = decoded.exp ? new Date(decoded.exp * 1000) : undefined;

    next();

  } catch (error) {

    const invalidToken = ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name);
    return res.status(invalidToken ? 401 : 503).json({
      success: false,
      message: invalidToken ? "Invalid token" : "Authentication is temporarily unavailable. Please try again.",
    });

  }
};

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user?.userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!roles.includes(req.user.accountType)) {
    return res.status(403).json({ success: false, message: "Access denied for this account type" });
  }
  return next();
};

const verifyAdmin = async (req, res, next) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins only.",
      });
    }

    req.admin = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

authMiddleware.verifyToken = authMiddleware;
authMiddleware.verifyAdmin = verifyAdmin;
authMiddleware.requireRoles = requireRoles;

module.exports = authMiddleware;
