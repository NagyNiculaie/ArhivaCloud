const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const documentsRoutes = require("./routes/documents.routes");
const searchRoutes = require("./routes/search.routes");

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
    console.log("MONGO_URI =", process.env.MONGO_URI);
    console.log("🔌 Încerc conexiunea la MongoDB...");

    try {
      if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI lipsește din fișierul .env");
      }

      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
      });

      console.log("✅ MongoDB conectat!");
    } catch (mongoError) {
      console.log("⚠️ MongoDB nu este disponibil acum. Pornesc serverul fără baza de date.");
      console.log("Detaliu:", mongoError.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server pornit pe portul ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Eroare la pornire:", error.message);
    process.exit(1);
  }
}

startServer();