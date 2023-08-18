const mongoose = require("mongoose");

const paymentSchema = mongoose.Schema(
  {
    payment: { type: Array },
  },
  { timestamps: true }
);
const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;
