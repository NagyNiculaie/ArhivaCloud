const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      default: "demo-user"
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
      default: ""
    },

    embedding: {
      type: [Number],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", DocumentSchema);