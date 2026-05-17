const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

    embedding: {
      type: [Number],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", DocumentSchema);