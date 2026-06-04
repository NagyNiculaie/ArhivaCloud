const express = require("express");
const cors = require("cors");
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

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

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