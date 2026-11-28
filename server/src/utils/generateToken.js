const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const generateToken = (userId, claims = {}) => {
  return jwt.sign(
    { ...claims, userId, jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

module.exports = generateToken;