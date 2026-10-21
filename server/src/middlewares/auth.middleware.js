const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

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

    const user = await User.findById(decoded.userId).select("accountType vendorStatus");
    if (!user) {
      return res.status(401).json({ message: "Session user no longer exists" });
    }

    if (user.accountType === "vendor" && user.vendorStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Your vendor account is inactive. Please contact the administrator.",
      });
    }

    // Role is always read from the current database record, never trusted from a token or client.
    req.user = { userId: user._id.toString(), accountType: user.accountType };

    next();

  } catch (error) {

    return res.status(401).json({
      message: "Invalid token",
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
