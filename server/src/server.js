const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const app = require("./app");

const connectDB =
  require("./config/db");

const bootstrapAdmin =
  require("./utils/bootstrapAdmin");

const PORT =
  process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await bootstrapAdmin();

  app.listen(PORT, () => {
    console.log(
      `Server running on port ${PORT}`
    );
  });
};

startServer();
