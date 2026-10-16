const express = require("express");
const cors = require("cors");

const authRoutes =
  require("./routes/auth.routes");
const adminRoutes =
  require("./routes/admin.routes");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()) : []),
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin server requests)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(null, true); // Fallback to allow connection in production
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));

app.use(
  "/api/v1/auth",
  authRoutes
);

app.use(
  "/api/v1/admin",
  adminRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

module.exports = app;
