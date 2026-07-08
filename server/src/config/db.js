const mongoose = require("mongoose");

const maskMongoUri = (uri) => {
  try {
    const parsedUri = new URL(uri);

    if (parsedUri.password) {
      parsedUri.password = "*****";
    }

    return parsedUri.toString();
  } catch {
    return uri;
  }
};

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("MongoDB connection failed: MONGO_URI is not defined.");
    process.exit(1);
  }

  try {
    const connection = await mongoose.connect(mongoUri);
    const { host, port, name } = connection.connection;

    console.log(`MongoDB connected: ${host}:${port}/${name}`);
  } catch (error) {
    console.error(`MongoDB connection failed for ${maskMongoUri(mongoUri)}`);
    console.error(error.message);

    process.exit(1);
  }
};

module.exports = connectDB;
