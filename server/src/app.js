const express = require("express");
const cors = require("cors");

const authRoutes =
  require("./routes/auth.routes");
const adminRoutes =
  require("./routes/admin.routes");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
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
