const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const documentsRoutes = require("./src/routes/documents.routes");
const searchRoutes = require("./src/routes/search.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.send("API Arhiva Cloud funcționează ✅");
});

app.use("/documents", documentsRoutes);
app.use("/search", searchRoutes);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log("🔌 Încerc conexiunea la MongoDB...");

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI lipsește din Environment Variables");
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("✅ MongoDB conectat!");

    app.listen(PORT, () => {
      console.log(`🚀 Server pornit pe portul ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Eroare la pornire:", error.message);
    process.exit(1);
  }
}
console.log("CLOUDINARY:", process.env.CLOUDINARY_API_KEY);
startServer();