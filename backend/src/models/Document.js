const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    file: {
      originalName: String,
      mimeType: String,
      size: Number,
      url: String,
      publicId: String,
    },

    extractedText: {
      type: String,
      default: "",
    },

    // Îl păstrăm pentru compatibilitate, chiar dacă acum folosești embeddings pe chunks
    embedding: {
      type: [Number],
      default: [],
    },

    // Clasificare document
    category: {
      type: String,
      enum: [
        "factura",
        "bon",
        "nir",
        "contract",
        "extras_bancar",
        "declaratie",
        "stat_plata",
        "chitanta",
        "altul",
      ],
      default: "altul",
      index: true,
    },

    documentDate: {
      type: Date,
      default: null,
      index: true,
    },

    year: {
      type: Number,
      default: null,
      index: true,
    },

    month: {
      type: Number,
      default: null,
      index: true,
    },

    supplier: {
      type: String,
      default: "",
      index: true,
    },

    totalAmount: {
      type: Number,
      default: null,
    },

    currency: {
      type: String,
      default: "RON",
    },

    tags: {
      type: [String],
      default: [],
    },

    aiSummary: {
      type: String,
      default: "",
    },

    classificationConfidence: {
      type: Number,
      default: 0,
    },

    classificationStatus: {
      type: String,
      enum: ["pending", "classified", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

DocumentSchema.index({ owner: 1, year: 1, month: 1, category: 1 });
DocumentSchema.index({ owner: 1, supplier: 1 });
DocumentSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model("Document", DocumentSchema);