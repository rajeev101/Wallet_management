const express = require("express");
const cors = require("cors");

const authRoutes =
  require("./routes/auth.routes");
const adminRoutes =
  require("./routes/admin.routes");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
    ],
  })
);

app.use(express.json({ limit: "10mb" }));

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
