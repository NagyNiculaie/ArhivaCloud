const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const authRoutes = require("./src/routes/auth.routes");
const documentsRoutes = require("./src/routes/documents.routes");
const searchRoutes = require("./src/routes/search.routes");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://arhiva-cloud-frontend.vercel.app",
];

// CORS manual - pus înainte de toate rutele
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.send("API Arhiva Cloud funcționează ✅");
});

app.use("/auth", authRoutes);
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

startServer();