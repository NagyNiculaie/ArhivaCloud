// ================= IMPORTURI =================
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

// ================= INIT APP =================
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ================= MODEL TEST =================
const TestSchema = new mongoose.Schema(
  {
    message: String,
  },
  { timestamps: true }
);

const Test = mongoose.model("Test", TestSchema);

// ================= RUTE =================

// Test server simplu
app.get("/", (req, res) => {
  res.send("Serverul pentru Arhiva Cloud funcționează! 🎉");
});

// Test salvare în MongoDB
app.get("/db-test", async (req, res) => {
  try {
    const documentSalvat = await Test.create({
      message: "Salut! Testul MongoDB funcționează 🎉",
    });

    res.json({
      success: true,
      data: documentSalvat,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ================= PORNIRE SERVER =================
async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI nu este definit în .env");
    }

    console.log("🔌 Se încearcă conectarea la MongoDB...");

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("✅ Conectat la MongoDB Atlas cu succes!");

    app.listen(PORT, () => {
      console.log(`🚀 Serverul rulează pe portul ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Eroare la conectare:", err.message);
    process.exit(1);
  }
}

startServer();