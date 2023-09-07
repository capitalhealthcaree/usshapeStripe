const mongoose = require("mongoose");

const rotationSchema = mongoose.Schema(
  {
    name: { type: String },
    email: { type: String },
    termsConditions: { type: Boolean },
    reservation: { type: String },
    url: { type: String },
  },
  { timestamps: true }
);
const Rotation = mongoose.model("Rotation", rotationSchema);
module.exports = Rotation;
